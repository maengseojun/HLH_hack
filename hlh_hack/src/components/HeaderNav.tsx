"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function HeaderNav() {
  const pathname = usePathname();
  const items = [
    { label: "Launch", href: "/launch" },
    { label: "Index", href: "/" },
    { label: "Admin", href: "/admin" },
  ];

  const activeIndex = useMemo(() => {
    if (pathname?.startsWith("/launch")) return 0;
    if (pathname === "/" || pathname?.startsWith("/index")) return 1;
    if (pathname?.startsWith("/admin")) return 2;
    return 1;
  }, [pathname]);

  const ITEM_PX = 100; // w-28 (7rem) assuming root 16px

  return (
    <div
      className="relative inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)]/40 backdrop-blur-md p-1"
      style={{ width: ITEM_PX * items.length + 8 /* padding */ }}
    >
      {/* Active thumb */}
      <span
        className="absolute top-1 bottom-1 left-1 rounded-full bg-[color:var(--color-primary)] shadow-[0_2px_12px_rgba(0,0,0,0.25)] transition-transform duration-200"
        style={{ width: ITEM_PX, transform: `translateX(${activeIndex * ITEM_PX}px)` }}
        aria-hidden
      />
      {items.map((it, i) => (
        <Link
          key={it.href}
          href={it.href}
          className={
            "relative z-10 w-28 text-center px-4 py-2 text-sm font-semibold rounded-full " +
            (i === activeIndex
              ? "text-[color:var(--color-primary-foreground)]"
              : "text-[color:var(--color-muted-foreground)] hover:text-white")
          }
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

