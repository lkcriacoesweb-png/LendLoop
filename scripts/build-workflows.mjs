import { mkdir, writeFile } from "node:fs/promises";
// Keep source reviewable. Exported JSON is generated from these node definitions.
const sign = `const { createHmac, randomUUID } = require('crypto');
function signed(route, body) {
  const secret = $env.AUTOMATION_INBOUND_SECRET;
  if (!secret || secret.length < 32) throw new Error('Missing automation secret');
  const timestamp = Date.now(), nonce = randomUUID(), payload = JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(['v1','POST',route,String(timestamp),nonce,payload].join('\\n')).digest('hex');
  return { timestamp, nonce, payload, signature };
}
`;
const verify = `const { createHmac, timingSafeEqual } = require('crypto');
const secret = $env.AUTOMATION_OUTBOUND_SECRET;
if (!secret || secret.length < 32) throw new Error('Missing automation secret');
const e = $input.first().json.body;
if (!e || !Number.isSafeInteger(e.timestamp) || Math.abs(Date.now()-e.timestamp)>300000 || typeof e.nonce!=='string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(e.nonce) || typeof e.payload!=='string' || e.payload.length>32000 || typeof e.signature!=='string' || !/^[a-f0-9]{64}$/.test(e.signature)) throw new Error('Invalid or expired envelope');
const expected = createHmac('sha256', secret).update(['v1','POST','/webhook/lendloop-events',String(e.timestamp),e.nonce,e.payload].join('\\n')).digest();
if (!timingSafeEqual(expected, Buffer.from(e.signature, 'hex'))) throw new Error('Invalid signature');
const event = JSON.parse(e.payload);
if (!event || Object.keys(event).some(k=>!['eventId','token','kind','status','recipientRef'].includes(k)) || typeof event.eventId!=='string' || typeof event.token!=='string' || typeof event.recipientRef!=='string' || event.kind!=='request' || !['pending','approved','declined','cancelled','returned'].includes(event.status)) throw new Error('Invalid event');
return [{ json: { event } }];`;
let counter = 0;
const node = (name, type, version, parameters, x, y = 0, extra = {}) => ({
  id: `lendloop-${++counter}`,
  name,
  type: `n8n-nodes-base.${type}`,
  typeVersion: version,
  position: [x, y],
  parameters,
  ...extra,
});
const code = (name, jsCode, x, y = 0) =>
  node(name, "code", 2, { jsCode }, x, y);
const http = (name, route, x, y = 0) =>
  node(
    name,
    "httpRequest",
    4.2,
    {
      method: "POST",
      url: `={{ $env.CONVEX_SITE_URL + '${route}' }}`,
      sendBody: true,
      contentType: "raw",
      rawContentType: "application/json",
      body: "={{ JSON.stringify($json.envelope) }}",
      options: {
        timeout: 15000,
        redirect: { redirect: { followRedirects: false } },
      },
    },
    x,
    y,
    { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 },
  );
const sharedTail = (x) => [
  code(
    "Prepare claim",
    sign +
      `return $input.all().map((item, i) => ({ json: { event: item.json.event, envelope: signed('/automation/claim', { eventId:item.json.event.eventId, token:item.json.event.token }) }, pairedItem:{item:i} }));`,
    x,
  ),
  http("Claim once", "/automation/claim", x + 230),
  code(
    "Simulate notification",
    sign +
      `const output=[];
for (let i=0; i<$input.all().length; i++) {
  const item=$input.all()[i]; if (item.json.process !== true) continue;
  const event=$('Prepare claim').itemMatching(i).json.event;
  // This is a LOGGED MOCK notification, not email delivery. Never log tokens or people.
  console.log(JSON.stringify({ eventId:event.eventId, kind:event.kind, outcome:'simulated' }));
  const completion={ eventId:event.eventId, token:event.token, outcome:'simulated', executionId:String($execution.id) };
  output.push({ json:{ eventId:event.eventId, outcome:'simulated', envelope:signed('/automation/complete',completion) }, pairedItem:{item:i} });
}
return output;`,
    x + 460,
  ),
  http("Record result", "/automation/complete", x + 690),
];
function workflow(name, nodes) {
  const connections = {};
  for (let i = 0; i < nodes.length - 1; i++)
    connections[nodes[i].name] = {
      main: [[{ node: nodes[i + 1].name, type: "main", index: 0 }]],
    };
  return {
    name,
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: "v1",
      timezone: "UTC",
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "none",
      saveManualExecutions: true,
      executionTimeout: 120,
    },
    pinData: {},
    tags: [],
  };
}
const request = workflow("LendLoop — A · Request notification", [
  node(
    "Request webhook",
    "webhook",
    2,
    {
      httpMethod: "POST",
      path: "lendloop-events",
      responseMode: "lastNode",
      options: {},
    },
    0,
    0,
    { webhookId: "lendloop-request-events" },
  ),
  code("Verify signed event", verify, 230),
  ...sharedTail(460),
]);
const overdue = workflow("LendLoop — B · Daily overdue reminders", [
  node(
    "Daily window and recovery",
    "scheduleTrigger",
    1.2,
    {
      rule: {
        interval: [{ field: "cronExpression", expression: "*/15 9-23 * * *" }],
      },
    },
    0,
  ),
  code(
    "Prepare overdue fetch",
    sign + `return [{json:{envelope:signed('/automation/overdue',{})}}];`,
    230,
  ),
  http("Fetch overdue", "/automation/overdue", 460),
  code(
    "Each eligible reminder",
    `const events=$input.first().json.events;
if (!Array.isArray(events)) throw new Error('Invalid overdue response');
return events.map(event=>({json:{event},pairedItem:{item:0}}));`,
    690,
  ),
  ...sharedTail(920),
]);
const errors = workflow("LendLoop — C · Sanitized error log", [
  node("Workflow failed", "errorTrigger", 1, {}, 0),
  code(
    "Log failure reference",
    `const data=$input.first().json;
const output={ outcome:'workflow_failed', workflowId:String(data.workflow?.id || 'unknown'), executionId:String(data.execution?.id || 'unknown') };
console.error(JSON.stringify(output)); return [{json:output}];`,
    230,
  ),
]);
await mkdir("n8n/workflows", { recursive: true });
for (const [name, value] of [
  ["request-notification", request],
  ["overdue-reminders", overdue],
  ["error-handler", errors],
])
  await writeFile(
    `n8n/workflows/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
  );
console.log(
  "Exported three workflows without credentials. Link the error workflow after import.",
);
