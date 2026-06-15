# 02 — Claude Code 빌드 프롬프트 (순서대로)

> 각 Phase를 순서대로 Claude Code에 붙여넣는다. 한 Phase 끝나면 **개발 스토어에서 실제 재입고 시나리오로 검증** 후 다음. 매 세션 Claude Code는 `CLAUDE.md`를 먼저 읽는다.
> Loop를 이미 만들었다면 Phase 0~2는 패턴 재사용으로 훨씬 빠르다.

---

## Phase 0 — 환경 & 스캐폴딩

> 선행(사람): Shopify Partner 계정 + 개발 스토어 + Node 18+ + `@shopify/cli`. 재입고 테스트를 위해 개발 스토어에 재고 추적 상품 1~2개 준비.

```
이 프로젝트는 CLAUDE.md에 정의된 "Pinged" — 신뢰성 우선 재입고 알림 Shopify 앱이다.
먼저 CLAUDE.md를 읽어라. 그 다음:
1. Shopify CLI로 Remix 앱을 스캐폴딩한다 (TypeScript).
2. Prisma를 Postgres로 설정. 백그라운드 작업용 Redis + BullMQ도 설정한다.
3. shopify.app.toml에 scopes(read products/inventory, write 없음 우선, customers 최소)와 필수 웹훅(inventory_levels/update, app/uninstalled, GDPR 3종)을 등록한다.
4. 개발 스토어에 설치해 임베디드 어드민이 빈 화면으로라도 뜨는 것까지 확인하고 멈춰라.
authenticate.admin 헬퍼 사용, OAuth 직접 구현 금지.
```

## Phase 1 — 데이터 모델 + 재입고 감지 (가장 중요)

```
CLAUDE.md 4·5번 기준:
1. Prisma에 Shop, Subscription, NotificationLog, Setting 모델을 만든다. 모든 모델 shopId 스코프, Subscription에 멱등성용 status.
2. lib/restock-detect/ 에 "해당 variant가 0(또는 임계치 미만)→양수로 전환됐는가"를 판정하는 순수 함수를 작성하고 단위 테스트를 붙인다. 게시·활성 + 양수 재고 조건 포함.
3. inventory_levels/update 웹훅 핸들러: 전환 감지 시 해당 variant의 pending Subscription을 식별만 하고(아직 발송 X), 웹훅은 즉시 200 응답한다.
잘못된 발송(초안/미게시 상품)이 절대 일어나지 않도록 판정 테스트를 충분히 작성하라. 이게 1순위 리스크다.
```

## Phase 2 — 신뢰 발송 파이프라인 (큐 + 워커 + 로그)

```
CLAUDE.md 1·2·5번대로 발송 파이프라인을 만든다:
1. Phase 1에서 식별된 Subscription들을 BullMQ 큐에 넣는다.
2. jobs/sendNotification 워커: 트랜잭셔널 이메일 공급자(Resend 또는 Postmark)로 발송한다. lib/email/ 래퍼로 분리.
3. 성공 → Subscription=notified + NotificationLog(sent). 실패 → 지수 백오프 재시도, 최종 실패는 NotificationLog(failed).
4. 멱등성: 이미 notified면 재발송 금지. 중복 웹훅 안전.
개발 스토어에서 상품을 품절→재입고시켜 수 초 내 테스트 메일이 오고 NotificationLog에 기록되는지 확인하는 법을 알려줘라.
발신 도메인 SPF/DKIM/DMARC 설정 가이드도 같이.
```

## Phase 3 — 스토어프론트 "입고 알림" 버튼 (Theme App Extension)

```
extensions/notify-button 에 Theme App Extension을 만든다:
1. 품절(변형 포함) 상태일 때 상품 페이지에 "입고 알림" 버튼을 띄운다.
2. 클릭 → 이메일 입력 → api.subscribe로 Subscription(pending) 생성.
3. Setting의 색/텍스트/위치를 반영하고, 커스텀 CSS 없이도 on-brand로 깔끔하게.
4. variant별로 정확히 신청되게 한다.
개발 스토어 테마에서 버튼이 품절 변형에만 뜨고 신청이 저장되는지 확인.
```

## Phase 4 — 어드민 UI (Polaris) + 발송 로그 + 수요 인사이트

```
Polaris로 어드민을 만든다 (커스텀 컴포넌트 금지):
1. app._index: 대시보드 — 대기 수, 발송 성공률, 최근 발송.
2. app.logs: 발송 로그 (수신자 수·시각·성공/실패). 이게 신뢰의 증거다. 무료 플랜에도 노출.
3. app.waitlist: "어떤 상품/변형에 몇 명 대기 중" — 재주문 판단을 돕는 수요 인사이트.
4. app.settings: 버튼 디자인, 이메일 템플릿, 임계치, 채널.
```

## Phase 5 — 결제 (Billing API)

```
CLAUDE.md 6번대로:
1. Free(월 알림 N건) + Pro($19/월 flat, 무제한, 알림당 과금 0) 두 플랜.
2. appSubscriptionCreate → confirmationUrl 리다이렉트.
3. 무료 한도 초과 시에만 업그레이드 유도. 발송 로그·인사이트는 무료에도 제공(투명성은 페이월 뒤로 숨기지 않음).
외부 결제 금지.
```

## Phase 6 — 클린 언인스톨 + GDPR + 제출 준비

```
출시 조건 마무리:
1. app/uninstalled: 데이터 + 주입한 버튼/블록 완전 제거. 흔적 0.
2. GDPR 3종 구현.
3. CLAUDE.md 8번 체크리스트 점검. 특히 "초안 상품 오발송 안 됨" + "재입고 수 초 내 수신" 두 가지를 집중 테스트.
4. 개발 스토어에서 신청→재입고→수신→로그 전체 플로우를 끝까지 확인하고, 삭제 후 흔적이 없는지 확인.
```

---

## 1~2주 일정 (참고, Loop 경험 시 단축)

- **1주차**: Phase 0~2 (스캐폴딩, 감지, 발송 파이프라인 — 신뢰성 코어)
- **2주차**: Phase 3~6 (버튼, 어드민, 결제, 제출)
- 심사 5~10영업일은 별도.
