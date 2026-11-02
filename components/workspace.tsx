"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Brand, ToolIcon } from "./brand";
import {
  categories,
  conditions,
  todayUTC,
  type Category,
  type Status,
} from "@/lib/domain";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  LayoutGrid,
  Package,
  Inbox,
  Send,
  Search,
  Plus,
  X,
  ShieldCheck,
  Pencil,
  Trash2,
  CalendarDays,
} from "lucide-react";
export type Tool = {
  _id: string;
  name: string;
  category: Category;
  condition: string;
  description: string;
  ownerId: string;
  ownerName: string;
  trusted: boolean;
  available: boolean;
  reservations: { start: string; end: string }[];
};
export type Loan = {
  _id: string;
  toolName: string;
  ownerId: string;
  borrowerId: string;
  ownerName: string;
  borrowerName: string;
  start: string;
  end: string;
  status: Status;
  overdue: boolean;
  activity: {
    _id: string;
    kind: string;
    status: string;
    attempts: number;
    at: number;
  }[];
};
export type ListingInput = {
  name: string;
  category: Category;
  condition: (typeof conditions)[number];
  description: string;
};
export type Person = {
  _id: string;
  displayName: string;
  role: "user" | "admin";
};
export type WorkspaceProps = {
  person: Person;
  tools: Tool[];
  loans: Loan[];
  preview?: boolean;
  account?: ReactNode;
  failures?: { _id: string; kind: string; lastError?: string }[];
  create: (input: ListingInput) => Promise<unknown>;
  edit: (id: string, input: ListingInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  request: (
    id: string,
    start: string,
    end: string,
    key: string,
  ) => Promise<unknown>;
  change: (id: string, status: Status) => Promise<unknown>;
  trust: (id: string, value: boolean) => Promise<unknown>;
  retry: (id: string) => Promise<unknown>;
};
type Tab =
  | "Browse tools"
  | "My listings"
  | "My requests"
  | "Incoming requests"
  | "Admin";
export function Workspace(props: WorkspaceProps) {
  const { person, tools, loans } = props;
  const [tab, setTab] = useState<Tab>("Browse tools");
  const [category, setCategory] = useState("All tools");
  const [search, setSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [modal, setModal] = useState<{
    type: "create" | "edit" | "request" | "remove";
    tool?: Tool;
    key: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  const incoming = loans.filter(
    (l) => l.ownerId === person._id && l.status === "pending",
  ).length;
  const listings = tools.filter((t) => t.ownerId === person._id);
  const tabs: [Tab, typeof LayoutGrid][] = [
    ["Browse tools", LayoutGrid],
    ["My listings", Package],
    ["My requests", Send],
    ["Incoming requests", Inbox],
  ];
  if (person.role === "admin") tabs.push(["Admin", ShieldCheck]);
  const visible = (tab === "My listings" ? listings : tools).filter(
    (t) =>
      (category === "All tools" || t.category === category) &&
      (!onlyAvailable || t.available) &&
      `${t.name} ${t.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const visibleLoans = loans.filter(
    (l) =>
      tab === "Admin" ||
      (tab === "My requests"
        ? l.borrowerId === person._id
        : l.ownerId === person._id),
  );
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      setModal(null);
    } catch (e) {
      const err = e as { data?: unknown; message?: string };
      setError(
        typeof err.data === "string"
          ? err.data
          : err.message || "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(type: "create" | "edit" | "request" | "remove", tool?: Tool) {
    setError("");
    setModal({ type, tool, key: crypto.randomUUID() });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!modal) return;
    if (modal.type === "request")
      return run(
        () =>
          props.request(
            modal.tool!._id,
            String(f.get("start")),
            String(f.get("end")),
            modal.key,
          ),
        "Request sent. Your neighbor will review it.",
      );
    if (modal.type === "remove")
      return run(
        () => props.remove(modal.tool!._id),
        "Listing removed. Loan history has been kept.",
      );
    const data: ListingInput = {
      name: String(f.get("name")),
      category: f.get("category") as Category,
      condition: f.get("condition") as ListingInput["condition"],
      description: String(f.get("description")),
    };
    return run(
      () =>
        modal.type === "edit"
          ? props.edit(modal.tool!._id, data)
          : props.create(data),
      modal.type === "edit"
        ? "Listing updated."
        : "Your tool is ready to share.",
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">YOUR NEIGHBORHOOD</div>
        <nav aria-label="Workspace">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "selected" : ""}
              onClick={() => {
                setTab(name);
                setCategory("All tools");
                setSearch("");
                setOnlyAvailable(false);
              }}
            >
              <Icon size={19} />
              {name}
              {name === "Incoming requests" && incoming > 0 && (
                <span className="count">{incoming}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-spark">✳</span>
          <h3>
            Good tools deserve
            <br />a second adventure.
          </h3>
          <p>
            Got something gathering dust?
            <br />
            Give it a little purpose.
          </p>
          <button onClick={() => open("create")}>
            Share a tool <ArrowUpRight size={16} />
          </button>
        </div>
        <button className="help-button" onClick={() => setHelp(!help)}>
          <CircleHelp size={18} /> A good neighbor’s guide
        </button>
        <div className="profile-row">
          <span className="avatar">{person.displayName.slice(0, 1)}</span>
          <div>
            <strong>{person.displayName}</strong>
            <span>
              {props.preview
                ? "Demo neighbor"
                : person.role === "admin"
                  ? "Administrator"
                  : "Neighborhood member"}
            </span>
          </div>
          {props.account}
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <span>
            <span className="status-dot" /> THE SHARED TOOLBOX
          </span>
          <a href="/">
            LendLoop home <ArrowUpRight size={15} />
          </a>
        </header>
        {props.preview && (
          <div className="preview-banner">
            <strong>LOCAL PREVIEW</strong> Fictional data · changes reset on
            refresh · no live authentication or notifications
          </div>
        )}
        <main id="main" className="workspace-content">
          <div className="page-title">
            <div>
              <div className="eyebrow">A LITTLE HELP, CLOSE TO HOME</div>
              <h1>
                {tab === "Browse tools" ? "What will you make today?" : tab}
              </h1>
              <p>
                {tab === "Browse tools"
                  ? "Find the right tool. Borrow from a neighbor. Bring your idea to life."
                  : tab === "My listings"
                    ? "A little generosity goes a long way. Here’s what you’re sharing."
                    : "Keep the good things going around."}
              </p>
            </div>
            <button className="button primary" onClick={() => open("create")}>
              <Plus size={18} /> List a tool
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              <Check size={18} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && !modal && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {help && (
            <div className="guide">
              <h3>A good neighbor’s guide</h3>
              <p>
                Choose an inclusive date range in UTC. Pending requests are not
                reservations. Wait for approval, arrange the handoff, and return
                the tool with care. Only the lender confirms a return. Never
                share your address or contact details in a public listing.
              </p>
            </div>
          )}
          {tab === "Browse tools" && (
            <div className="workspace-hero">
              <div>
                <span className="eyebrow">OWN LESS. DO MORE.</span>
                <h2>
                  Your next project.
                  <br />
                  Our shared toolbox.
                </h2>
                <p>The things we share bring us closer.</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setHelp(true);
                  }}
                >
                  How borrowing works <ArrowRight size={16} />
                </button>
              </div>
              <div className="mini-art">
                <span className="mini-circle" />
                <ToolIcon category="Power tools" size={100} />
                <span className="mini-spark">✳</span>
                <span className="mini-label">
                  <ShieldCheck size={16} /> Built on trust
                </span>
              </div>
            </div>
          )}
          {["Browse tools", "My listings"].includes(tab) ? (
            <>
              <div className="list-toolbar">
                <h2>
                  {tab === "My listings" ? "Your tools" : "Explore the toolbox"}{" "}
                  <span>{visible.length}</span>
                </h2>
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Find a tool…"
                    aria-label="Search tools"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="filter-row">
                <div className="filters">
                  {["All tools", ...categories].map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="available-toggle">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                  />
                  Available now
                </label>
              </div>
              <div className="tool-grid">
                {visible.map((tool) => (
                  <article key={tool._id} className="tool-card">
                    <div
                      className={`tool-art tone-${categories.indexOf(tool.category)}`}
                    >
                      <span
                        className={`availability ${tool.available ? "" : "unavailable"}`}
                      >
                        <span className="status-dot" />
                        {tool.available ? "Available now" : "On loan"}
                      </span>
                      <ToolIcon category={tool.category} size={78} />
                      <span className="art-loop" />
                    </div>
                    <div className="tool-copy">
                      <div className="tool-meta">
                        <span>{tool.category}</span>
                        <span>{tool.condition}</span>
                      </div>
                      <h3>{tool.name}</h3>
                      <p className="tool-description">{tool.description}</p>
                      <div className="owner">
                        <span className="small-avatar">
                          {tool.ownerName[0]}
                        </span>
                        <span>
                          {tool.ownerId === person._id
                            ? "Shared by you"
                            : tool.ownerName}
                        </span>
                        {tool.trusted && (
                          <span className="trusted" title="Trusted Lender">
                            <ShieldCheck size={14} /> Trusted
                          </span>
                        )}
                      </div>
                      {tool.ownerId === person._id ? (
                        <div className="card-actions">
                          <button onClick={() => open("edit", tool)}>
                            <Pencil size={15} />
                            Edit
                          </button>
                          <button onClick={() => open("remove", tool)}>
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          className="borrow-button"
                          onClick={() => open("request", tool)}
                        >
                          Request to borrow <ArrowUpRight size={16} />
                        </button>
                      )}
                      {person.role === "admin" &&
                        tool.ownerId !== person._id && (
                          <div className="card-actions">
                            <button
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    props.trust(tool.ownerId, !tool.trusted),
                                  "Lender trust updated.",
                                )
                              }
                            >
                              {tool.trusted ? "Remove trust" : "Trust lender"}
                            </button>
                            <button onClick={() => open("remove", tool)}>
                              Remove listing
                            </button>
                          </div>
                        )}
                    </div>
                  </article>
                ))}
              </div>
              {visible.length === 0 && (
                <div className="empty">
                  <Package size={38} />
                  <h3>
                    {tab === "My listings"
                      ? "Your toolbox has room to grow."
                      : "No tools found."}
                  </h3>
                  <p>
                    {tab === "My listings"
                      ? "Share your first tool using “List a tool”."
                      : "Try another search or category."}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="loan-list">
                {visibleLoans.length === 0 && (
                  <div className="empty">
                    <Inbox size={38} />
                    <h3>No requests here yet.</h3>
                    <p>Your next neighborly exchange will appear here.</p>
                  </div>
                )}
                {visibleLoans.map((l) => (
                  <article className="loan-card" key={l._id}>
                    <div className="loan-heading">
                      <div>
                        <span className="eyebrow">
                          {l.borrowerId === person._id
                            ? `FROM ${l.ownerName}`
                            : `REQUESTED BY ${l.borrowerName}`}
                        </span>
                        <h3>{l.toolName}</h3>
                        <p>
                          <CalendarDays size={16} />
                          {l.start} → {l.end}{" "}
                          <span className="muted">
                            · UTC, both dates included
                          </span>
                        </p>
                      </div>
                      <span
                        className={`loan-status status-${l.overdue ? "overdue" : l.status}`}
                      >
                        {l.overdue ? "Overdue" : l.status}
                      </span>
                    </div>
                    <div className="loan-bottom">
                      <div className="activity">
                        {l.activity.length ? (
                          l.activity.map((a) => (
                            <span key={a._id}>
                              {a.kind === "reminder"
                                ? "Reminder"
                                : "Notification"}
                              :{" "}
                              {a.status === "simulated"
                                ? "simulated by workflow"
                                : a.status === "failed"
                                  ? "failed — needs attention"
                                  : `${a.status} · ${a.attempts} attempt(s)`}
                            </span>
                          ))
                        ) : (
                          <span>No automation activity yet.</span>
                        )}
                      </div>
                      <div className="loan-actions">
                        {l.ownerId === person._id && l.status === "pending" && (
                          <>
                            <button
                              className="button outline small"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => props.change(l._id, "declined"),
                                  "Request declined.",
                                )
                              }
                            >
                              Decline
                            </button>
                            <button
                              className="button primary small"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => props.change(l._id, "approved"),
                                  "Request approved.",
                                )
                              }
                            >
                              Approve <Check size={15} />
                            </button>
                          </>
                        )}
                        {l.ownerId === person._id &&
                          l.status === "approved" && (
                            <button
                              className="button primary small"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => props.change(l._id, "returned"),
                                  "Return recorded. Thank you for sharing.",
                                )
                              }
                            >
                              Confirm return
                            </button>
                          )}
                        {l.borrowerId === person._id &&
                          l.status === "pending" && (
                            <button
                              className="button outline small"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => props.change(l._id, "cancelled"),
                                  "Request cancelled.",
                                )
                              }
                            >
                              Cancel request
                            </button>
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {tab === "Admin" && (
                <div className="guide">
                  <h3>Automation failures</h3>
                  {props.failures?.length ? (
                    props.failures.map((e) => (
                      <div className="failure-row" key={e._id}>
                        <span>
                          {e.kind}: {e.lastError}
                        </span>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => props.retry(e._id),
                              "Event queued for retry.",
                            )
                          }
                        >
                          Retry
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No terminal failures recorded.</p>
                  )}
                </div>
              )}
            </>
          )}
          <div className="workspace-footer">
            <span>Borrow what you need. Lend what you don’t.</span>
            <span>
              LendLoop <span className="brand-dot">✳</span>
            </span>
          </div>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => {
          if (!busy) setModal(null);
        }}
        onClose={() => setModal(null)}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">
            {modal?.type === "request"
              ? "Make a neighborly request"
              : modal?.type === "edit"
                ? "Edit your listing"
                : modal?.type === "remove"
                  ? "Remove this listing?"
                  : "Share something useful"}
          </h2>
          <button
            aria-label="Close dialog"
            disabled={busy}
            onClick={() => setModal(null)}
          >
            <X size={22} />
          </button>
        </div>
        {modal && (
          <form onSubmit={submit} key={modal.key}>
            {modal.type === "request" ? (
              <>
                <p className="modal-intro">
                  {modal.tool?.name} · shared by {modal.tool?.ownerName}
                </p>
                <div className="date-fields">
                  <label>
                    Borrow from
                    <input type="date" name="start" min={todayUTC()} required />
                  </label>
                  <label>
                    Return by
                    <input type="date" name="end" min={todayUTC()} required />
                  </label>
                </div>
                <p className="field-hint">
                  Both dates are included, in UTC. Up to 31 calendar days. Your
                  neighbor needs to approve first.
                </p>
                {!!modal.tool?.reservations.length && (
                  <div className="guide">
                    <strong>Existing reservations</strong>
                    {modal.tool.reservations.map((r, i) => (
                      <p key={i}>
                        {r.start} → {r.end}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : modal.type === "remove" ? (
              <p>
                “{modal.tool?.name}” will leave the toolbox. Pending requests
                will be declined. Existing loan history will be preserved.
              </p>
            ) : (
              <>
                <label>
                  Tool name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="e.g. Cordless drill"
                    defaultValue={modal.tool?.name}
                  />
                </label>
                <div className="date-fields">
                  <label>
                    Category
                    <select
                      name="category"
                      defaultValue={modal.tool?.category || "Power tools"}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Condition
                    <select
                      name="condition"
                      defaultValue={modal.tool?.condition || "Good"}
                    >
                      {conditions.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  A short description
                  <textarea
                    name="description"
                    required
                    maxLength={400}
                    rows={3}
                    defaultValue={modal.tool?.description}
                    placeholder="What should a neighbor know? Keep personal details out."
                  />
                </label>
              </>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                disabled={busy}
                className="button outline"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : modal.type === "request"
                    ? "Send request"
                    : modal.type === "remove"
                      ? "Remove listing"
                      : modal.type === "edit"
                        ? "Save changes"
                        : "List my tool"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
