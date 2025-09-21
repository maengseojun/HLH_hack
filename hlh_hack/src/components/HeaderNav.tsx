"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function HeaderNav() {
  const pathname = usePathname();
  const isDev = process.env.NODE_ENV === 'development';
  
  const items = [
    { label: "Launch", href: "/" },
    { label: "Index", href: "/index" },
    ...(isDev ? [{ label: "Test", href: "/test" }] : []),
  ];

  const activeIndex = useMemo(() => {
    if (pathname === "/" ) return 0;
    if (pathname?.startsWith("/index")) return 1;
    if (isDev && pathname?.startsWith("/test")) return 2;
    return 0;
  }, [pathname, isDev]);

  const ITEM_PX = 80; // w-28 (7rem) assuming root 16px

  return (
    <div
      className="glass-nav relative inline-flex items-center rounded-full p-1"
      style={{ width: ITEM_PX * items.length + 10 }}
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
            "relative z-10 w-28 text-center px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 " +
            (i === activeIndex
              ? "text-[color:var(--color-primary-foreground)]"
              : "text-[color:var(--color-muted-foreground)] hover:text-white hover:bg-white/10 hover:-translate-y-0.5")
          }
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}
