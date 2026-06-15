# Pinged — 재입고 알림 Shopify 앱 킥스타터

신뢰성 우선 재입고 알림 앱을 Claude Code로 빌드하기 위한 묶음 (다작 파이프라인 2호기).
근거: Back in Stock / Notify Me / Swym / Appikon 등 주요 앱의 실제 리뷰에서 반복된 핵심 불만 — **알림이 제때·확실히 안 간다.** 앱의 유일한 임무가 깨지는 그 빈틈을 신뢰성으로 정면 공략.

## 파일

| 파일 | 용도 | 읽는 주체 |
|---|---|---|
| `01_기획서_PRODUCT_SPEC.md` | 제품 기획서 | 사람 |
| `CLAUDE.md` | 프로젝트 뇌 — 스택·데이터모델·신뢰성 가드레일 | Claude Code (매 세션) |
| `02_BUILD_PROMPTS.md` | Phase 0~6 순차 빌드 프롬프트 | 사람 → Claude Code |

## 쓰는 법

1. 새 폴더에 세 파일을 두고 `CLAUDE.md`를 루트에 둔다.
2. **빌드 전 검증**(기획서 10번): Shopify 커뮤니티에서 "재입고 알림 제때 가요?"로 불만 재현 확인.
3. 선행: Partner 계정 + 개발 스토어(재고 추적 상품 준비) + Node 18+ + Shopify CLI + 트랜잭셔널 이메일 계정(Resend/Postmark).
4. Phase 0부터 순서대로. 각 Phase 후 **실제 재입고 시나리오로 검증.**

## Loop와 공유 / 차이

- **공유(복리)**: Remix · Polaris · App Bridge · GraphQL Admin · Prisma · Theme App Extension · Billing API · 클린 언인스톨 · GDPR. → Loop를 만들었다면 Phase 0~2가 빠르다.
- **차이(이 앱의 코어)**: **신뢰 발송 파이프라인** = 큐(BullMQ+Redis) + 워커 + 재시도 + 멱등성 + **발송 로그**, 그리고 트랜잭셔널 이메일 도달률(도메인 인증).

## 한 줄 마인드셋

> 무기는 기능 수가 아니라 **"한 가지를 진짜로 확실히 한다"**. 알림은 반드시 가고, 상인은 그걸 눈으로 본다.
