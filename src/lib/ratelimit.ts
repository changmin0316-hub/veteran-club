// 간단한 인메모리 로그인 시도 제한 (개발/단일 인스턴스용).
// 운영 다중 인스턴스에서는 Redis 등 공유 저장소로 교체하세요.

type Entry = { count: number; firstAt: number; blockedUntil?: number };

const attempts = new Map<string, Entry>();

const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 10 * 60 * 1000; // 10분 차단

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    attempts.set(key, entry);
    return { allowed: false, retryAfterSec: Math.ceil(BLOCK_MS / 1000) };
  }

  return { allowed: true };
}

export function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
    attempts.set(key, entry);
  }
}

export function resetAttempts(key: string) {
  attempts.delete(key);
}
