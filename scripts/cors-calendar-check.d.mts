export interface BrowserReply {
  status?: number;
  bytes?: number[];
  error?: string;
}
export function browserRequest(input: { url: string; bytes?: number[]; accept?: string; timeoutMs?: number; cap?: number }): Promise<BrowserReply>;
export function probePendingCalendar(page: import('@playwright/test').Page, endpoint: string, allowedOrigins: readonly string[]): Promise<{
  host: string;
  post: { status: number | null; length: number | null; error: string | null };
  protocolError?: string;
  pendingLookups: { host: string; status: number | null; length: number | null; error: string | null; classification: string }[];
}>;
