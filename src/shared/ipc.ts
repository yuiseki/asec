export const DEFAULT_SECURITY_PORT = 47843;

export type SecurityRequest =
  | {
      type: 'lock_screen_show';
      text: string;
    }
  | {
      type: 'lock_screen_hide';
    };

type WireRequest = {
  type?: string;
  text?: string;
};

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseSecurityRequestLine(line: string): SecurityRequest {
  const trimmed = line.trim();
  if (!trimmed) {
    throw new Error('empty request');
  }

  let parsed: WireRequest;
  try {
    parsed = JSON.parse(trimmed) as WireRequest;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid JSON request: ${reason}`);
  }

  switch (parsed.type) {
    case 'lock_screen_show': {
      const text = ensureString(parsed.text);
      if (!text) {
        throw new Error('lock_screen_show request missing text');
      }
      return {
        type: 'lock_screen_show',
        text,
      };
    }
    case 'lock_screen_hide':
      return {
        type: 'lock_screen_hide',
      };
    default:
      throw new Error(`unsupported request type: ${String(parsed.type ?? '')}`);
  }
}
