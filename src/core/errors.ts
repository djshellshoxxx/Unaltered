// Typed error taxonomy (SR-8): messages are generic and never contain file names, paths or stack traces.
export type ErrorCode =
  | 'ABORTED'
  | 'INPUT_INVALID'
  | 'INPUT_UNREADABLE'
  | 'INTERNAL_HASH_MISMATCH'
  | 'PROOF_TOO_LARGE'
  | 'PROOF_MALFORMED'
  | 'PROOF_UNSUPPORTED'
  | 'NET_BLOCKED'
  | 'NET_TIMEOUT'
  | 'NET_HTTP'
  | 'NET_TOO_LARGE'
  | 'NET_FAILED'
  | 'SOURCE_INVALID';

export class UnalteredError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'UnalteredError';
    this.code = code;
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof UnalteredError && e.code === 'ABORTED';
}

/** Generic, user-safe text for any thrown value. Never exposes stack traces or raw messages from foreign errors. */
export function safeMessage(e: unknown): string {
  if (e instanceof UnalteredError) return e.message;
  return 'Something went wrong.';
}
