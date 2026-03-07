export type LockShowCommand = {
  kind: 'lock/show';
  text: string;
};

export type LockHideCommand = {
  kind: 'lock/hide';
};

export type ErrorCommand = {
  kind: 'error';
  message: string;
};

export type SecurityRendererCommand =
  | LockShowCommand
  | LockHideCommand
  | ErrorCommand;
