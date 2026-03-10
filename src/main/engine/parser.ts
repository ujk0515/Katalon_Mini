import { CstParser } from 'chevrotain';
import {
  allTokens,
  WebUI,
  FindTestObject,
  FindTestCase,
  Identifier,
  StringLiteral,
  NumberLiteral,
  Dot,
  LParen,
  RParen,
  Comma,
  tokenize,
} from './lexer';
import type {
  ScriptAST,
  Statement,
  MethodCallStatement,
  CommentStatement,
  Argument,
  FunctionCallArgument,
} from '../../shared/types/ast';

class GroovyCstParser extends CstParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }

  // Script → MethodCall* (Comments are handled in lexer group, not parser)
  script = this.RULE('script', () => {
    this.MANY(() => {
      this.SUBRULE(this.methodCall);
    });
  });

  // MethodCall → WebUI "." Identifier "(" Arguments? ")"
  methodCall = this.RULE('methodCall', () => {
    this.CONSUME(WebUI);
    this.CONSUME(Dot);
    this.CONSUME(Identifier);
    this.CONSUME(LParen);
    this.OPTION(() => {
      this.SUBRULE(this.argumentList);
    });
    this.CONSUME(RParen);
  });

  // ArgumentList → Argument ("," Argument)*
  argumentList = this.RULE('argumentList', () => {
    this.SUBRULE(this.argument);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.argument);
    });
  });

  // Argument → StringLiteral | NumberLiteral | FunctionCall | Identifier
  argument = this.RULE('argument', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.functionCall) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
  });

  // FunctionCall → (findTestObject | findTestCase) "(" Arguments ")"
  functionCall = this.RULE('functionCall', () => {
    this.OR([
      { ALT: () => this.CONSUME(FindTestObject) },
      { ALT: () => this.CONSUME(FindTestCase) },
    ]);
    this.CONSUME(LParen);
    this.OPTION(() => {
      this.SUBRULE(this.argumentList);
    });
    this.CONSUME(RParen);
  });
}

const parserInstance = new GroovyCstParser();

// CST → AST Visitor
function cstToAst(cst: any, comments: any[]): ScriptAST {
  const statements: Statement[] = [];

  if (!cst.children) {
    return { type: 'Script', statements };
  }

  // Process method calls
  const methodCalls = cst.children.methodCall || [];
  for (const mc of methodCalls) {
    const webUIToken = mc.children.WebUI[0];
    const identToken = mc.children.Identifier[0];
    const args = extractArguments(mc.children.argumentList);

    const stmt: MethodCallStatement = {
      type: 'MethodCall',
      object: webUIToken.image,
      method: identToken.image,
      arguments: args,
      lineNumber: webUIToken.startLine,
    };
    statements.push(stmt);
  }

  // Add comments from lexer group (not CST children - comments go to lexer group, not parser)
  for (const c of comments) {
    const stmt: CommentStatement = {
      type: 'Comment',
      text: c.image,
      lineNumber: c.startLine,
    };
    statements.push(stmt);
  }

  // Sort by line number
  statements.sort((a, b) => {
    const lineA = a.type === 'MethodCall' ? a.lineNumber : a.lineNumber;
    const lineB = b.type === 'MethodCall' ? b.lineNumber : b.lineNumber;
    return lineA - lineB;
  });

  return { type: 'Script', statements };
}

function extractArguments(argumentListNodes: any[] | undefined): Argument[] {
  if (!argumentListNodes || argumentListNodes.length === 0) return [];

  const argList = argumentListNodes[0];
  if (!argList.children || !argList.children.argument) return [];

  return argList.children.argument.map((argNode: any) => parseArgument(argNode));
}

function parseArgument(argNode: any): Argument {
  const children = argNode.children;

  if (children.StringLiteral) {
    const raw = children.StringLiteral[0].image;
    // Strip quotes and unescape characters
    const value = raw
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
    return { type: 'string', value };
  }

  if (children.NumberLiteral) {
    return {
      type: 'number',
      value: parseFloat(children.NumberLiteral[0].image),
    };
  }

  if (children.functionCall) {
    const fc = children.functionCall[0];
    const funcToken = fc.children.FindTestObject?.[0] || fc.children.FindTestCase?.[0];
    const args = extractArguments(fc.children.argumentList);
    const funcArg: FunctionCallArgument = {
      type: 'functionCall',
      name: funcToken.image,
      arguments: args,
    };
    return funcArg;
  }

  if (children.Identifier) {
    return { type: 'identifier', value: children.Identifier[0].image };
  }

  throw new Error('Unknown argument type');
}

export function parseScript(script: string): ScriptAST {
  const lexResult = tokenize(script);
  parserInstance.input = lexResult.tokens;

  const cst = parserInstance.script();

  if (parserInstance.errors.length > 0) {
    const err = parserInstance.errors[0];
    const line = err.token?.startLine ?? 0;
    const col = err.token?.startColumn ?? 0;
    throw new Error(
      `[Parse Error] Line ${line}, Col ${col}: ${err.message}`
    );
  }

  return cstToAst(cst, lexResult.groups.comments || []);
}
