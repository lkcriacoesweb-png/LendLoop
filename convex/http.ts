import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verify } from "../lib/signing";
const http = httpRouter();
for (const route of [
  "/automation/overdue",
  "/automation/claim",
  "/automation/complete",
]) {
  http.route({
    path: route,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      if (!process.env.AUTOMATION_INBOUND_SECRET)
        return new Response("Automation not configured", { status: 503 });
      try {
        // Stream cap: do not buffer an unbounded unauthenticated request.
        const reader = request.body?.getReader();
        if (!reader) return new Response("Missing body", { status: 400 });
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 40000) {
            await reader.cancel();
            return new Response("Too large", { status: 413 });
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const envelope = await verify(
          process.env.AUTOMATION_INBOUND_SECRET,
          route,
          JSON.parse(new TextDecoder().decode(bytes)),
        );
        const result = await ctx.runMutation(internal.automation.receive, {
          route,
          nonce: envelope.nonce,
          fingerprint: envelope.signature,
          body: JSON.parse(envelope.payload),
        });
        return Response.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
      } catch {
        return Response.json(
          { error: "Invalid, expired, or unauthorized automation request." },
          { status: 400 },
        );
      }
    }),
  });
}
export default http;
