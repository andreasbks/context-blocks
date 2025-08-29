# Browser testing (naive end to end)

You can use this script in the browser to test all NON-STREAMING routes in an end-to end happy path.
Yes this is not comprehensive, but yes it is also pragmatic to move fast.

```code
(async () => {
  const base = location.origin;
  const idk = () => `console-${(crypto.randomUUID && crypto.randomUUID()) || Date.now()}`;

  async function req(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idk(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { parseError: text }; }
    if (!res.ok) {
      console.warn(method, path, "->", res.status, json);
      throw new Error(`${method} ${path} failed: ${res.status}`);
    }
    return json;
  }

  function log(step, data) {
    console.log(`%c${step}`, "background:#222;color:#bada55;padding:2px 6px;border-radius:3px", data);
  }

  // 1) Start graph
  const start = await req("POST", "/api/v1/graphs/start", {
    title: "E2E test graph",
    firstMessage: { author: "user", content: { text: "Hello world" } },
  });
  log("1) start graph", start);

  const graphId = start.graph.id;
  let branchId = start.branch.id;
  let branchVersion = start.branch.version;
  let tipNodeId = start.branch.tipNodeId;
  const rootNodeId = start.branch.rootNodeId;

  // 2) List graphs
  const graphs = await req("GET", "/api/v1/graphs");
  log("2) list graphs", graphs);

  // 3) Graph detail
  const detail = await req("GET", `/api/v1/graphs/${graphId}`);
  log("3) graph detail", detail);

  // 4) Append user message to branch
  const append = await req("POST", `/api/v1/branches/${branchId}/append`, {
    author: "user",
    content: { text: "User appended message" },
    expectedVersion: branchVersion,
  });
  log("4) append", append);
  if (append.version != null) branchVersion = append.version;
  if (append.newTip) tipNodeId = append.newTip;
  const appendedNodeId = append.item?.nodeId || tipNodeId;

  // 5) Ensure a library block
  const ensure = await req("POST", "/api/v1/blocks/ensure", {
    kind: "user",
    content: { text: "Reusable context block" },
    public: true,
  });
  log("5) ensure block", ensure);
  const ensuredBlockId = ensure.block.id;

  // 6) Inject the ensured block into current branch tip
  const inject = await req("POST", `/api/v1/branches/${branchId}/inject`, {
    blockId: ensuredBlockId,
    reuseExistingNode: true,
  });
  log("6) inject reference", inject);
  const injectedNodeId = inject.reference.nodeId;

  // 7) Replace tip with edited content
  const replaceTip = await req("POST", `/api/v1/branches/${branchId}/replace-tip`, {
    newContent: { text: "Edited tip content" },
    expectedVersion: branchVersion,
  });
  log("7) replace-tip", replaceTip);
  if (replaceTip.version != null) branchVersion = replaceTip.version;
  if (replaceTip.newTip) tipNodeId = replaceTip.newTip;

  // 8) Linear read with references
  const linear = await req("GET", `/api/v1/branches/${branchId}/linear?limit=50&include=references`);
  log("8) linear", linear);

  // 9) Jump back to root
  const jump = await req("POST", `/api/v1/branches/${branchId}/jump`, {
    toNodeId: rootNodeId,
    expectedVersion: branchVersion,
  });
  log("9) jump", jump);
  if (jump.branch?.version != null) branchVersion = jump.branch.version;
  if (jump.branch?.tipNodeId) tipNodeId = jump.branch.tipNodeId;

  // 10) Node references list (use the node we injected into or the root)
  const nodeRefs = await req("GET", `/api/v1/nodes/${injectedNodeId}/references?limit=20`);
  log("10) node references", nodeRefs);

  // 11) Delete an appended node (not a branch root). Use CAS for branches whose tip may move.
  // We’ll delete the earlier appended node; if it was tip at the time, it no longer is after replace/jump.
  const deleteBody = { expectedVersions: { [branchId]: branchVersion } };
  const del = await fetch(`${base}/api/v1/nodes/${appendedNodeId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idk() },
    body: JSON.stringify(deleteBody),
  });
  const delJson = await del.json();
  if (!del.ok) {
    console.warn("11) delete failed", del.status, delJson);
    throw new Error(`DELETE /nodes failed: ${del.status}`);
  }
  log("11) delete node", delJson);

  // 12) Verify after delete via linear read again
  const linear2 = await req("GET", `/api/v1/branches/${branchId}/linear?limit=50&include=references`);
  log("12) linear after delete", linear2);

  console.log("%cE2E flow complete.", "color: #2ecc71; font-weight: bold");
})().catch(err => console.error("E2E flow error:", err));
```
