// 발송 잡 재시도/백오프 — 순수 함수 (CLAUDE.md 1·2절: 발송 보장 = 재시도 + 백오프 + 멱등).
//
// "한 번의 발송 시도 결과"를 받아 잡의 다음 상태를 결정한다. DB·시간·네트워크 없음 → 전부 테스트.

export interface JobAttemptState {
  /** 이번 시도 '이전'까지의 누적 시도 횟수. */
  attempts: number;
  /** 이 횟수에 도달하면 더 재시도하지 않고 failed. */
  maxAttempts: number;
}

export type SendOutcome = { ok: true } | { ok: false; error: string };

export type JobTransition =
  | { status: "done"; attempts: number }
  | { status: "queued"; attempts: number; runAtDelayMs: number } // 재시도 예약
  | { status: "failed"; attempts: number; lastError: string }; // 포기

export const DEFAULT_BASE_MS = 30_000; // 30초
export const DEFAULT_CAP_MS = 60 * 60_000; // 1시간

/**
 * 지수 백오프 지연(ms). attempts = 이번에 실패한 시도 번호(1-base).
 *  1→base, 2→2·base, 3→4·base … cap에서 멈춤.
 */
export function backoffDelayMs(
  attempts: number,
  baseMs: number = DEFAULT_BASE_MS,
  capMs: number = DEFAULT_CAP_MS,
): number {
  const n = Math.max(1, Math.floor(attempts));
  const delay = baseMs * 2 ** (n - 1);
  return Math.min(delay, capMs);
}

/**
 * 한 번의 발송 결과로 잡의 다음 상태를 결정.
 *  - 성공 → done.
 *  - 실패 + 최대치 도달 → failed (로그에 마지막 에러).
 *  - 실패 + 여유 있음 → queued(백오프 후 재시도).
 */
export function nextJobState(
  state: JobAttemptState,
  outcome: SendOutcome,
  opts: { baseMs?: number; capMs?: number } = {},
): JobTransition {
  const attempts = state.attempts + 1; // 이번 시도 반영

  if (outcome.ok) {
    return { status: "done", attempts };
  }
  if (attempts >= state.maxAttempts) {
    return { status: "failed", attempts, lastError: outcome.error };
  }
  return {
    status: "queued",
    attempts,
    runAtDelayMs: backoffDelayMs(attempts, opts.baseMs, opts.capMs),
  };
}
