"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = string | { label: string; value: string };

export default function Dropdown({
  options,
  value,
  onChange,
  align = "right",
  buttonClassName = "",
}: {
  options: Option[];
  value?: string;
  onChange: (v: string) => void;
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number; w: number } | null>(null);

  const list = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { label: o, value: o } : { label: o.label, value: o.value },
      ),
    [options],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!btnRef.current) return;
      if (!document.getElementById("dropdown-portal")) return;
      // Close if clicking outside of button or portal box
      const target = e.target as Node;
      if (!btnRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const openMenu = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ x: r.left + (align === "left" ? 0 : r.width), y: r.bottom + window.scrollY, w: r.width });
    setOpen(true);
  };

  const selected = list.find((o) => o.value === value) || list[0];

  return (
    <>
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : openMenu}
        className={
          "glass-input flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-white " +
          buttonClassName
        }
      >
        <span>{selected?.label}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div id="dropdown-portal" className="absolute z-[300]" style={{ left: align === "left" ? pos.x : pos.x - Math.max(220, pos.w), top: pos.y }}>
              <div className="glass-dropdown w-[220px] max-h-60 overflow-auto rounded-[12px] p-1">
                {list.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={
                      "w-full text-left px-3 py-1 rounded-[8px] text-sm " +
                      (o.value === selected?.value
                        ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                        : "text-white hover:bg-[color:var(--color-muted)]")
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

