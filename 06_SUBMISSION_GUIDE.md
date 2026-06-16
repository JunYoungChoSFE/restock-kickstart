# 06 — Pinged 출시·제출 가이드 (배포 + 리스팅 + 제출)

> 행동(내가 직접)은 한국어, App Store에 들어갈 값은 영어. Roost(loop-kickstart)의 14_심사제출 경험 반영.
> **Pinged는 PCD 불필요** — `read_products`/`read_inventory`만 쓰고 Shopify 고객/주문 API를 안 읽음(이메일은 스토어프론트 직접 수집). 그래서 Roost보다 단계가 적다.

---

## PART 0 — 코드 상태 (이미 완료)

- Phase 1~5 + 라이브 dev 실증 완료. typecheck clean, 45 테스트 green.
- 배포 파일 준비됨: `Dockerfile`, `fly.toml`, `dbsetup.js`, `litestream.yml`.
- 개인정보방침 초안: `08_PRIVACY_POLICY_EN.md`. 도달률 가이드: `DELIVERABILITY.md`.

---

## PART 1 — 내가 직접 할 일 (순서대로)

### STEP 1 — 이메일 도달률 (출시 전 필수) — `DELIVERABILITY.md`
- 발신 도메인(예: `pinged.app`) 확보 → Resend에 등록 → **SPF/DKIM/DMARC** DNS 추가 → Verify.
- `EMAIL_FROM`을 인증 도메인 주소로. (안 하면 알림이 전부 스팸 → 제품 가치 붕괴.)
- **[확인]** 인증 도메인에서 보낸 테스트 메일이 **인박스**에 도착.

### STEP 2 — 프로덕션 배포 (Fly)
```powershell
# flyctl 설치돼 있음. restock-kickstart 폴더에서:
flyctl launch --no-deploy        # 기존 fly.toml 사용. 앱 이름이 겹치면 바꾸고 toml·SHOPIFY_APP_URL도 맞춤
flyctl volumes create data --size 1 --region nrt
flyctl secrets set SHOPIFY_API_SECRET=<Dev Dashboard의 시크릿> RESEND_API_KEY=<re_...> "EMAIL_FROM=Pinged <notify@pinged.app>" CRON_SECRET=<아무 랜덤문자열>
flyctl deploy
```
- **[확인]** 시크릿 창에서 `https://pinged-restock.fly.dev` 200.

### STEP 3 — Shopify 앱 URL을 프로덕션으로 고정
- `shopify.app.pinged.toml`의 `application_url`/`redirect_urls`/`[app_proxy].url`을 **fly URL**로 (지금 placeholder `pinged.fly.dev`).
- 그다음:
```powershell
shopify app deploy
```
- **[확인]** Dev Dashboard에서 App URL = fly URL, webhooks·app_proxy 반영.
- ⚠️ 이후 `shopify app dev`를 또 돌리면 URL이 터널로 바뀌니, 끝나면 다시 `shopify app deploy`로 복원(Roost 교훈).

### STEP 4 — 개인정보방침 공개 URL
- `08_PRIVACY_POLICY_EN.md`를 **public**으로 호스팅(이 repo를 public 전환하거나 별도). 비로그인 200 확인.
- repo: `https://github.com/JunYoungChoSFE/restock-kickstart/blob/main/08_PRIVACY_POLICY_EN.md`

### STEP 5 — 개발 스토어 E2E (이미 라이브로 검증함)
- 신청→재입고→발송→로그 전체 플로우 + 초안 상품 오발송 안 됨 + 클린 언인스톨. (오늘 dev에서 통과.)

### STEP 6 — 스크린샷 3~5장
- ① 대시보드(자동 안내 배너+통계) ② 발송 로그(sent) ③ 스토어프론트 "입고 알림" 버튼 ④ Waitlist ⑤ Plan(Free/Pro).
- 1280×720↑, 개인정보 가림.

### STEP 7 — 데모 영상 (권장)
- 워크스루: 버튼 추가 → 신청 → 재입고 → 수 초 내 메일 + 발송 로그. (Roost의 10_DEMO 스크립트 방식 재사용. 자막 영어.)

### STEP 8 — 리스팅 입력 + 제출
- 아래 PART 2 값 복붙 → 스크린샷·영상 → **Submit for review**.

---

## PART 2 — App Store 리스팅 값 (복붙)

> ⚠️ **App icon**: 이 폼 칸이 아니라 **Dev Dashboard → Pinged 앱 App setup의 App icon**에 `pinged-icon.png` 업로드 → 여기 자동 동기화.
> ✅ **App category**: `Marketing and conversion › Upsell and bundles › Stock alerts` (정확). 하위 태그 Auto-alerts / Notification button / Customer demand 그대로.

**Name** (⚠️ **≤30자** — 길면 단어 중간에서 잘림)
```
Pinged: Back-in-Stock Alerts
```

**App introduction** (⚠️ **≤100자** — 길면 잘림. pricing 단어 금지)
```
Add a notify-me button to sold-out products and email customers within seconds of a restock.
```

