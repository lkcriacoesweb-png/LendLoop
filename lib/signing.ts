export type Envelope = {
  timestamp: number;
  nonce: string;
  payload: string;
  signature: string;
};
const encoder = new TextEncoder();
export function signingInput(
  route: string,
  timestamp: number,
  nonce: string,
  payload: string,
) {
  return `v1\nPOST\n${route}\n${timestamp}\n${nonce}\n${payload}`;
}
async function key(secret: string) {
  if (secret.length < 32)
    throw new Error("Automation secret must have at least 32 characters.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function sign(
  secret: string,
  route: string,
  data: unknown,
  nonce = crypto.randomUUID(),
  timestamp = Date.now(),
): Promise<Envelope> {
  const payload = JSON.stringify(data);
  const bytes = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(signingInput(route, timestamp, nonce, payload)),
  );
  return {
    timestamp,
    nonce,
    payload,
    signature: Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}
export async function verify(
  secret: string,
  route: string,
  input: unknown,
  now = Date.now(),
): Promise<Envelope> {
  if (!input || typeof input !== "object") throw new Error("Invalid envelope.");
  const e = input as Envelope;
  if (
    !Number.isSafeInteger(e.timestamp) ||
    Math.abs(now - e.timestamp) > 300000 ||
    typeof e.nonce !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(e.nonce) ||
    typeof e.payload !== "string" ||
    e.payload.length > 32000 ||
    typeof e.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(e.signature)
  )
    throw new Error("Invalid or expired envelope.");
  const bytes = Uint8Array.from(e.signature.match(/../g)!, (b) =>
    parseInt(b, 16),
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      bytes,
      encoder.encode(signingInput(route, e.timestamp, e.nonce, e.payload)),
    ))
  )
    throw new Error("Invalid signature.");
  return e;
}
