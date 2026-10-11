// Typed error taxonomy. Messages are generic and safe to show to users (SR-8):
// they never contain file names, paths, digests of user files, or stack traces.

export type ErrorCode =
  | 'ABORTED'
  | 'INTERNAL'
  | 'HASH_MISMATCH_INTERNAL'
  | 'FILE_TOO_LARGE'
  | 'OTS_MALFORMED'
  | 'OTS_UNSUPPORTED'
  | 'OTS_TOO_LARGE'
  | 'NET_HOST_NOT_ALLOWED'
  | 'NET_TIMEOUT'
  | 'NET_HTTP'
  | 'NET_TOO_LARGE'
  | 'NET_FAILED'
  | 'STRIP_MALFORMED';

export class UnalteredError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'UnalteredError';
    this.code = code;
  }
}

export function isAbort(e: unknown): boolean {
  return (e instanceof UnalteredError && e.code === 'ABORTED') ||
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError');
}

/** Convert anything thrown into a message safe for the UI. */
export function safeMessage(e: unknown): string {
  if (e instanceof UnalteredError) return e.message;
  if (isAbort(e)) return 'Cancelled.';
  return 'Something went wrong. Please try again.';
}
