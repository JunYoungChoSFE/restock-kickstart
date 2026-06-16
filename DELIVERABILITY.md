# 이메일 도달률 (Deliverability) — Pinged의 진짜 승부처

> 기획서 9절: "신뢰성은 약속하기 쉽고 지키기 어렵다 — **이메일 도달률이 진짜 싸움**."
> 알림이 스팸함에 가면 "발송"은 성공해도 고객은 못 본다. 이 문서는 인박스 도달을 위한 필수 세팅.

---

## 왜 스팸으로 가는가

`onboarding@resend.dev` 같은 **공용/미인증 도메인**에서 보내면:
- 받는 메일서버가 발신 도메인의 **SPF/DKIM/DMARC**를 검증하는데, 공용 도메인은 우리 신원과 정렬(alignment)되지 않음
- 발신 도메인 평판(reputation)이 없음
→ 스팸 필터가 차단/스팸 분류. **모든 수신자에게 동일하게 발생한다.**

## 해결 = 발신 도메인 인증 (1회, 코드 아님)

### 1. 도메인 확보
Pinged 전용 도메인 하나 (예: `pinged.app`). 또는 서브도메인 `mail.pinged.app`을 발신 전용으로.

### 2. Resend에 도메인 등록
Resend 대시보드 → **Domains** → **Add Domain** → 도메인 입력 → Resend가 DNS 레코드를 발급:
- **SPF** (TXT): `v=spf1 include:resend.com ~all` 류
- **DKIM** (CNAME/TXT): Resend가 주는 키 레코드(보통 `resend._domainkey` 등)
- (권장) **MX**: 바운스 처리용

### 3. DNS에 레코드 추가
도메인 등록기관(가비아/Cloudflare/Namecheap 등) DNS 관리에서 위 레코드를 그대로 추가 → Resend에서 **Verify** → 초록불.

### 4. DMARC 추가 (강력 권장)
DNS에 TXT 레코드:
```
이름: _dmarc.pinged.app
값:   v=DMARC1; p=none; rua=mailto:dmarc@pinged.app
```
(`p=none`으로 시작해 모니터링 → 안정되면 `p=quarantine`/`reject`로 강화)

### 5. .env 설정
```
RESEND_API_KEY=re_...
EMAIL_FROM=Pinged <notify@pinged.app>     # 반드시 인증된 도메인 주소
EMAIL_REPLY_TO=support@pinged.app          # 선택, 정당성 신호
```

→ 인증된 도메인에서 보내면 인박스 도달률이 급격히 올라간다.

---

## 아키텍처 결정 (v1)

**전 가맹점 알림을 Pinged 자체 인증 도메인에서 발송.** 한 번 인증하면 모든 상점에 적용. 메일 제목·본문에 **상점명을 포함**해 고객이 알아보게 한다(이미 그렇게 함: "back in stock at {storeName}").

- **장점**: 세팅 1회, 가맹점은 DNS 손댈 필요 없음(5분 세팅 가드레일).
- **한계**: 발신자가 가맹점 브랜드가 아니라 Pinged. → (선택) Pro 기능으로 "가맹점 자체 도메인 발신"을 추후 제공 가능(가맹점이 DNS 인증).

## 추가 베스트프랙티스

- **새 도메인은 워밍업**: 처음엔 발송량이 적게 시작해 평판을 쌓는다(트랜잭션 메일이라 보통 자연 워밍업).
- **콘텐츠**: 과한 대문자/느낌표/이미지 떡칠 금지. 현재 템플릿은 짧고 정직함(좋음).
- **List-Unsubscribe 헤더**(추후): 구독 해제 링크/헤더 추가 시 도달률·신뢰 ↑ (엔드포인트 필요, v1.1).
- **바운스/컴플레인 모니터링**: Resend 대시보드에서 반송·스팸신고율 관찰.

## 테스트 단계 메모

도메인 인증 전에는 `onboarding@resend.dev`로 **가입 본인 이메일에만** 발송 가능(스팸 갈 수 있음 — 정상). 실제 출시 전 반드시 위 도메인 인증을 완료한다.
