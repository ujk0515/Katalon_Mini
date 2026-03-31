import { createToken, Lexer } from 'chevrotain';

// ─── Identifier (must be defined first for longer_alt) ───
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_$][a-zA-Z0-9_$]*/,
});

// ─── Keywords ───
export const Def = createToken({ name: 'Def', pattern: /def/, longer_alt: Identifier });
export const If = createToken({ name: 'If', pattern: /if/, longer_alt: Identifier });
export const Else = createToken({ name: 'Else', pattern: /else/, longer_alt: Identifier });
export const For = createToken({ name: 'For', pattern: /for/, longer_alt: Identifier });
export const In = createToken({ name: 'In', pattern: /in/, longer_alt: Identifier });
export const While = createToken({ name: 'While', pattern: /while/, longer_alt: Identifier });
export const Try = createToken({ name: 'Try', pattern: /try/, longer_alt: Identifier });
export const Catch = createToken({ name: 'Catch', pattern: /catch/, longer_alt: Identifier });
export const Finally = createToken({ name: 'Finally', pattern: /finally/, longer_alt: Identifier });
export const Return = createToken({ name: 'Return', pattern: /return/, longer_alt: Identifier });
export const New = createToken({ name: 'New', pattern: /new/, longer_alt: Identifier });
export const TrueLiteral = createToken({ name: 'TrueLiteral', pattern: /true/, longer_alt: Identifier });
export const FalseLiteral = createToken({ name: 'FalseLiteral', pattern: /false/, longer_alt: Identifier });
export const NullLiteral = createToken({ name: 'NullLiteral', pattern: /null/, longer_alt: Identifier });

// ─── Known API keywords (for better parsing) ───
export const WebUI = createToken({ name: 'WebUI', pattern: /WebUI/, longer_alt: Identifier });
export const FindTestObject = createToken({ name: 'FindTestObject', pattern: /findTestObject/, longer_alt: Identifier });
export const FindTestCase = createToken({ name: 'FindTestCase', pattern: /findTestCase/, longer_alt: Identifier });

// ─── Literals ───
// GString with interpolation: "text ${expr} text" — lexer captures whole, interpreter parses ${}
export const GStringLiteral = createToken({
  name: 'GStringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/,
});
export const SingleQuoteString = createToken({
  name: 'SingleQuoteString',
  pattern: /'(?:[^'\\]|\\.)*'/,
});
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /\d+(\.\d+)?/,
});

// ─── Comparison operators (must come before single-char) ───
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ });
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ });
export const DoubleEqual = createToken({ name: 'DoubleEqual', pattern: /==/ });
export const NotEqual = createToken({ name: 'NotEqual', pattern: /!=/ });
export const And = createToken({ name: 'And', pattern: /&&/ });
export const Or = createToken({ name: 'Or', pattern: /\|\|/ });
export const Arrow = createToken({ name: 'Arrow', pattern: /->/ });
export const PlusPlus = createToken({ name: 'PlusPlus', pattern: /\+\+/ });
export const MinusMinus = createToken({ name: 'MinusMinus', pattern: /--/ });

// ─── Single-char operators ───
export const Equals = createToken({ name: 'Equals', pattern: /=/ });
export const LessThan = createToken({ name: 'LessThan', pattern: /</ });
export const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ });
export const Not = createToken({ name: 'Not', pattern: /!/ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Star = createToken({ name: 'Star', pattern: /\*/ });
export const Slash = createToken({ name: 'Slash', pattern: /\// });
export const Percent = createToken({ name: 'Percent', pattern: /%/ });

// ─── Delimiters ───
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ });
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });

// ─── Skipped ───
export const LineComment = createToken({
  name: 'LineComment',
  pattern: /\/\/[^\n\r]*/,
  group: 'comments',
});
export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
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

// ─── Token order: whitespace first, then multi-char ops, then keywords, then single-char ───
export const groovyAllTokens = [
  // Skipped
  WhiteSpace,
  Newline,
  LineComment,
  BlockComment,
  // Multi-char operators (before single-char)
  Arrow,
  PlusPlus,
  MinusMinus,
  LessEqual,
  GreaterEqual,
  DoubleEqual,
  NotEqual,
  And,
  Or,
  // Keywords (before Identifier)
  Def,
  If,
  Else,
  For,
  In,
  While,
  Try,
  Catch,
  Finally,
  Return,
  New,
  TrueLiteral,
  FalseLiteral,
  NullLiteral,
  WebUI,
  FindTestObject,
  FindTestCase,
  // Literals
  GStringLiteral,
  SingleQuoteString,
  NumberLiteral,
  // Single-char operators
  Equals,
  LessThan,
  GreaterThan,
  Not,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  // Delimiters
  Dot,
  Comma,
  Colon,
  Semicolon,
  LParen,
  RParen,
  LBrace,
  RBrace,
  LBracket,
  RBracket,
  // Identifier (last)
  Identifier,
];

export const GroovyLexerInstance = new Lexer(groovyAllTokens);

export function groovyTokenize(script: string) {
  const result = GroovyLexerInstance.tokenize(script);
  if (result.errors.length > 0) {
    const err = result.errors[0];
    throw new Error(
      `[Groovy Lexer Error] Line ${err.line}, Col ${err.column}: Unexpected character "${err.message}"`
    );
  }
  return result;
}
