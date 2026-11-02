export const categories = [
  "Power tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export const conditions = ["Like new", "Good", "Well used"] as const;
export type Status =
  "pending" | "approved" | "declined" | "cancelled" | "returned";
export function todayUTC(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateDates(start: string, end: string, now = Date.now()) {
  if (!validDate(start) || !validDate(end))
    throw new Error("Use valid calendar dates.");
  if (start < todayUTC(now))
    throw new Error("The start date cannot be in the past (UTC).");
  if (end < start)
    throw new Error("The return date must be on or after the start date.");
  if (Date.parse(end) - Date.parse(start) > 30 * 86400000)
    throw new Error("A loan may span at most 31 calendar days.");
  if (Date.parse(start) - Date.parse(todayUTC(now)) > 365 * 86400000)
    throw new Error("Book within the next year.");
}
export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
) {
  return a.start <= b.end && b.start <= a.end;
}
export function transitionAllowed(
  from: Status,
  to: Status,
  actor: "owner" | "borrower" | "other",
) {
  if (actor === "owner")
    return (
      (from === "pending" && ["approved", "declined"].includes(to)) ||
      (from === "approved" && to === "returned")
    );
  return actor === "borrower" && from === "pending" && to === "cancelled";
}
