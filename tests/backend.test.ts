import { convexTest } from "convex-test";
import { describe, it, expect, vi, afterEach } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { todayUTC } from "../lib/domain";
const modules = import.meta.glob("../convex/**/*.ts");
const toolData = {
  name: "Test drill",
  category: "Power tools" as const,
  condition: "Good" as const,
  description: "Fictional tool for testing",
};
async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const borrower = t.withIdentity({ subject: "borrower" });
  const stranger = t.withIdentity({ subject: "stranger" });
  const ownerId = await owner.mutation(api.profiles.register, {
    displayName: "Test Owner",
  });
  const borrowerId = await borrower.mutation(api.profiles.register, {
    displayName: "Test Borrower",
  });
  await stranger.mutation(api.profiles.register, {
    displayName: "Test Stranger",
  });
  const toolId = await owner.mutation(api.tools.create, toolData);
  const day = (n: number) => todayUTC(Date.now() + n * 86400000);
  const request = (clientKey = "test-request", start = day(1), end = day(3)) =>
    borrower.mutation(api.loans.request, { toolId, start, end, clientKey });
  return {
    t,
    owner,
    borrower,
    stranger,
    ownerId,
    borrowerId,
    toolId,
    day,
    request,
  };
}
afterEach(() => vi.useRealTimers());
describe("Convex access control and lending", () => {
  it("denies unauthenticated private queries and mutations", async () => {
    const { t } = await setup();
    await expect(t.query(api.tools.browse, {})).rejects.toThrow();
    await expect(t.mutation(api.tools.create, toolData)).rejects.toThrow();
    await expect(t.query(api.loans.mine, {})).rejects.toThrow();
  });
  it("public catalog returns EXACTLY name and category", async () => {
    const { t } = await setup();
    expect(await t.query(api.tools.publicAvailable, {})).toEqual([
      { name: "Test drill", category: "Power tools" },
    ]);
  });
  it("prevents edits and deletion by another user", async () => {
    const { borrower, toolId } = await setup();
    await expect(
      borrower.mutation(api.tools.edit, { id: toolId, ...toolData }),
    ).rejects.toThrow();
    await expect(
      borrower.mutation(api.tools.remove, { id: toolId }),
    ).rejects.toThrow();
  });
  it("does not trust role arguments or identity claims", async () => {
    const { t, borrower, ownerId } = await setup();
    await expect(
      borrower.mutation(api.profiles.setTrusted, {
        profileId: ownerId,
        trusted: true,
      }),
    ).rejects.toThrow();
    const imposter = t.withIdentity({ subject: "imposter", role: "admin" });
    await imposter.mutation(api.profiles.register, { displayName: "Imposter" });
    expect((await imposter.query(api.profiles.me, {}))?.role).toBe("user");
    await expect(imposter.query(api.loans.all, {})).rejects.toThrow();
  });
  it("blocks loans and activity belonging to other people", async () => {
    const { stranger, request } = await setup();
    const id = await request();
    await expect(stranger.query(api.loans.get, { id })).rejects.toThrow();
    expect(await stranger.query(api.loans.mine, {})).toEqual([]);
    await expect(
      stranger.mutation(api.loans.changeStatus, { id, status: "approved" }),
    ).rejects.toThrow();
  });
  it("rejects own-tool requests and invalid dates", async () => {
    const { owner, toolId, day, request } = await setup();
    await expect(
      owner.mutation(api.loans.request, {
        toolId,
        start: day(1),
        end: day(2),
        clientKey: "own",
      }),
    ).rejects.toThrow();
    await expect(request("past", day(-1), day(2))).rejects.toThrow();
    await expect(request("bad", "2026-02-30", day(2))).rejects.toThrow();
  });
  it("deduplicates exact request keys and rejects conflicting reuse", async () => {
    const { request, day } = await setup();
    expect(await request()).toBe(await request());
    await expect(request("test-request", day(2), day(4))).rejects.toThrow();
  });
  it("prevents approval of overlapping requests", async () => {
    const { owner, stranger, toolId, request, day } = await setup();
    const first = await request();
    const second = await stranger.mutation(api.loans.request, {
      toolId,
      start: day(3),
      end: day(5),
      clientKey: "second",
    });
    await owner.mutation(api.loans.changeStatus, {
      id: first,
      status: "approved",
    });
    await expect(
      owner.mutation(api.loans.changeStatus, {
        id: second,
        status: "approved",
      }),
    ).rejects.toThrow();
  });
  it("enforces owner-only returns, preserves history, and allows a new booking after return", async () => {
    const { owner, borrower, request, toolId, t } = await setup();
    const id = await request();
    await owner.mutation(api.loans.changeStatus, { id, status: "approved" });
    await expect(
      borrower.mutation(api.loans.changeStatus, { id, status: "returned" }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.tools.remove, { id: toolId }),
    ).rejects.toThrow();
    await owner.mutation(api.loans.changeStatus, { id, status: "returned" });
    await owner.mutation(api.loans.changeStatus, { id, status: "returned" });
    await expect(
      owner.mutation(api.loans.changeStatus, { id, status: "approved" }),
    ).rejects.toThrow();
    await owner.mutation(api.tools.remove, { id: toolId });
    expect((await borrower.query(api.loans.get, { id }))?.status).toBe(
      "returned",
    );
    expect(await t.query(api.tools.publicAvailable, {})).toEqual([]);
  });
  it("keeps overdue tools out of the public catalog and blocks new bookings", async () => {
    const { owner, request, t, day } = await setup();
    const id = await request("today", day(0), day(0));
    await owner.mutation(api.loans.changeStatus, { id, status: "approved" });
    expect(await t.query(api.tools.publicAvailable, {})).toEqual([]);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86400000);
    expect(await t.query(api.tools.publicAvailable, {})).toEqual([]);
    await expect(request("late", day(2), day(3))).rejects.toThrow();
  });
  it("admin can moderate but cannot approve someone else's loan", async () => {
    const { t, stranger, ownerId, toolId, request, borrower } = await setup();
    await t.mutation(internal.profiles.setRole, {
      subject: "stranger",
      role: "admin",
    });
    await stranger.mutation(api.profiles.setTrusted, {
      profileId: ownerId,
      trusted: true,
    });
    const id = await request();
    expect(await stranger.query(api.loans.all, {})).toHaveLength(1);
    await expect(
      stranger.mutation(api.loans.changeStatus, { id, status: "approved" }),
    ).rejects.toThrow();
    await stranger.mutation(api.tools.remove, { id: toolId });
    expect((await borrower.query(api.loans.get, { id }))?.status).toBe(
      "declined",
    );
  });
  it("rejects editing with active requests", async () => {
    const { owner, toolId, request } = await setup();
    await request();
    await expect(
      owner.mutation(api.tools.edit, {
        id: toolId,
        ...toolData,
        name: "Different tool",
      }),
    ).rejects.toThrow();
  });
});
describe("durable automation and idempotency", () => {
  it("claims once, validates completion, and deduplicates write-backs", async () => {
    const { t, request } = await setup();
    await request();
    const [id] = await t.query(internal.automation.due, {});
    const event = await t.mutation(internal.automation.start, {
      id,
      token: "delivery-token",
    });
    expect(event).not.toBeNull();
    const receive = (route: string, nonce: string, body: unknown) =>
      t.mutation(internal.automation.receive, {
        route,
        nonce,
        fingerprint: nonce,
        body,
      });
    const claim = { eventId: id, token: "delivery-token" };
    expect(await receive("/automation/claim", "one", claim)).toEqual({
      process: true,
    });
    expect(await receive("/automation/claim", "two", claim)).toEqual({
      process: false,
    });
    await expect(
      receive("/automation/complete", "wrong", {
        ...claim,
        token: "wrong",
        outcome: "simulated",
        executionId: "1",
      }),
    ).rejects.toThrow();
    const result = { ...claim, outcome: "simulated", executionId: "1" };
    await receive("/automation/complete", "three", result);
    expect(await receive("/automation/complete", "four", result)).toMatchObject(
      { duplicate: true },
    );
    expect(
      await t.run((ctx) => ctx.db.query("notificationResults").collect()),
    ).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("simulated");
  });
  it("replays the same transport response without repeating effects and rejects nonce reuse", async () => {
    const { t } = await setup();
    const input = {
      route: "/automation/overdue",
      nonce: "nonce",
      fingerprint: "signature",
      body: {},
    };
    expect(await t.mutation(internal.automation.receive, input)).toEqual(
      await t.mutation(internal.automation.receive, input),
    );
    expect(
      await t.run((ctx) => ctx.db.query("receipts").collect()),
    ).toHaveLength(1);
    await expect(
      t.mutation(internal.automation.receive, {
        ...input,
        fingerprint: "changed",
      }),
    ).rejects.toThrow();
  });
  it("creates only one overdue reminder per loan per UTC day", async () => {
    const { t, owner, request, day } = await setup();
    const id = await request("overdue", day(0), day(0));
    await owner.mutation(api.loans.changeStatus, { id, status: "approved" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 86400000);
    const receive = (nonce: string) =>
      t.mutation(internal.automation.receive, {
        route: "/automation/overdue",
        nonce,
        fingerprint: nonce,
        body: {},
      });
    expect((await receive("daily-one")).events).toHaveLength(1);
    expect((await receive("daily-two")).events).toHaveLength(0);
    expect(
      (await t.run((ctx) => ctx.db.query("events").collect())).filter(
        (e) => e.kind === "reminder",
      ),
    ).toHaveLength(1);
  });
  it("recovers temporary failures and surfaces terminal failures without losing the loan", async () => {
    const { t, owner, request } = await setup();
    const loanId = await request();
    const [id] = await t.query(internal.automation.due, {});
    vi.useFakeTimers();
    for (let i = 1; i <= 5; i++) {
      await t.mutation(internal.automation.start, { id, token: `try-${i}` });
      await t.mutation(internal.automation.fail, {
        id,
        token: `try-${i}`,
        reason: "Test timeout",
      });
      vi.setSystemTime(Date.now() + 2000000);
    }
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
    expect((await owner.query(api.loans.get, { id: loanId }))?.status).toBe(
      "pending",
    );
    await t.mutation(internal.profiles.setRole, {
      subject: "owner",
      role: "admin",
    });
    expect(await owner.query(api.automation.failures, {})).toHaveLength(1);
    await owner.mutation(api.automation.retry, { id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("pending");
    expect(
      await t.mutation(internal.automation.start, { id, token: "recovered" }),
    ).not.toBeNull();
  });
  it("does not treat webhook acceptance as delivery", async () => {
    const { t, request } = await setup();
    await request();
    const [id] = await t.query(internal.automation.due, {});
    await t.mutation(internal.automation.start, { id, token: "attempt" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("processing");
    expect(
      await t.run((ctx) => ctx.db.query("notificationResults").collect()),
    ).toEqual([]);
  });
});
