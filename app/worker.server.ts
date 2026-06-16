/**
 * 인프로세스 발송 워커 (신뢰성 코어 — CLAUDE.md 1절: 즉시 발송).
 *
 * Roost의 야간 배치와 달리 Pinged는 "수 초 내 발송"이 가드레일이라 **짧은 주기 틱**으로 돈다.
 * - 단일 always-on Fly 머신 전제(min_machines_running=1) → 별도 큐 인프라/Redis 불필요.
 * - enqueue 직후 `kickWorker()`로 즉시 한 번 더 처리 → 거의 실시간 발송.
 * - 주기 틱은 백오프 재시도·누락 보정의 안전망.
 *
 * 끄기: DISABLE_WORKER=1. 틱 간격: WORKER_TICK_MS(기본 15초).
 */
import { runDueJobs } from "./jobs/sendNotification";

const TICK_MS = Number(process.env.WORKER_TICK_MS || 15_000);
const GLOBAL_KEY = "__pingedWorker__";

interface WorkerState {
  armed: boolean;
  running: boolean;
}

function state(): WorkerState {
  const g = globalThis as unknown as Record<string, WorkerState | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { armed: false, running: false };
  return g[GLOBAL_KEY]!;
}

async function tick(): Promise<void> {
  const s = state();
  if (s.running) return; // 겹치지 않게
  s.running = true;
  try {
    const r = await runDueJobs();
    if (r.processed > 0) {
      console.log(
        `[worker] processed ${r.processed} (sent ${r.sent}, retried ${r.retried}, failed ${r.failed}, skipped ${r.skipped})`,
      );
    }
  } catch (e) {
    console.log("[worker] tick error:", e);
  } finally {
    s.running = false;
  }
}

function scheduleNext(): void {
  const t = setTimeout(async () => {
    await tick();
    scheduleNext();
  }, TICK_MS);
  if (typeof t.unref === "function") t.unref();
}

/** 프로세스당 한 번 워커를 켠다. 멱등. */
export function startWorker(): void {
  if (process.env.DISABLE_WORKER === "1") return;
  const s = state();
  if (s.armed) return;
  s.armed = true;
  console.log(`[worker] armed — tick every ${TICK_MS}ms`);
  scheduleNext();
}

/** enqueue 직후 즉시 발송 시도(비동기, 결과 무시) — "수 초 내" 보장용. */
export function kickWorker(): void {
  tick().catch(() => {});
}
