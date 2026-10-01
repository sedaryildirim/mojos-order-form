"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dishes", label: "Dishes" },
  { href: "/batch-recipes", label: "Batch recipes" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/orders", label: "What to buy" },
];

export function NavLinks() {
  const pathname = usePathname() ?? "";

  return (
    <div>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
