// @vitest-environment node
// Contract harness: executes the EXPORTED Code-node sources and Convex HTTP handlers.
// This is not the n8n engine, a Clerk session, or a deployed Convex backend.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { describe, it, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { sign } from "../lib/signing";
import { todayUTC } from "../lib/domain";
const modules = import.meta.glob("../convex/**/*.ts");
const require = createRequire(import.meta.url);
const a = JSON.parse(
  readFileSync("n8n/workflows/request-notification.json", "utf8"),
);
const b = JSON.parse(
  readFileSync("n8n/workflows/overdue-reminders.json", "utf8"),
);
const outbound = "test-only-outbound-not-a-real-secret-123456";
const inbound = "test-only-inbound-not-a-real-secret-abcdef";
type Item = { json: Record<string, any> };
async function execute(
  workflow: typeof a,
  name: string,
  items: Item[],
  linked: Item[] = [],
) {
  const source = workflow.nodes.find((n: { name: string }) => n.name === name)
    .parameters.jsCode;
  const fn = new Function(
    "require",
    "$env",
    "$input",
    "$",
    "$execution",
    source,
  );
  return (await fn(
    require,
    {
      AUTOMATION_OUTBOUND_SECRET: outbound,
      AUTOMATION_INBOUND_SECRET: inbound,
    },
    { first: () => items[0], all: () => items },
    () => ({ itemMatching: (i: number) => linked[i] }),
    { id: "test-execution-123" },
  )) as Item[];
}
async function fixture() {
  vi.stubEnv("AUTOMATION_INBOUND_SECRET", inbound);
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "a" });
  const borrower = t.withIdentity({ subject: "b" });
  await owner.mutation(api.profiles.register, {
    displayName: "Fictional owner",
  });
  await borrower.mutation(api.profiles.register, {
    displayName: "Fictional borrower",
  });
  const toolId = await owner.mutation(api.tools.create, {
    name: "Test tool",
    category: "Other",
    condition: "Good",
    description: "Fictional",
  });
  const loanId = await borrower.mutation(api.loans.request, {
    toolId,
    start: todayUTC(),
    end: todayUTC(),
    clientKey: "workflow-test",
  });
  const post = async (route: string, envelope: unknown) => {
    const r = await t.fetch(route, {
      method: "POST",
      body: JSON.stringify(envelope),
    });
    expect(r.status).toBe(200);
    return { json: await r.json() };
  };
  return { t, owner, borrower, loanId, post };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("exported n8n workflow contracts with Convex HTTP", () => {
  it("processes a request notification, records its mock outcome, and suppresses replay", async () => {
    const { t, post } = await fixture();
    const [id] = await t.query(internal.automation.due, {});
    const event = await t.mutation(internal.automation.start, {
      id,
      token: "test-token",
    });
    const envelope = await sign(outbound, "/webhook/lendloop-events", event);
    const verified = await execute(a, "Verify signed event", [
      { json: { body: envelope } },
    ]);
    const prepared = await execute(a, "Prepare claim", verified);
    const claim = await post("/automation/claim", prepared[0].json.envelope);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const complete = await execute(
      a,
      "Simulate notification",
      [claim],
      prepared,
    );
    await post("/automation/complete", complete[0].json.envelope);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join()).not.toContain("test-token");
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("simulated");
    const replay = await execute(a, "Prepare claim", verified);
    const replayClaim = await post(
      "/automation/claim",
      replay[0].json.envelope,
    );
    expect(
      await execute(a, "Simulate notification", [replayClaim], replay),
    ).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("runs overdue selection and mock reminder completion once per day", async () => {
    const { t, owner, loanId, post } = await fixture();
    await owner.mutation(api.loans.changeStatus, {
      id: loanId,
      status: "approved",
    });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86400000);
    const fetch = await execute(b, "Prepare overdue fetch", []);
    const result = await post("/automation/overdue", fetch[0].json.envelope);
    const each = await execute(b, "Each eligible reminder", [result]);
    expect(each).toHaveLength(1);
    const prepared = await execute(b, "Prepare claim", each);
    const claim = await post("/automation/claim", prepared[0].json.envelope);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const complete = await execute(
      b,
      "Simulate notification",
      [claim],
      prepared,
    );
    await post("/automation/complete", complete[0].json.envelope);
    const repeated = await execute(b, "Prepare overdue fetch", []);
    expect(
      (await post("/automation/overdue", repeated[0].json.envelope)).json
        .events,
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("notificationResults").collect()),
    ).toHaveLength(1);
  });
  it("rejects invalid signatures in the actual exported receiver and Convex HTTP route", async () => {
    const { t } = await fixture();
    const envelope = await sign(outbound, "/webhook/lendloop-events", {
      eventId: "x",
    });
    await expect(
      execute(a, "Verify signed event", [
        { json: { body: { ...envelope, payload: "{}" } } },
      ]),
    ).rejects.toThrow("signature");
    const signed = await sign(inbound, "/automation/overdue", {});
    const response = await t.fetch("/automation/overdue", {
      method: "POST",
      body: JSON.stringify({ ...signed, signature: "0".repeat(64) }),
    });
    expect(response.status).toBe(400);
    const oversize = await t.fetch("/automation/overdue", {
      method: "POST",
      body: "x".repeat(40001),
    });
    expect(oversize.status).toBe(413);
  });
  it("request dispatcher recovers after a transport failure without claiming success prematurely", async () => {
    const { t } = await fixture();
    vi.stubEnv(
      "N8N_WEBHOOK_URL",
      "https://fictional.example/webhook/lendloop-events",
    );
    vi.stubEnv("AUTOMATION_OUTBOUND_SECRET", outbound);
    const transport = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new Response("Accepted", { status: 200 }));
    await t.action(internal.dispatch.run, {});
    const [event] = await t.run((ctx) => ctx.db.query("events").collect());
    expect(event.status).toBe("pending");
    expect(event.attempts).toBe(1);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120001);
    await t.action(internal.dispatch.run, {});
    expect(transport).toHaveBeenCalledTimes(2);
    expect((await t.run((ctx) => ctx.db.get(event._id)))?.status).toBe(
      "processing",
    );
  });
});
