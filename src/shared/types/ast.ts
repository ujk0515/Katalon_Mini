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