**App details** (≤500자, pricing 단어/링크 금지)
```
Pinged adds a "notify me" button to your sold-out product pages. When a customer subscribes and the product is restocked by any method, Pinged emails them within seconds rather than on a slow batch. Every send is recorded in a log so you can prove the alert went out, and a waitlist shows which products customers want back the most. Setup takes a few minutes with no code, and the button matches your brand color.
```

**Features** (3~5, 각 ≤80자)
```
Instant alerts — subscribers are emailed within seconds of a restock, not a batch
Send log — every notification is recorded with its status, so you know it went out
No wrong sends — only published, in-stock products trigger emails, never drafts
Waitlist demand insight — see which sold-out products have the most customers waiting
No-code storefront button that matches your brand color
```

**Pricing details** (플랜 2개 추가. ⚠️ "approval to charge outside Billing API" 체크 X)
```
Free — price 0          — Notify button, instant sends, and the send log. Up to 50 notifications per month.
Pro  — price 19 / month — Unlimited notifications. No per-alert fees, no hidden costs.
```

**App card subtitle** (≤62)
```
Reliable back-in-stock alerts with a send log you can trust
```

**Search terms** (1~5)
```
back in stock, restock, notify me, inventory alert, waitlist
```

**Web search content** (선택)
- Title tag: `Pinged — Reliable Back-in-Stock Alerts for Shopify`
- Meta description: `Add a notify-me button to sold-out products and email customers within seconds of a restock — with a send log you can trust. Five-minute setup, no code.`

**Feature media**
- **Video** 탭 → Video URL: `https://www.youtube.com/embed/<영상ID>` + 썸네일에 스크린샷 1장
- 또는 **Image** 탭 → 1600×900 이미지(원하면 배너 만들어줌)

**Screenshots** (≥3, 각 alt text 필수)
```
1. Pinged dashboard with waiting, notified and recent sends
2. Send log showing each notification with sent status
3. Storefront notify-me button on a sold-out product
4. Waitlist of products customers are waiting for
5. Plan page — Free and Pro
```

**Install requirements**: **Shopify Online Store 선택** (Theme App Extension 버튼).

**App setup**
| 필드 | 값 |
|---|---|
| App URL | `https://pinged-restock.fly.dev` |
| Allowed redirection URL(s) | `https://pinged-restock.fly.dev/auth/callback`, `https://pinged-restock.fly.dev/auth/shopify/callback`, `https://pinged-restock.fly.dev/api/auth/callback` |
| GDPR mandatory webhooks | `https://pinged-restock.fly.dev/webhooks/compliance` |

**Support email**: `liger4903@gmail.com`
**Privacy policy URL**: `https://github.com/JunYoungChoSFE/restock-kickstart/blob/main/08_PRIVACY_POLICY_EN.md`
**Contact information** (Merchant review email + App submission email): `liger4903@gmail.com`

**App testing information**
- Test account → **"My app doesn't require an account to use it" 체크**
- Screencast URL → 당신 YouTube 영상 링크 (`https://youtu.be/...`)

**Test instructions (심사관용 — 복붙)**
```
Test account: No separate credentials needed — install Pinged on your review development store.

1) Add a product, enable "Track quantity", set the available quantity to 0 (sold out), and make sure
   it is Active and published to the Online Store.
2) In Online Store > Themes > Customize > the product template, add the "Back-in-stock button" app block.
3) Open that product on the storefront. The "notify me" form shows because it's sold out. Enter an email
   and submit. The Pinged admin (Waitlist) shows one waiting customer.
4) Back in the admin, set the product's inventory above 0 (restock it).
5) Within seconds, Pinged emails the subscriber. The admin "Send log" records the send (status "sent"),
   and the dashboard "Notified" count increases. Restocking by any method (manual, CSV, sync) triggers this.
6) Draft/unpublished products never trigger emails (verified in the detection engine).
7) Uninstalling removes all of the shop's data; the button is a Theme App Extension, so no code remains.

Billing: Free + Pro ($19/month flat) via the Shopify Billing API only — no external processors.
Support: liger4903@gmail.com (a real person replies within 24h on business days).
```

---

## PART 3 — 제출 직전 최종 체크

```
[ ] 발신 도메인 SPF/DKIM/DMARC 인증 → 인박스 도달 확인 (DELIVERABILITY.md)
[ ] fly 배포 + HTTPS URL 200 + 시크릿(API_SECRET/RESEND/EMAIL_FROM/CRON) 설정
[ ] shopify.app.pinged.toml URL = 프로덕션 + shopify app deploy
[ ] 개인정보방침 공개 URL 200 (비로그인)
[ ] 스크린샷 3~5장, (권장) 영상
[ ] 리스팅 PART 2 복붙, Install requirement = Online Store
[ ] Test instructions 복붙
[ ] Billing: Free + Pro $19, Billing API only
[ ] Submit → (첫 회 수정요청 가정) → 신속 재제출
```
