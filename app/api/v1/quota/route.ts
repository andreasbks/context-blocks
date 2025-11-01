import { requireOwner } from "@/lib/api/auth";
import { checkQuota } from "@/lib/api/quota";

export const runtime = "nodejs";

/**
 * GET /api/v1/quota
 * Returns the current user's token quota status
 */
export async function GET() {
  const ownerOrRes = await requireOwner();
  if (ownerOrRes instanceof Response) return ownerOrRes;
  const { owner } = ownerOrRes;

  const quotaStatus = await checkQuota(owner.id);

  return new Response(JSON.stringify(quotaStatus), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
