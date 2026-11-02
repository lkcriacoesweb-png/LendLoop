import { describe, expect, it } from "vitest";
import { sign, verify } from "../lib/signing";
const secret = "test-only-outbound-secret-with-32-characters";
describe("signed automation transport", () => {
  it("verifies the exact payload bytes", async () => {
    const envelope = await sign(secret, "/automation/complete", {
      note: "ação",
      id: 1,
    });
    expect(await verify(secret, "/automation/complete", envelope)).toEqual(
      envelope,
    );
  });
  it("rejects changed payloads, routes and signatures", async () => {
    const e = await sign(secret, "/automation/complete", { id: 1 });
    await expect(
      verify(secret, "/automation/complete", { ...e, payload: '{"id":2}' }),
    ).rejects.toThrow();
    await expect(verify(secret, "/automation/claim", e)).rejects.toThrow();
    await expect(
      verify(
        "other-test-only-secret-with-at-least-32-characters",
        "/automation/complete",
        e,
      ),
    ).rejects.toThrow();
    await expect(
      verify(secret, "/automation/complete", { ...e, signature: "x" }),
    ).rejects.toThrow();
  });
  it("rejects old and future timestamps", async () => {
    const e = await sign(secret, "/automation/complete", {});
    await expect(
      verify(secret, "/automation/complete", e, e.timestamp + 300001),
    ).rejects.toThrow();
    await expect(
      verify(secret, "/automation/complete", e, e.timestamp - 300001),
    ).rejects.toThrow();
  });
  it("rejects weak configuration and oversized envelopes", async () => {
    await expect(sign("short", "/automation/claim", {})).rejects.toThrow();
    const e = await sign(secret, "/automation/claim", {});
    await expect(
      verify(secret, "/automation/claim", { ...e, payload: "x".repeat(32001) }),
    ).rejects.toThrow();
  });
});
