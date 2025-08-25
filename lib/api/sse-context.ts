export function createSSEContext(keepalive_interval: number = 15000) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  let cleanedUp = false;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  async function writeEventSafe(event: string, data: unknown) {
    if (cleanedUp) return;
    try {
      const payload =
        typeof data === "string" ? data : JSON.stringify(data ?? {});
      await writer.write(`event: ${event}\n` + `data: ${payload}\n\n`);
    } catch {}
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    if (keepalive) clearInterval(keepalive);
  }

  // auto-cleanup if client disconnects
  void writer.closed.then(() => cleanup());

  const setKeepalive = () => {
    keepalive = setInterval(() => {
      void writeEventSafe("keepalive", {});
    }, keepalive_interval);
  };

  return { readable, writer, headers, writeEventSafe, cleanup, setKeepalive };
}
