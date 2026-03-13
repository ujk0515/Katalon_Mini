/**
 * Groovy Parser: Recursive descent parser that converts tokens to Groovy AST.
 * Supports: variables, control flow, closures, objects, expressions.
 */
import { IToken } from 'chevrotain';
import { groovyTokenize } from './groovyLexer';
import type {
  GroovyScriptAST,
  GroovyStatement,
  GroovyExpression,
  GroovyVarDeclaration,
  GroovyIfStatement,
  GroovyForStatement,
  GroovyWhileStatement,
  GroovyTryCatch,
  GroovyComment,
} from '../../shared/types/ast';

class GroovyParser {
  private tokens: IToken[] = [];
  private comments: IToken[] = [];
  private pos = 0;

  parse(script: string): GroovyScriptAST {
    const lexResult = groovyTokenize(script);
    this.tokens = lexResult.tokens;
    this.comments = lexResult.groups.comments || [];
    this.pos = 0;

    const statements: GroovyStatement[] = [];

    while (!this.isAtEnd()) {
      this.skipSemicolons();
      if (this.isAtEnd()) break;
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    // Insert comments by line number
    for (const c of this.comments) {
      const comment: GroovyComment = {
        type: 'Comment',
        text: c.image,
        lineNumber: c.startLine ?? 0,
      };
      statements.push(comment);
    }
    statements.sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));

