import { describe, it, expect } from "vitest";
import { decideRestock, shouldNotify, type RestockSignal } from "./detect";

// 정상 재입고의 기본형: 0→5, ACTIVE, 게시, 임계치 1.
const base: RestockSignal = {
  previousAvailable: 0,
  newAvailable: 5,
  threshold: 1,
  productStatus: "ACTIVE",
  publishedToOnlineStore: true,
};

describe("decideRestock — 발송해야 하는 경우", () => {
  it("0 → 양수 전환이면 발송", () => {
    expect(decideRestock(base)).toEqual({ fire: true });
  });

  it("직전 재고 미상(null)이면 '미만'으로 보고 발송", () => {
    expect(decideRestock({ ...base, previousAvailable: null })).toEqual({
      fire: true,
    });
  });

  it("임계치 경계: threshold=10, 0→12면 발송", () => {
    expect(
      decideRestock({ ...base, threshold: 10, previousAvailable: 0, newAvailable: 12 }),
    ).toEqual({ fire: true });
  });

  it("임계치 경계: threshold=10, 8(미만)→10(도달)이면 발송", () => {
    expect(
      decideRestock({ ...base, threshold: 10, previousAvailable: 8, newAvailable: 10 }),
    ).toEqual({ fire: true });
  });
});

describe("decideRestock — 절대 발송하면 안 되는 경우 (오발송 차단)", () => {
  it("DRAFT 상품은 차단 (재고가 들어와도)", () => {
    expect(decideRestock({ ...base, productStatus: "DRAFT" })).toEqual({
      fire: false,
      reason: "product_not_active",
    });
  });

  it("ARCHIVED 상품은 차단", () => {
    expect(decideRestock({ ...base, productStatus: "ARCHIVED" })).toEqual({
      fire: false,
      reason: "product_not_active",
    });
  });

  it("Online Store 미게시 상품은 차단", () => {
    expect(decideRestock({ ...base, publishedToOnlineStore: false })).toEqual({
      fire: false,
      reason: "product_not_published",
    });
  });

  it("상태 검사가 게시 검사보다 우선 (둘 다 위반이면 not_active)", () => {
    expect(
      decideRestock({
        ...base,
        productStatus: "DRAFT",
        publishedToOnlineStore: false,
      }),
    ).toEqual({ fire: false, reason: "product_not_active" });
  });
});

describe("decideRestock — 임계치 미만", () => {
  it("새 재고 0이면 차단", () => {
    expect(decideRestock({ ...base, newAvailable: 0 })).toEqual({
      fire: false,
      reason: "below_threshold",
    });
  });

  it("음수 재고면 차단", () => {
    expect(decideRestock({ ...base, newAvailable: -3 })).toEqual({
      fire: false,
      reason: "below_threshold",
    });
  });

  it("threshold=10인데 0→5면 미달로 차단", () => {
    expect(
      decideRestock({ ...base, threshold: 10, previousAvailable: 0, newAvailable: 5 }),
    ).toEqual({ fire: false, reason: "below_threshold" });
  });
});

describe("decideRestock — 전환 아님 (재발송 방지)", () => {
  it("5 → 6 (이미 재고 있었음)은 차단", () => {
    expect(
      decideRestock({ ...base, previousAvailable: 5, newAvailable: 6 }),
    ).toEqual({ fire: false, reason: "no_transition" });
  });

  it("threshold=10, 11→12 (둘 다 임계치 이상)은 차단", () => {
    expect(
      decideRestock({ ...base, threshold: 10, previousAvailable: 11, newAvailable: 12 }),
    ).toEqual({ fire: false, reason: "no_transition" });
  });
});

describe("decideRestock — threshold 방어", () => {
  it("threshold=0이면 1로 보정 → 0→1 발송", () => {
    expect(
      decideRestock({ ...base, threshold: 0, previousAvailable: 0, newAvailable: 1 }),
    ).toEqual({ fire: true });
  });

  it("threshold 음수면 1로 보정 → 0→0은 여전히 차단", () => {
    expect(
      decideRestock({ ...base, threshold: -5, newAvailable: 0 }),
    ).toEqual({ fire: false, reason: "below_threshold" });
  });
});

describe("shouldNotify (boolean 헬퍼)", () => {
  it("발송 케이스는 true", () => {
    expect(shouldNotify(base)).toBe(true);
  });
  it("초안 케이스는 false", () => {
    expect(shouldNotify({ ...base, productStatus: "DRAFT" })).toBe(false);
  });
});
