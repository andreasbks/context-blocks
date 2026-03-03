import { z } from "zod";

import { streamOpenAIResponse } from "@/lib/ai/stream-response";
import { buildPromptWithSystem } from "@/lib/ai/system-prompt";
import { createRequestLogger } from "@/lib/api/logger";
import { checkWriteRateLimit } from "@/lib/api/rate-limit";
import { SSEDeltaSchema } from "@/lib/api/schemas/sse";
import { createSSEContext } from "@/lib/api/sse-context";
import {
  sendInternalError,
  sendValidationError,
  startKeepalive,
} from "@/lib/api/sse-utils";
import { writeSSE } from "@/lib/api/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_MAX_MESSAGES = 20;
const DEMO_MAX_CONTEXT_CHARS = 16_000; // ~4K tokens

const DemoMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
});

const DemoStreamBody = z.object({
  messages: z.array(DemoMessageSchema).min(1).max(DEMO_MAX_MESSAGES),
});

const DemoFinalSchema = z.object({
  text: z.string(),
});

function getClientIp(req: Request): string {
  const forwarded =
    req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function buildDemoContext(
  messages: Array<{ role: "user" | "assistant"; text: string }>
): string {
  let context = "";
  let chars = 0;

  // Walk backwards and take as many messages as fit in the budget
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const line = `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text}\n`;
    if (chars + line.length > DEMO_MAX_CONTEXT_CHARS) break;
    context = line + context;
    chars += line.length;
  }

  return context;
}

export async function POST(req: Request) {
  const sse = createSSEContext();
  const headers = sse.headers;
  let closed = false;

  const cleanupOnce = () => {
    if (closed) return;
    closed = true;
    sse.teardown();
  };

  void sse.writer.closed.finally(() => cleanupOnce());

  try {
    const ip = getClientIp(req);

    // Rate limit by IP: 10 requests per minute
    const rl = checkWriteRateLimit(`demo:${ip}`, "POST /v1/demo/stream", 10);
    if (rl) return rl;

    const { log, ctx } = createRequestLogger(req, {
      route: "POST /v1/demo/stream",
      userId: `demo:${ip}`,
    });
    log.info({ event: "request_start", mode: "demo" });

    const json = await req.json().catch(() => null);
    const parsed = DemoStreamBody.safeParse(json);
    if (!parsed.success) {
      queueMicrotask(async () => {
        await sendValidationError(sse, parsed.error.flatten());
        cleanupOnce();
      });
      return new Response(sse.readable, { headers });
    }

    const { messages } = parsed.data;
    const keepalive = startKeepalive(sse);

    void (async () => {
      try {
        const demoContext = buildDemoContext(messages);
        const context = await buildPromptWithSystem(demoContext);

        const { finalText } = await streamOpenAIResponse({
          context,
          onDelta: async (chunk) => {
            await writeSSE(SSEDeltaSchema, "delta", { text: chunk }, sse);
          },
          log,
          requestStartedAt: ctx.startedAt,
        });

        await writeSSE(DemoFinalSchema, "final", { text: finalText }, sse);
        log.info({
          event: "demo_complete",
          durationMs: Date.now() - ctx.startedAt,
        });

        await sse.writer.close();
        cleanupOnce();
      } catch (err) {
        log.error({ event: "demo_error", error: err });
        await sendInternalError(sse);
      } finally {
        clearInterval(keepalive);
        cleanupOnce();
      }
    })();

    return new Response(sse.readable, { headers });
  } catch (err) {
    const { log } = createRequestLogger(req, {
      route: "POST /v1/demo/stream",
      userId: "demo:unknown",
    });
    log.error({ event: "request_error", error: err });
    queueMicrotask(async () => {
      await sendInternalError(sse);
    });
    return new Response(sse.readable, { status: 500, headers });
  }
}