    return { type: 'GroovyScript', statements };
  }

  // ─── Statement Parsing ───

  private parseStatement(): GroovyStatement | null {
    const token = this.peek();
    if (!token) return null;

    // Variable declaration: def x = ..., String x = ..., List<...> x = ..., int x = ...
    if (this.isTokenName('Def')) {
      return this.parseVarDeclaration();
    }

    // Type-prefixed declaration: String x = ..., List x = ..., int x = ..., boolean x = ...
    if (this.isTokenName('Identifier') && this.isTypeDeclaration()) {
      return this.parseTypedVarDeclaration();
    }

    if (this.isTokenName('If')) return this.parseIf();
    if (this.isTokenName('For')) return this.parseFor();
    if (this.isTokenName('While')) return this.parseWhile();
    if (this.isTokenName('Try')) return this.parseTryCatch();
    if (this.isTokenName('Return')) return this.parseReturn();

    // Expression statement (assignment, method call, etc.)
    return this.parseExpressionStatement();
  }

  private parseVarDeclaration(): GroovyVarDeclaration {
    const defToken = this.consume('Def');
    const nameToken = this.consume('Identifier');
    let initializer: GroovyExpression | undefined;

    if (this.matchToken('Equals')) {
      initializer = this.parseExpression();
    }
    this.skipSemicolons();

    return {
      type: 'VarDeclaration',
      name: nameToken.image,
      typeAnnotation: 'def',
      initializer,
      lineNumber: defToken.startLine ?? 0,
    };
  }

  private parseTypedVarDeclaration(): GroovyVarDeclaration {
    const typeToken = this.advance(); // type name (String, int, List, etc.)
    let typeName = typeToken.image;

    // Handle generic types: List<WebElement>, Map<String, String>
    if (this.isTokenName('LessThan')) {
      typeName += this.consumeGenericType();
    }

    const nameToken = this.consume('Identifier');
    let initializer: GroovyExpression | undefined;

    if (this.matchToken('Equals')) {
      initializer = this.parseExpression();
    }
    this.skipSemicolons();

    return {
      type: 'VarDeclaration',
      name: nameToken.image,
      typeAnnotation: typeName,
      initializer,
      lineNumber: typeToken.startLine ?? 0,
    };
  }

  private consumeGenericType(): string {
    let result = '';
    let depth = 0;
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (!t) break;
      if (t.tokenType.name === 'LessThan') depth++;
      if (t.tokenType.name === 'GreaterThan') {
        depth--;
        result += this.advance().image;
        if (depth <= 0) break;
        continue;
      }
      result += this.advance().image;
    }
    return result;
  }

  private parseIf(): GroovyIfStatement {
    const ifToken = this.consume('If');
    this.consume('LParen');
    const condition = this.parseExpression();
    this.consume('RParen');
    const thenBlock = this.parseBlock();

    const elseIfBlocks: { condition: GroovyExpression; block: GroovyStatement[] }[] = [];
    let elseBlock: GroovyStatement[] | undefined;

    while (this.isTokenName('Else')) {
      this.advance(); // consume 'else'
      if (this.isTokenName('If')) {
        this.advance(); // consume 'if'
        this.consume('LParen');
        const elifCond = this.parseExpression();
        this.consume('RParen');
        elseIfBlocks.push({ condition: elifCond, block: this.parseBlock() });
      } else {
        elseBlock = this.parseBlock();
        break;
      }
    }

    return {
      type: 'If',
      condition,
      thenBlock,
      elseIfBlocks,
      elseBlock,
      lineNumber: ifToken.startLine ?? 0,
    };
  }

  private parseFor(): GroovyForStatement {
    const forToken = this.consume('For');
    this.consume('LParen');

    // Detect variant: for (x in list) vs for (Type x : list) vs for (int i = 0; i < n; i++)
    // Look ahead to find 'in' keyword, ':' colon, or semicolons
    const savedPos = this.pos;
    let isForIn = false;
    let isForColon = false;

    // Skip optional type/def
    if (this.isTokenName('Def') || this.isTokenName('Identifier')) {
      let lookAhead = this.pos;
      while (lookAhead < this.tokens.length) {
        const t = this.tokens[lookAhead];
        if (t.tokenType.name === 'In') { isForIn = true; break; }
        if (t.tokenType.name === 'Colon') { isForColon = true; break; }
        if (t.tokenType.name === 'Semicolon' || t.tokenType.name === 'RParen') break;
        lookAhead++;
      }
    }
    this.pos = savedPos;

    if (isForIn || isForColon) {
      // for (item in list) or for (def item in list) or for (Type item : list)
      if (this.isTokenName('Def')) this.advance();
      // skip type annotation if present: Type varName or Type<Generic> varName
      if (this.isTokenName('Identifier') && this.peekAt(1)?.tokenType.name === 'Identifier') {
        this.advance(); // skip type
      } else if (this.isTokenName('Identifier') && this.peekAt(1)?.tokenType.name === 'LessThan') {
        // Generic type: List<WebElement> varName
        this.advance(); // skip type name
        this.consumeGenericType(); // skip <...>
      }
      const varToken = this.consume('Identifier');
      // consume 'in' or ':'
      if (this.isTokenName('In')) {
        this.advance();
      } else {
        this.consume('Colon');
      }
      const iterable = this.parseExpression();
      this.consume('RParen');
      const body = this.parseBlock();

      return {
        type: 'For',
        variant: 'forIn',
        variable: varToken.image,
        iterable,
        body,
        lineNumber: forToken.startLine ?? 0,
      };
    } else {
      // Classic for: for (int i = 0; i < n; i++)
      const init = this.parseStatement();
      this.skipSemicolons();
      const condition = this.parseExpression();
      this.consume('Semicolon');
      const update = this.parseExpression();
      this.consume('RParen');
      const body = this.parseBlock();

      return {
        type: 'For',
        variant: 'classic',
        variable: '',
        init: init ?? undefined,
        condition,
        update,
        body,
        lineNumber: forToken.startLine ?? 0,
      };
    }
  }

  private parseWhile(): GroovyWhileStatement {
    const whileToken = this.consume('While');
    this.consume('LParen');
    const condition = this.parseExpression();
    this.consume('RParen');
    const body = this.parseBlock();

    return {
      type: 'While',
      condition,
      body,
      lineNumber: whileToken.startLine ?? 0,
    };
  }

  private parseTryCatch(): GroovyTryCatch {
    const tryToken = this.consume('Try');
    const tryBlock = this.parseBlock();
    let catchVariable: string | undefined;
    let catchBlock: GroovyStatement[] | undefined;
    let finallyBlock: GroovyStatement[] | undefined;

    if (this.isTokenName('Catch')) {
      this.advance();
      this.consume('LParen');
      // catch (ExceptionType varName) or catch (varName)
      const first = this.consume('Identifier');
      if (this.isTokenName('Identifier')) {
        // Type + name
        catchVariable = this.consume('Identifier').image;
      } else {
        catchVariable = first.image;
      }
      this.consume('RParen');
      catchBlock = this.parseBlock();
    }

    if (this.isTokenName('Finally')) {
      this.advance();
      finallyBlock = this.parseBlock();
    }

    return {
      type: 'TryCatch',
      tryBlock,
      catchVariable,
      catchBlock,
      finallyBlock,
      lineNumber: tryToken.startLine ?? 0,
    };
  }

  private parseReturn(): GroovyStatement {
    const retToken = this.consume('Return');
    let value: GroovyExpression | undefined;
    if (!this.isAtEnd() && !this.isTokenName('Semicolon') && !this.isTokenName('RBrace')) {
      value = this.parseExpression();
    }
    this.skipSemicolons();
    return { type: 'Return', value, lineNumber: retToken.startLine ?? 0 };
  }

  private parseExpressionStatement(): GroovyStatement {
    const lineNumber = this.peek()?.startLine ?? 0;
    const expr = this.parseExpression();
    this.skipSemicolons();

    // Check if this is an assignment: expr = value
    if (this.isTokenName('Equals') && !this.isTokenName('DoubleEqual')) {
      // Already handled in parseExpression via assignment detection
    }

    return { type: 'ExpressionStatement', expression: expr, lineNumber };
  }

  // ─── Block Parsing ───

  private parseBlock(): GroovyStatement[] {
    if (this.isTokenName('LBrace')) {
      this.advance();
      const stmts: GroovyStatement[] = [];
      while (!this.isAtEnd() && !this.isTokenName('RBrace')) {
        this.skipSemicolons();
        if (this.isTokenName('RBrace')) break;
        const stmt = this.parseStatement();
        if (stmt) stmts.push(stmt);
      }
      this.consume('RBrace');
      return stmts;
    }
    // Single statement block
    const stmt = this.parseStatement();
    return stmt ? [stmt] : [];
  }

  // ─── Expression Parsing (Precedence Climbing) ───

  private parseExpression(): GroovyExpression {
    return this.parseAssignment();
  }

  private parseAssignment(): GroovyExpression {
    const left = this.parseTernary();

    if (this.isTokenName('Equals')) {
      this.advance();
      const right = this.parseAssignment();
      return { type: 'Assign', target: left, value: right };
    }

    return left;
  }

  private parseTernary(): GroovyExpression {
    const expr = this.parseOr();

    // Not implementing ternary for now to avoid complexity with ? in other contexts
    return expr;
  }

  private parseOr(): GroovyExpression {
    let left = this.parseAnd();
    while (this.isTokenName('Or')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'Binary', operator: '||', left, right };
    }
    return left;
  }

  private parseAnd(): GroovyExpression {
    let left = this.parseEquality();
    while (this.isTokenName('And')) {
      this.advance();
      const right = this.parseEquality();
      left = { type: 'Binary', operator: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): GroovyExpression {
    let left = this.parseComparison();
    while (this.isTokenName('DoubleEqual') || this.isTokenName('NotEqual')) {
      const op = this.advance().image;
      const right = this.parseComparison();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseComparison(): GroovyExpression {
    let left = this.parseAddition();
    while (
      this.isTokenName('LessThan') || this.isTokenName('GreaterThan') ||
      this.isTokenName('LessEqual') || this.isTokenName('GreaterEqual')
    ) {
      const op = this.advance().image;
      const right = this.parseAddition();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseAddition(): GroovyExpression {
    let left = this.parseMultiplication();
    while (this.isTokenName('Plus') || this.isTokenName('Minus')) {
      const op = this.advance().image;
      const right = this.parseMultiplication();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseMultiplication(): GroovyExpression {
    let left = this.parseUnary();
    while (this.isTokenName('Star') || this.isTokenName('Slash') || this.isTokenName('Percent')) {
      const op = this.advance().image;
      const right = this.parseUnary();
      left = { type: 'Binary', operator: op, left, right };
    }
    return left;
  }

  private parseUnary(): GroovyExpression {
    if (this.isTokenName('Not')) {
      this.advance();
      return { type: 'Unary', operator: '!', operand: this.parseUnary() };
    }
    if (this.isTokenName('Minus')) {
      this.advance();
      return { type: 'Unary', operator: '-', operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): GroovyExpression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.isTokenName('Dot')) {
        this.advance();
        const prop = this.consume('Identifier');
        expr = { type: 'Member', object: expr, property: prop.image };

        // Check for call: obj.method(...) or obj.method { closure }
        if (this.isTokenName('LParen')) {
          const args = this.parseCallArguments();
          expr = { type: 'Call', callee: expr, arguments: args };
        } else if (this.isTokenName('LBrace') && this.looksLikeClosure()) {
          // Groovy sugar: obj.method { ... } → obj.method({ ... })
          const closure = this.parseClosure();
          expr = { type: 'Call', callee: expr, arguments: [closure] };
        }
      } else if (this.isTokenName('LBracket')) {
        this.advance();
        const index = this.parseExpression();
        this.consume('RBracket');
        expr = { type: 'Index', object: expr, index };
      } else if (this.isTokenName('LParen') && expr.type === 'Identifier') {
        // Direct function call: funcName(...)
        const args = this.parseCallArguments();
        expr = { type: 'Call', callee: expr, arguments: args };
      } else if (this.isTokenName('PlusPlus')) {
        this.advance();
        // i++ → i = i + 1, return as assignment expression
        expr = {
          type: 'Assign',
          target: expr,
          value: { type: 'Binary', operator: '+', left: expr, right: { type: 'Literal', value: 1 } },
        };
      } else if (this.isTokenName('MinusMinus')) {
        this.advance();
        expr = {
          type: 'Assign',
          target: expr,
          value: { type: 'Binary', operator: '-', left: expr, right: { type: 'Literal', value: 1 } },
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parseCallArguments(): GroovyExpression[] {
    this.consume('LParen');
    const args: GroovyExpression[] = [];

    if (!this.isTokenName('RParen')) {
      args.push(this.parseExpression());
      while (this.matchToken('Comma')) {
        args.push(this.parseExpression());
      }
    }
    this.consume('RParen');

    // Check for trailing closure: method(args) { ... }
    // This is Groovy sugar: list.findAll { el -> ... }
    // But also for method calls with no args: list.findAll { ... }
    // We handle this here by appending closure as last arg
    if (this.isTokenName('LBrace') && this.looksLikeClosure()) {
      args.push(this.parseClosure());
    }

    return args;
  }

  private parsePrimary(): GroovyExpression {
    const token = this.peek();
    if (!token) throw new Error('[Groovy Parse Error] Unexpected end of input');

    // Number
    if (this.isTokenName('NumberLiteral')) {
      const t = this.advance();
      return { type: 'Literal', value: parseFloat(t.image) };
    }

    // String literals
    if (this.isTokenName('GStringLiteral')) {
      return this.parseGString();
    }
    if (this.isTokenName('SingleQuoteString')) {
      const t = this.advance();
      const value = t.image.slice(1, -1)
        .replace(/\\'/g, "'").replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return { type: 'Literal', value };
    }

    // Boolean and null
    if (this.isTokenName('TrueLiteral')) { this.advance(); return { type: 'Literal', value: true }; }
    if (this.isTokenName('FalseLiteral')) { this.advance(); return { type: 'Literal', value: false }; }
    if (this.isTokenName('NullLiteral')) { this.advance(); return { type: 'Literal', value: null }; }

    // new ClassName(...)
    if (this.isTokenName('New')) {
      return this.parseNew();
    }

    // List literal: [...]
    if (this.isTokenName('LBracket')) {
      return this.parseListOrMap();
    }

    // Closure: { ... }
    if (this.isTokenName('LBrace') && this.looksLikeClosure()) {
      return this.parseClosure();
    }

    // Grouped expression: (...)
    if (this.isTokenName('LParen')) {
      this.advance();
      // Check for cast: (Type) expr — only for known type names
      if (this.isTokenName('Identifier') && this.peekAt(1)?.tokenType.name === 'RParen') {
        const castTypes = ['String', 'int', 'Integer', 'long', 'Long', 'double', 'Double',
          'float', 'Float', 'boolean', 'Boolean', 'List', 'Map', 'Set', 'Object',
          'WebElement', 'TestObject'];
        if (castTypes.includes(this.peek()!.image)) {
          const typeToken = this.advance();
          this.consume('RParen');
          const expr = this.parseUnary();
          return { type: 'Cast', targetType: typeToken.image, expression: expr };
        }
      }
      const expr = this.parseExpression();
      this.consume('RParen');
      return expr;
    }

    // Known keywords as identifiers
    if (this.isTokenName('WebUI') || this.isTokenName('FindTestObject') || this.isTokenName('FindTestCase')) {
      const t = this.advance();
      return { type: 'Identifier', name: t.image };
    }

    // Identifier
    if (this.isTokenName('Identifier')) {
      const t = this.advance();
      return { type: 'Identifier', name: t.image };
    }

    throw new Error(
      `[Groovy Parse Error] Line ${token.startLine}, Col ${token.startColumn}: Unexpected token "${token.image}" (${token.tokenType.name})`
    );
  }

  private parseGString(): GroovyExpression {
    const t = this.advance();
    const raw = t.image.slice(1, -1); // Remove quotes

    // Check for ${} interpolation
    if (!raw.includes('${')) {
      const value = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return { type: 'Literal', value };
    }

    // Parse interpolation parts
    const parts: (string | GroovyExpression)[] = [];
    let i = 0;
    let textBuf = '';

    while (i < raw.length) {
      if (raw[i] === '$' && raw[i + 1] === '{') {
        if (textBuf) { parts.push(textBuf); textBuf = ''; }
        i += 2; // skip ${
        let depth = 1;
        let exprStr = '';
        while (i < raw.length && depth > 0) {
          if (raw[i] === '{') depth++;
          else if (raw[i] === '}') { depth--; if (depth === 0) break; }
          exprStr += raw[i];
          i++;
        }
        i++; // skip closing }
        // Parse the inner expression
        try {
          const innerParser = new GroovyParser();
          const innerAst = innerParser.parse(exprStr);
          if (innerAst.statements.length > 0) {
            const stmt = innerAst.statements[0];
            if (stmt.type === 'ExpressionStatement') {
              parts.push(stmt.expression);
            } else {
              parts.push(exprStr); // fallback: treat as string
            }
          }
        } catch {
          parts.push(exprStr);
        }
      } else if (raw[i] === '\\') {
        i++;
        if (raw[i] === 'n') textBuf += '\n';
        else if (raw[i] === 't') textBuf += '\t';
        else if (raw[i] === '"') textBuf += '"';
        else if (raw[i] === '\\') textBuf += '\\';
        else textBuf += raw[i] ?? '';
        i++;
      } else {
        textBuf += raw[i];
        i++;
      }
    }
    if (textBuf) parts.push(textBuf);

    if (parts.length === 1 && typeof parts[0] === 'string') {
      return { type: 'Literal', value: parts[0] };
    }
    return { type: 'StringInterpolation', parts };
  }

  private parseNew(): GroovyExpression {
    this.consume('New');
    const className = this.consume('Identifier').image;
    const args = this.parseCallArguments();
    return { type: 'New', className, arguments: args };
  }

  private parseListOrMap(): GroovyExpression {
    this.consume('LBracket');

    // Empty list: []
    if (this.isTokenName('RBracket')) {
      this.advance();
      return { type: 'List', elements: [] };
    }

    // [:] → empty map
    if (this.isTokenName('Colon') && this.peekAt(1)?.tokenType.name === 'RBracket') {
      this.advance(); // :
      this.advance(); // ]
      return { type: 'Map', entries: [] };
    }

    // Parse first element to determine list vs map
    const first = this.parseExpression();

    if (this.isTokenName('Colon')) {
      // Map literal: [key: value, ...]
      this.advance(); // :
      const firstValue = this.parseExpression();
      const entries = [{ key: first, value: firstValue }];

      while (this.matchToken('Comma')) {
        const key = this.parseExpression();
        this.consume('Colon');
        const value = this.parseExpression();
        entries.push({ key, value });
      }
      this.consume('RBracket');
      return { type: 'Map', entries };
    }

    // List literal: [a, b, c]
    const elements = [first];
    while (this.matchToken('Comma')) {
      elements.push(this.parseExpression());
    }
    this.consume('RBracket');
    return { type: 'List', elements };
  }

  private parseClosure(): GroovyExpression {
    this.consume('LBrace');
    const params: string[] = [];

    // Check for parameters: { el -> ... } or { key, value -> ... }
    const savedPos = this.pos;
    let hasArrow = false;

    // Look ahead for ->
    let lookAhead = this.pos;
    let depth = 0;
    while (lookAhead < this.tokens.length) {
      const t = this.tokens[lookAhead];
      if (t.tokenType.name === 'LBrace') depth++;
      if (t.tokenType.name === 'RBrace') { if (depth === 0) break; depth--; }
      if (depth === 0 && t.tokenType.name === 'Arrow') { hasArrow = true; break; }
      lookAhead++;
    }

    if (hasArrow) {
      // Parse parameters
      while (!this.isTokenName('Arrow')) {
        if (this.isTokenName('Identifier')) {
          params.push(this.advance().image);
        } else if (this.isTokenName('Comma')) {
          this.advance();
        } else {
          break;
        }
      }
      this.consume('Arrow');
    }

    // Parse body
    const body: GroovyStatement[] = [];
    while (!this.isAtEnd() && !this.isTokenName('RBrace')) {
      this.skipSemicolons();
      if (this.isTokenName('RBrace')) break;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.consume('RBrace');

    return { type: 'Closure', parameters: params, body };
  }

  // ─── Helpers ───

  private looksLikeClosure(): boolean {
    // A { after a method call or at statement level is a closure/block
    // Not a map literal (which starts with [)
    return true;
  }

  private isTypeDeclaration(): boolean {
    // Check if current Identifier is a type followed by another Identifier (variable name)
    const current = this.peek();
    const next = this.peekAt(1);
    if (!current || !next) return false;

    const typeName = current.image;
    const knownTypes = ['String', 'int', 'Integer', 'long', 'Long', 'double', 'Double',
      'float', 'Float', 'boolean', 'Boolean', 'List', 'Map', 'Set',
      'WebElement', 'TestObject', 'LogEntries', 'LogEntry', 'WebDriver'];

    if (!knownTypes.includes(typeName)) return false;

    // Next must be Identifier (var name) or < (generic)
    return next.tokenType.name === 'Identifier' || next.tokenType.name === 'LessThan';
  }

  private peek(): IToken | undefined {
    return this.tokens[this.pos];
  }

  private peekAt(offset: number): IToken | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): IToken {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private consume(tokenName: string): IToken {
    const token = this.peek();
    if (!token || token.tokenType.name !== tokenName) {
      const line = token?.startLine ?? '?';
      const col = token?.startColumn ?? '?';
      const got = token ? `"${token.image}" (${token.tokenType.name})` : 'end of input';
      throw new Error(
        `[Groovy Parse Error] Line ${line}, Col ${col}: Expected ${tokenName} but got ${got}`
      );
    }
    return this.advance();
  }

  private matchToken(tokenName: string): boolean {
    if (this.isTokenName(tokenName)) {
      this.advance();
      return true;
    }
    return false;
  }

  private isTokenName(name: string): boolean {
    return this.peek()?.tokenType.name === name;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private skipSemicolons(): void {
    while (this.isTokenName('Semicolon')) {
      this.advance();
    }
  }
}

export function parseGroovyScript(script: string): GroovyScriptAST {
  const parser = new GroovyParser();
  return parser.parse(script);
}
