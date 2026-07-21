// 簡易レート制限（同一IPの連続ログイン失敗をブロック）。
// サーバーレス環境ではインスタンスごとのベストエフォートだが、Phase 1の要件としては十分。
const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
