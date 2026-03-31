import { createToken, Lexer } from 'chevrotain';

// Identifiers (defined first so keywords can reference it via longer_alt)
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// Keywords (longer_alt ensures WebUITest is tokenized as Identifier, not WebUI + Test)
export const WebUI = createToken({
  name: 'WebUI',
  pattern: /WebUI/,
  longer_alt: Identifier,
});
export const FindTestObject = createToken({
  name: 'FindTestObject',
  pattern: /findTestObject/,
  longer_alt: Identifier,
});
export const FindTestCase = createToken({
  name: 'FindTestCase',
  pattern: /findTestCase/,
  longer_alt: Identifier,
});

// Literals
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
});
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /\d+(\.\d+)?/,
});

// Operators and delimiters
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });

// Skipped tokens
export const Comment = createToken({
  name: 'Comment',
  pattern: /\/\/[^\n\r]*/,
  group: 'comments',
});
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED,
});
export const Newline = createToken({
  name: 'Newline',
  pattern: /\r?\n/,
  group: Lexer.SKIPPED,
});

// Token order: whitespace/comments first, then keywords (before Identifier)
export const allTokens = [
  WhiteSpace,
  Newline,
  Comment,
  WebUI,
  FindTestObject,
  FindTestCase,
  StringLiteral,
  NumberLiteral,
  Dot,
  LParen,
  RParen,
  Comma,
  Identifier,
];

export const GroovyLexer = new Lexer(allTokens);

export function tokenize(script: string) {
  const result = GroovyLexer.tokenize(script);
  if (result.errors.length > 0) {
    const err = result.errors[0];
    throw new Error(
      `[Lexer Error] Line ${err.line}, Col ${err.column}: Unexpected character "${err.message}"`
    );
  }
  return result;
}
