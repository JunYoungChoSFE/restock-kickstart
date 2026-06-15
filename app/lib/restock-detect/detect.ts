// 재입고 감지 엔진 (CLAUDE.md 1·5절 — 1순위 리스크).
//
// 단 하나의 책임: "이 variant 재고 변화가 알림을 쏠 만한 '진짜 재입고'인가?"를 판정한다.
// 순수 함수 — DB·네트워크·Shopify 호출 없음. 그래서 빠짐없이 단위 테스트할 수 있다.
//
// 절대 규칙(가드레일):
//  - 게시(Online Store) + ACTIVE 상태 + 실제 양수 재고일 때만 발송.
//  - 초안/미게시/보관(draft/unpublished/archived) 상품엔 절대 발송 금지 (대표적 오발송 불만).
//  - 0(또는 임계치 미만) → 임계치 이상으로 "전환"될 때만. 이미 재고 있던 건 재발송 금지.

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface RestockSignal {
  /** 이번 업데이트 '직전'의 variant 가용 재고(여러 location 합산). 모르면 null. */
  previousAvailable: number | null;
  /** 이번 업데이트 '직후'의 variant 가용 재고(여러 location 합산). */
  newAvailable: number;
  /** 상인이 설정한 발송 최소 수량(Setting.threshold). 1 미만은 1로 본다. */
  threshold: number;
  /** Shopify 상품 상태. */
  productStatus: ProductStatus;
  /** Online Store 판매 채널에 게시되어 고객이 실제로 볼 수 있는가. */
  publishedToOnlineStore: boolean;
}

export type SkipReason =
  | "product_not_active" // ACTIVE 아님 (draft/archived) → 오발송 위험, 차단
  | "product_not_published" // Online Store 미게시 → 고객이 못 봄, 차단
  | "below_threshold" // 새 재고가 임계치 미만 (0 포함)
  | "no_transition"; // 이미 임계치 이상이었음 — 전환 아님 (재발송 방지)

export type RestockDecision =
  | { fire: true }
  | { fire: false; reason: SkipReason };

/**
 * 알림을 쏠지 판정한다. 검사 순서 = 위험도 우선:
 *   상태 → 게시 → 임계치 → 전환.
 * (가장 큰 리스크인 "초안 오발송"을 가장 먼저 끊는다.)
 */
export function decideRestock(signal: RestockSignal): RestockDecision {
  // threshold는 항상 최소 1 — 0 이하면 "재고 0에도 발송" 같은 사고를 막는다.
  const threshold = Math.max(1, Math.floor(signal.threshold || 1));

  if (signal.productStatus !== "ACTIVE") {
    return { fire: false, reason: "product_not_active" };
  }
  if (!signal.publishedToOnlineStore) {
    return { fire: false, reason: "product_not_published" };
  }

  // threshold >= 1 이므로 '임계치 이상'은 곧 '양수 재고'를 보장한다.
  const nowAtOrAbove = signal.newAvailable >= threshold;
  if (!nowAtOrAbove) {
    return { fire: false, reason: "below_threshold" };
  }

  // 전환 판정: 직전이 임계치 '미만'(또는 미상)이었어야 진짜 재입고.
  const prev = signal.previousAvailable;
  const previouslyBelow = prev === null || prev < threshold;
  if (!previouslyBelow) {
    return { fire: false, reason: "no_transition" };
  }

  return { fire: true };
}

/** 판정이 발송으로 이어지는지 단순 boolean으로 알고 싶을 때. */
export function shouldNotify(signal: RestockSignal): boolean {
  return decideRestock(signal).fire;
}
