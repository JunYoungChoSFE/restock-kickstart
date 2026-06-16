import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";
import { runDueJobs } from "../jobs/sendNotification";

/**
 * 발송 워커의 외부/수동 트리거.
 * POST /internal/process, 헤더 x-cron-secret: $CRON_SECRET.
 * 인프로세스 워커(worker.server.ts)가 자동으로 돌지만, 외부 스케줄러·운영자가 즉시 돌릴 수도 있게.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return data({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueJobs();
  return data({ ok: true, ...result });
};
