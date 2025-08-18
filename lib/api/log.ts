export function logInfo(message: string, meta?: Record<string, unknown>) {
  if (meta) console.log(message, meta);
  else console.log(message);
}

export function logError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>
) {
  console.error(message, { error, ...(meta ?? {}) });
}
