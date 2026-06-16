// 트랜잭셔널 이메일 발송 래퍼 — fetch만 사용(외부 의존성 없음), Roost와 동일 패턴.
// RESEND_API_KEY 없으면 dev 로그만(실제 발송 X). 도달률 위해 발신 도메인 SPF/DKIM/DMARC 인증 필요.

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * 이메일 1건 발송. 워커가 결과로 잡 상태(성공/재시도/실패)를 결정하므로,
 * 여기서는 던지지 않고 항상 SendResult를 반환한다.
 */
export async function deliver(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      `[email:dev] to=${to} subject="${subject}" (provider not configured — not sent)`,
    );
    return { ok: true, id: undefined }; // dev: 발송 성공으로 간주(파이프라인 흐름 확인용)
  }
  const from = process.env.EMAIL_FROM || "Pinged <onboarding@resend.dev>";
  // reply_to(있으면)는 정당성 신호 → 도달률에 도움. 발신 도메인 인증이 본질적 해법이다.
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html, reply_to: replyTo }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
