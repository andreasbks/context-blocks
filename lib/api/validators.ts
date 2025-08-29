import { z } from "zod";

import { Errors } from "./errors";

export async function parseJson<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<z.infer<TSchema> | Response> {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return Errors.validation("Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}

export async function parseParams<TSchema extends z.ZodTypeAny, TParams>(
  paramsPromise: Promise<TParams>,
  schema: TSchema
): Promise<z.infer<TSchema> | Response> {
  const params = await paramsPromise.catch(() => ({}) as TParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return Errors.validation("Invalid path params", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseQuery<TSchema extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: TSchema
): z.infer<TSchema> | Response {
  // normalize numbers/booleans where expected by schema via a loose object
  const obj: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value === "true") obj[key] = true;
    else if (value === "false") obj[key] = false;
    else if (/^-?\d+$/.test(value)) obj[key] = Number(value);
    else obj[key] = value;
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return Errors.validation("Invalid query params", parsed.error.flatten());
  }
  return parsed.data;
}

export function validateAndSend<TSchema extends z.ZodTypeAny>(
  body: unknown,
  schema: TSchema,
  status = 200
): Response {
  const mode = (process.env["VALIDATE_RESPONSES"] || "dev").toLowerCase();
  // Normalize to plain JSON (Dates -> ISO strings, remove undefined)
  const normalized = JSON.parse(JSON.stringify(body ?? {}));
  if (mode === "strict" || mode === "dev") {
    schema.parse(normalized);
  }
  return new Response(JSON.stringify(normalized), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function writeSSE<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  event: string,
  payload: unknown,
  sse: { writeEventSafe: (event: string, data: unknown) => Promise<void> }
): Promise<void> {
  const normalized = JSON.parse(JSON.stringify(payload ?? {}));
  schema.parse(normalized);
  await sse.writeEventSafe(event, normalized);
}
