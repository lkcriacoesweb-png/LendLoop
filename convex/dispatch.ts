import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { sign } from "../lib/signing";
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids = await ctx.runQuery(internal.automation.due, {});
    for (const id of ids) {
      const token = crypto.randomUUID();
      const event = await ctx.runMutation(internal.automation.start, {
        id,
        token,
      });
      if (!event) continue;
      try {
        const url = process.env.N8N_WEBHOOK_URL;
        if (!url || !process.env.AUTOMATION_OUTBOUND_SECRET)
          throw new Error("configuration");
        const route = new URL(url).pathname;
        const response = await fetch(url, {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            await sign(process.env.AUTOMATION_OUTBOUND_SECRET, route, event),
          ),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("delivery");
        // HTTP acceptance is not delivery. Only the authenticated complete callback records success.
      } catch {
        await ctx.runMutation(internal.automation.fail, {
          id,
          token,
          reason: "Webhook unavailable, timed out, or misconfigured.",
        });
      }
    }
  },
});
