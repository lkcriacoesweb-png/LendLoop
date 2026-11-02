"use client";
import { useState } from "react";
import { Workspace, type Tool, type Loan } from "./workspace";
import {
  overlaps,
  todayUTC,
  transitionAllowed,
  validateDates,
} from "@/lib/domain";
const initial: Tool[] = [
  {
    _id: "demo-drill",
    name: "Cordless drill & bit set",
    category: "Power tools",
    condition: "Good",
    description:
      "For shelves, little fixes, and your next big idea. Charger included.",
    ownerId: "morgan",
    ownerName: "Morgan R.",
    trusted: true,
    available: true,
    reservations: [],
  },
  {
    _id: "demo-garden",
    name: "Garden essentials kit",
    category: "Garden",
    condition: "Like new",
    description: "A trowel, hand fork, and a little help for your green thumb.",
    ownerId: "alex",
    ownerName: "Alex P.",
    trusted: true,
    available: true,
    reservations: [],
  },
  {
    _id: "demo-tent",
    name: "Two-person weekend tent",
    category: "Camping",
    condition: "Good",
    description:
      "Trade the city lights for a sky full of stars. Easy to set up.",
    ownerId: "sam",
    ownerName: "Sam K.",
    trusted: false,
    available: true,
    reservations: [],
  },
  {
    _id: "demo-pot",
    name: "Cast-iron Dutch oven",
    category: "Kitchen",
    condition: "Good",
    description: "Slow Sundays, homemade bread, and something worth sharing.",
    ownerId: "morgan",
    ownerName: "Morgan R.",
    trusted: true,
    available: true,
    reservations: [],
  },
  {
    _id: "demo-toolkit",
    name: "The everyday toolkit",
    category: "Other",
    condition: "Like new",
    description: "All the basics for the little things on your to-do list.",
    ownerId: "me",
    ownerName: "Jamie",
    trusted: false,
    available: true,
    reservations: [],
  },
  {
    _id: "demo-pruner",
    name: "Garden pruning shears",
    category: "Garden",
    condition: "Well used",
    description: "A trusty pair of shears. A little worn, a lot of life left.",
    ownerId: "alex",
    ownerName: "Alex P.",
    trusted: true,
    available: true,
    reservations: [],
  },
];
export function PreviewWorkspace() {
  const [tools, setTools] = useState(initial);
  const [loans, setLoans] = useState<Loan[]>([
    {
      _id: "demo-incoming",
      toolName: "The everyday toolkit",
      ownerId: "me",
      borrowerId: "sam",
      ownerName: "Jamie",
      borrowerName: "Sam K.",
      start: todayUTC(),
      end: todayUTC(),
      status: "pending",
      overdue: false,
      activity: [],
    },
  ]);
  const updateAvailability = (next: Loan[]) =>
    setTools((items) =>
      items.map((t) => {
        const booked = next.filter(
          (l) => l.toolName === t.name && l.status === "approved",
        );
        return {
          ...t,
          reservations: booked.map((l) => ({ start: l.start, end: l.end })),
          available: !booked.some((l) => l.start <= todayUTC()),
        };
      }),
    );
  return (
    <Workspace
      preview
      person={{ _id: "me", displayName: "Jamie", role: "user" }}
      tools={tools}
      loans={loans}
      create={async (input) => {
        setTools((t) => [
          ...t,
          {
            ...input,
            _id: crypto.randomUUID(),
            ownerId: "me",
            ownerName: "Jamie",
            trusted: false,
            available: true,
            reservations: [],
          },
        ]);
      }}
      edit={async (id, input) => {
        const tool = tools.find((t) => t._id === id)!;
        if (
          loans.some(
            (l) =>
              l.toolName === tool.name &&
              ["approved", "pending"].includes(l.status),
          )
        )
          throw new Error("Resolve active requests and loans before editing.");
        setTools((t) => t.map((x) => (x._id === id ? { ...x, ...input } : x)));
      }}
      remove={async (id) => {
        const tool = tools.find((t) => t._id === id)!;
        if (
          loans.some((l) => l.toolName === tool.name && l.status === "approved")
        )
          throw new Error("Record the return before removing this listing.");
        setTools((t) => t.filter((x) => x._id !== id));
        setLoans((items) =>
          items.map((l) =>
            l.toolName === tool.name && l.status === "pending"
              ? { ...l, status: "declined" }
              : l,
          ),
        );
      }}
      request={async (id, start, end, key) => {
        validateDates(start, end);
        const tool = tools.find((t) => t._id === id)!;
        if (tool.reservations.some((r) => overlaps(r, { start, end })))
          throw new Error("These dates are already reserved.");
        if (
          loans.some(
            (l) =>
              l.toolName === tool.name &&
              l.borrowerId === "me" &&
              l.status === "pending" &&
              overlaps(l, { start, end }),
          )
        )
          throw new Error("You already requested these dates.");
        setLoans((l) => [
          ...l,
          {
            _id: key,
            toolName: tool.name,
            ownerId: tool.ownerId,
            borrowerId: "me",
            ownerName: tool.ownerName,
            borrowerName: "Jamie",
            start,
            end,
            status: "pending",
            overdue: false,
            activity: [],
          },
        ]);
      }}
      change={async (id, status) => {
        const current = loans.find((l) => l._id === id)!;
        if (
          !transitionAllowed(
            current.status,
            status,
            current.ownerId === "me" ? "owner" : "borrower",
          )
        )
          throw new Error("Invalid status change.");
        const next = loans.map((l) => (l._id === id ? { ...l, status } : l));
        setLoans(next);
        updateAvailability(next);
      }}
      trust={async () => {
        throw new Error("Administrator access required.");
      }}
      retry={async () => {
        throw new Error("Automations require live integration.");
      }}
    />
  );
}
