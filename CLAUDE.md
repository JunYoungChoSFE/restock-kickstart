# CLAUDE.md — Pinged (신뢰성 우선 재입고 알림 Shopify 앱)

> **Claude Code는 매 세션 시작 시 이 파일을 먼저 읽는다.** 가드레일을 절대 어기지 않는다.

---

## 0. 제품 한 줄

품절 상품에 "입고 알림" 버튼을 달아 재입고 즉시·확실하게 알림을 보내고, 상인이 발송을 눈으로 확인할 수 있는 Shopify 앱.

---

## 1. 절대 원칙 (가드레일 — 위반 금지)

이 앱의 정체성은 기능 수가 아니라 **신뢰성**이다.

1. **즉시 발송.** 재입고 감지에서 발송까지 수 초 내. 30분 배치 금지. 웹훅 수신 → 큐 → 즉시 처리.
2. **발송 보장.** 큐 + 재시도(지수 백오프) + 멱등성. 한 번 보낸 건 두 번 안 보내고, 실패한 건 재시도한다.
3. **잘못된 발송 금지.** 게시·활성 상품 + 실제 양수 재고일 때만. **초안/미게시/숨김 상품엔 절대 발송 금지** (대표적 불만).
4. **투명성.** 모든 발송을 로그에 남기고 상인이 대시보드에서 본다. "보냈는지 모르겠다"를 없앤다.
5. **정직한 정가.** 알림당 과금 금지. 핵심 기능 페이월 금지. (가드레일 위반은 곧 제품 정체성 붕괴.)
6. **클린 언인스톨 + Polaris + Billing API만.** (Loop와 동일 규칙.)

---

## 2. 기술 스택 (Loop에서 재사용 + 신뢰성 부품 추가)

재사용(이미 검증):
- **Remix** (Shopify CLI 3.x 스캐폴딩) · **Polaris + App Bridge** · **GraphQL Admin API** · **Prisma + Postgres** · **Theme App Extension**(스토어프론트 버튼) · **Shopify Billing API** · **Fly.io/Render** · **TypeScript**.

이 앱에서 추가되는 핵심 부품 (= 신뢰성):
- **백그라운드 큐 + 워커**: BullMQ + Redis (또는 DB 기반 큐). 웹훅은 빨리 응답하고 발송은 워커가 처리.
- **트랜잭셔널 이메일 공급자**: Resend 또는 Postmark (도달률 중시). 발신 도메인 SPF/DKIM/DMARC 인증 필수.
- (v1.1) SMS: Twilio.

> 인증은 `authenticate.admin` 헬퍼. OAuth 직접 구현 금지.

---

## 3. 폴더 구조

```
app/
  routes/
    app._index.tsx            # 대시보드 (대기 수, 발송 성공률, 최근 발송)
    app.waitlist.tsx          # 대기열: 누가 무엇을 기다리는지 (수요 인사이트)
    app.logs.tsx              # 발송 로그 (신뢰의 증거)
    app.settings.tsx          # 버튼 디자인, 이메일 템플릿, 임계치
    app.billing.tsx           # Free / Pro
    api.subscribe.tsx         # 스토어프론트 "입고 알림" 신청 캡처
    webhooks.inventory.tsx    # inventory_levels/update → 재입고 감지 → enqueue
    webhooks.uninstall.tsx    # app/uninstalled → 정리
    webhooks.gdpr.tsx         # GDPR 3종
  jobs/
    sendNotification.ts       # 워커: 발송 + 재시도 + 로그
  lib/
    restock-detect/           # 0→양수 전환 판정 (순수 함수, 테스트)
    email/                    # Resend/Postmark 래퍼
extensions/
  notify-button/              # Theme App Extension (입고 알림 버튼)
prisma/
  schema.prisma
shopify.app.toml
```

---

## 4. 데이터 모델 (Prisma)

- **Shop** — 도메인, 토큰, 플랜(free/pro), 설정.
- **Subscription** — 입고 알림 신청. shopId, productId, variantId, email(+ 추후 phone), channel, status(pending/notified/cancelled), createdAt.
- **NotificationLog** — shopId, subscriptionId, channel, status(sent/failed/retrying), providerMessageId, error, sentAt. **(상인 투명성의 핵심)**
- **Setting** — shopId별 버튼 텍스트/색/위치, 이메일 템플릿, 임계치(qty ≥ N에서 발송), 활성 채널.

> 모든 모델 `shopId` 스코프. 멱등성: 한 Subscription은 한 번만 notified.

---

## 5. 핵심 플로우 (신뢰성 경로)

1. **신청**: 고객이 품절 상품(변형)에서 버튼 클릭 → `api.subscribe`가 Subscription(pending) 생성.
2. **감지**: `inventory_levels/update` 웹훅 → `restock-detect`가 해당 variant가 0(또는 임계치 미만)→양수로 전환됐는지 판정. 게시·활성 + 양수 재고 확인.
3. **enqueue**: 해당 variant의 pending Subscription들을 발송 큐에 넣는다. 웹훅은 즉시 200 응답.
4. **발송(워커)**: `sendNotification` 워커가 이메일 발송 → 성공 시 Subscription=notified + NotificationLog(sent). 실패 시 재시도(백오프), 최종 실패는 NotificationLog(failed)로 남겨 상인이 본다.
5. **멱등성**: 이미 notified면 재발송 금지. 중복 웹훅 안전 처리.

---

## 6. 결제 (Billing API)

- **Free**(월 알림 N건) + **Pro $19/월 flat**(무제한, 알림당 과금 0).
- `appSubscriptionCreate` → confirmationUrl. 무료 한도 초과 시에만 업그레이드 유도. 발송 로그·인사이트는 무료에도 제공(투명성은 페이월 뒤로 숨기지 않음).

---

## 7. 필수 웹훅

- `inventory_levels/update` (또는 products/update) — 재입고 감지.
- `app/uninstalled` — 데이터·주입 버튼 완전 제거.
- `customers/data_request`, `customers/redact`, `shop/redact` — GDPR 필수 3종.

---

## 8. App Store 제출 체크리스트

- [ ] Polaris로 어드민 UI
- [ ] 필수 웹훅 처리 + 클린 언인스톨 + GDPR 3종
- [ ] Billing API로만 과금
- [ ] 이메일 발신 도메인 SPF/DKIM/DMARC 인증 (도달률)
- [ ] 개발 스토어: 신청→재입고→**수 초 내 수신**→로그 기록 전체 확인
- [ ] 초안 상품으로 잘못 발송되지 않는지 확인
- [ ] 리스팅·스크린샷·데모 스토어·지원 이메일
- [ ] 심사 5~10영업일

---

## 9. 코딩 규칙

- `restock-detect`와 발송 판정은 순수 함수 + 단위 테스트(잘못된 발송이 가장 큰 리스크).
- 워커는 멱등·재시도 안전하게. 모든 발송 시도를 로그.
- 모든 DB 쿼리 `shopId` 스코프. 비밀값은 환경변수.
- 단계마다 개발 스토어에서 실제 재입고 시나리오로 검증.
