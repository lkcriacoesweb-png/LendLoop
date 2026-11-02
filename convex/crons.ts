import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "dispatch durable request events",
  { minutes: 1 },
  internal.dispatch.run,
  {},
);
crons.interval(
  "expire replay receipts",
  { minutes: 10 },
  internal.automation.cleanup,
  {},
);
export default crons;
