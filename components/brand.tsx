import Link from "next/link";
import {
  ArrowUpRight,
  Sprout,
  Drill,
  Tent,
  CookingPot,
  Wrench,
  Repeat2,
} from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="LendLoop home">
      <span className="brand-mark">
        <Repeat2 size={25} />
      </span>
      LendLoop<span className="brand-dot">.</span>
    </Link>
  );
}
export function ToolIcon({
  category,
  size = 42,
}: {
  category: string;
  size?: number;
}) {
  const Icon =
    category === "Power tools"
      ? Drill
      : category === "Garden"
        ? Sprout
        : category === "Camping"
          ? Tent
          : category === "Kitchen"
            ? CookingPot
            : Wrench;
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
export function Footer() {
  return (
    <footer>
      <Brand />
      <span>Good tools. Better neighbors.</span>
      <a href="#main">
        Back to top <ArrowUpRight size={15} />
      </a>
    </footer>
  );
}
