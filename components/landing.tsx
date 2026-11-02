"use client";
import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Brand, Footer, ToolIcon } from "./brand";
import { configured } from "./providers";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  HeartHandshake,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/domain";
function Login({ small = false }: { small?: boolean }) {
  const { isSignedIn } = useUser();
  return isSignedIn ? (
    <Link className="button primary" href="/workspace">
      Open my neighborhood <ArrowRight size={17} />
    </Link>
  ) : (
    <SignInButton mode="modal" forceRedirectUrl="/workspace">
      <button className={small ? "button primary small" : "button primary"}>
        Sign in to lend or borrow <ArrowUpRight size={17} />
      </button>
    </SignInButton>
  );
}
function LiveCatalog() {
  const tools = useQuery(api.tools.publicAvailable, {});
  return <Catalog tools={tools} />;
}
function Catalog({
  tools,
}: {
  tools: { name: string; category: string }[] | undefined;
}) {
  const [filter, setFilter] = useState("All tools");
  const visible = tools?.filter(
    (t) => filter === "All tools" || t.category === filter,
  );
  return (
    <>
      <div className="filters" aria-label="Filter by category">
        {["All tools", ...categories].map((c) => (
          <button
            key={c}
            aria-pressed={filter === c}
            className={filter === c ? "active" : ""}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="public-grid">
        {!tools ? (
          <p className="empty" role="status">
            Loading the neighborhood…
          </p>
        ) : !visible?.length ? (
          <p className="empty">
            No tools in this category yet. Be the first to share one.
          </p>
        ) : (
          visible.map((t, i) => (
            <article className="public-card" key={`${t.name}-${i}`}>
              <div
                className={`tool-art tone-${categories.indexOf(t.category as (typeof categories)[number])}`}
              >
                <ToolIcon category={t.category} size={70} />
                <span className="art-loop" />
              </div>
              <div className="public-card-copy">
                <span className="eyebrow">{t.category}</span>
                <h3>{t.name}</h3>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
export function Landing() {
  return (
    <>
      <header className="topbar">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#tools">Explore tools</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        {configured ? (
          <Login small />
        ) : (
          <Link className="button outline small" href="/preview">
            Explore local preview <ArrowUpRight size={16} />
          </Link>
        )}
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">
              <span className="status-dot" /> BIG IDEAS START NEXT DOOR
            </span>
            <h1>
              A little less buying.
              <br />A lot more <em>sharing.</em>
            </h1>
            <p>
              That one-time project doesn’t need a brand-new tool.
              <br className="desktop-break" /> Borrow from a neighbor. Make
              something good.
            </p>
            <div className="hero-actions">
              {configured ? (
                <Login />
              ) : (
                <Link className="button primary" href="/preview">
                  Explore the neighborhood <ArrowUpRight size={19} />
                </Link>
              )}
              <a className="text-link" href="#how-it-works">
                See how it works <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-foot">
              <ShieldCheck size={18} />
              <span>A little trust goes a long way.</span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustration of tools shared between neighbors"
            role="img"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-star">✳</span>
            <div className="floating-label top-label">
              <span className="status-dot" /> More sharing, less stuff
            </div>
            <div className="illustration-card drill-card">
              <ToolIcon category="Power tools" size={112} />
              <span>For your next big idea.</span>
            </div>
            <div className="illustration-card garden-card">
              <ToolIcon category="Garden" size={92} />
            </div>
            <div className="illustration-card tent-card">
              <ToolIcon category="Camping" size={78} />
            </div>
            <div className="floating-label bottom-label">
              <HeartHandshake size={21} /> Better, together.
            </div>
            <span className="art-arrow">↗</span>
          </div>
        </section>
        <div className="values-strip">
          <span>
            <Check />
            Save a little money
          </span>
          <span>
            <SproutIcon />
            Make less waste
          </span>
          <span>
            <HeartHandshake />
            Meet your neighbors
          </span>
        </div>
        <section className="section catalog-section" id="tools">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE NEIGHBORHOOD TOOLBOX</span>
              <h2>
                Big possibilities.
                <br />
                Just around the corner.
              </h2>
            </div>
            <p>
              From a quick fix to a weekend adventure,
              <br />
              the right tool might already be nearby.
            </p>
          </div>
          {configured ? (
            <LiveCatalog />
          ) : (
            <>
              <div className="setup-note">
                <Sparkles size={19} />
                <div>
                  <strong>Your neighborhood starts here.</strong>
                  <p>
                    Live listings will appear when Clerk and Convex are
                    connected. Take a look around the separate local preview in
                    the meantime.
                  </p>
                </div>
                <Link href="/preview" className="text-link">
                  Open preview <ArrowRight size={17} />
                </Link>
              </div>
            </>
          )}
        </section>
        <section className="how-section section" id="how-it-works">
          <div>
            <span className="eyebrow">GOOD THINGS GO AROUND</span>
            <h2>
              Borrow. Make.
              <br />
              Return. Repeat.
            </h2>
            <p>A simpler way to get things done.</p>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Find your missing piece",
                "Explore the toolbox and choose the dates you need.",
              ],
              [
                "02",
                "Make a neighborly request",
                "Your neighbor confirms. Arrange the handoff together.",
              ],
              [
                "03",
                "Give it back. Pass it on.",
                "Return it with care. Lend something of your own next time.",
              ],
            ].map(([n, title, text]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="closing">
          <HeartHandshake size={36} />
          <h2>
            A stronger neighborhood
            <br />
            starts with something small.
          </h2>
          <p>A drill. A ladder. A little generosity.</p>
          {configured ? (
            <Login />
          ) : (
            <Link href="/preview" className="button cream">
              Take a look around <MoveUpRight size={17} />
            </Link>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
function SproutIcon() {
  return <ToolIcon category="Garden" size={21} />;
}
