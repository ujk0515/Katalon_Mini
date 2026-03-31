// ─── 기존 WebUI 전용 AST (하위 호환) ───

export interface ScriptAST {
  type: 'Script';
  statements: Statement[];
}

export type Statement = MethodCallStatement | CommentStatement;

export interface MethodCallStatement {
  type: 'MethodCall';
  object: string;
  method: string;
  arguments: Argument[];
  lineNumber: number;
}

export interface CommentStatement {
  type: 'Comment';
  text: string;
  lineNumber: number;
}

export type Argument =
  | StringArgument
  | NumberArgument
  | FunctionCallArgument
  | IdentifierArgument;

export interface StringArgument {
  type: 'string';
  value: string;
}

export interface NumberArgument {
  type: 'number';
  value: number;
}

export interface FunctionCallArgument {
  type: 'functionCall';
  name: string;
  arguments: Argument[];
}

export interface IdentifierArgument {
  type: 'identifier';
  value: string;
}

export interface PlaywrightCommand {
  action: string;
  selector?: string;
  value?: string;
  timeout?: number;
  lineNumber: number;
  testCasePath?: string;
}

// ─── Groovy 확장 AST ───

export interface GroovyScriptAST {
  type: 'GroovyScript';
  statements: GroovyStatement[];
}

export type GroovyStatement =
  | GroovyVarDeclaration
  | GroovyAssignment
  | GroovyIfStatement
  | GroovyForStatement
  | GroovyWhileStatement
  | GroovyTryCatch
  | GroovyExpressionStatement
  | GroovyComment
  | GroovyReturnStatement;

export interface GroovyVarDeclaration {
  type: 'VarDeclaration';
  name: string;
  typeAnnotation?: string;
  initializer?: GroovyExpression;
  lineNumber: number;
}

export interface GroovyAssignment {
  type: 'Assignment';
  target: GroovyExpression;
  value: GroovyExpression;
  lineNumber: number;
}

export interface GroovyIfStatement {
  type: 'If';
  condition: GroovyExpression;
  thenBlock: GroovyStatement[];
  elseIfBlocks: { condition: GroovyExpression; block: GroovyStatement[] }[];
  elseBlock?: GroovyStatement[];
  lineNumber: number;
}

export interface GroovyForStatement {
  type: 'For';
  variant: 'forIn' | 'classic';
  variable: string;
  iterable?: GroovyExpression;
  init?: GroovyStatement;
  condition?: GroovyExpression;
  update?: GroovyExpression;
  body: GroovyStatement[];
  lineNumber: number;
}

export interface GroovyWhileStatement {
  type: 'While';
  condition: GroovyExpression;
  body: GroovyStatement[];
  lineNumber: number;
}

export interface GroovyTryCatch {
  type: 'TryCatch';
  tryBlock: GroovyStatement[];
  catchVariable?: string;
  catchBlock?: GroovyStatement[];
  finallyBlock?: GroovyStatement[];
  lineNumber: number;
}

export interface GroovyExpressionStatement {
  type: 'ExpressionStatement';
  expression: GroovyExpression;
  lineNumber: number;
}

export interface GroovyComment {
  type: 'Comment';
  text: string;
  lineNumber: number;
}

export interface GroovyReturnStatement {
  type: 'Return';
  value?: GroovyExpression;
  lineNumber: number;
}

// ─── Expression 타입 ───

export type GroovyExpression =
  | LiteralExpr
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | MemberExpr
  | CallExpr
  | IndexExpr
  | NewExpr
  | ClosureExpr
  | ListExpr
  | MapExpr
  | StringInterpolationExpr
  | TernaryExpr
  | AssignExpr
  | CastExpr;

export interface LiteralExpr {
  type: 'Literal';
  value: string | number | boolean | null;
}

export interface IdentifierExpr {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpr {
  type: 'Binary';
  operator: string;
  left: GroovyExpression;
  right: GroovyExpression;
}

export interface UnaryExpr {
  type: 'Unary';
  operator: string;
  operand: GroovyExpression;
}

export interface MemberExpr {
  type: 'Member';
  object: GroovyExpression;
  property: string;
}

export interface CallExpr {
  type: 'Call';
  callee: GroovyExpression;
  arguments: GroovyExpression[];
}

export interface IndexExpr {
  type: 'Index';
  object: GroovyExpression;
  index: GroovyExpression;
}

export interface NewExpr {
  type: 'New';
  className: string;
  arguments: GroovyExpression[];
}

export interface ClosureExpr {
  type: 'Closure';
  parameters: string[];
  body: GroovyStatement[];
}

export interface ListExpr {
  type: 'List';
  elements: GroovyExpression[];
}

export interface MapExpr {
  type: 'Map';
  entries: { key: GroovyExpression; value: GroovyExpression }[];
}

export interface StringInterpolationExpr {
  type: 'StringInterpolation';
  parts: (string | GroovyExpression)[];
}

export interface TernaryExpr {
  type: 'Ternary';
  condition: GroovyExpression;
  consequent: GroovyExpression;
  alternate: GroovyExpression;
}

export interface AssignExpr {
  type: 'Assign';
  target: GroovyExpression;
  value: GroovyExpression;
}

export interface CastExpr {
  type: 'Cast';
  targetType: string;
  expression: GroovyExpression;
}
