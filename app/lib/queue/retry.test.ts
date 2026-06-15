import { describe, it, expect } from "vitest";
import {
  backoffDelayMs,
  nextJobState,
  DEFAULT_BASE_MS,
  DEFAULT_CAP_MS,
} from "./retry";

describe("backoffDelayMs — 지수 백오프", () => {
  it("1회 → base, 2회 → 2·base, 3회 → 4·base", () => {
    expect(backoffDelayMs(1, 1000)).toBe(1000);
    expect(backoffDelayMs(2, 1000)).toBe(2000);
    expect(backoffDelayMs(3, 1000)).toBe(4000);
  });

  it("cap을 넘지 않는다", () => {
    expect(backoffDelayMs(100, 1000, 5000)).toBe(5000);
  });

  it("0/음수 시도는 1회로 보정", () => {
    expect(backoffDelayMs(0, 1000)).toBe(1000);
    expect(backoffDelayMs(-3, 1000)).toBe(1000);
  });

  it("기본값으로도 동작(base 30s, cap 1h)", () => {
    expect(backoffDelayMs(1)).toBe(DEFAULT_BASE_MS);
    expect(backoffDelayMs(50)).toBe(DEFAULT_CAP_MS);
  });
});

describe("nextJobState", () => {
  const state = { attempts: 0, maxAttempts: 5 };

  it("성공 → done, 시도수 +1", () => {
    expect(nextJobState(state, { ok: true })).toEqual({
      status: "done",
      attempts: 1,
    });
  });

  it("첫 실패 → queued, 백오프 예약", () => {
    expect(
      nextJobState(state, { ok: false, error: "smtp 500" }, { baseMs: 1000 }),
    ).toEqual({ status: "queued", attempts: 1, runAtDelayMs: 1000 });
  });

  it("재시도 누적: attempts=3에서 실패 → queued, 4번째 백오프", () => {
    expect(
      nextJobState({ attempts: 3, maxAttempts: 5 }, { ok: false, error: "x" }, { baseMs: 1000 }),
    ).toEqual({ status: "queued", attempts: 4, runAtDelayMs: 8000 });
  });

  it("마지막 시도 실패(attempts 도달) → failed, 마지막 에러 보존", () => {
    expect(
      nextJobState({ attempts: 4, maxAttempts: 5 }, { ok: false, error: "gave up" }),
    ).toEqual({ status: "failed", attempts: 5, lastError: "gave up" });
  });

  it("maxAttempts=1이면 한 번 실패에 바로 failed", () => {
    expect(
      nextJobState({ attempts: 0, maxAttempts: 1 }, { ok: false, error: "boom" }),
    ).toEqual({ status: "failed", attempts: 1, lastError: "boom" });
  });
});
