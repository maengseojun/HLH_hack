"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BorderBeamProps {
  children: ReactNode;
  className?: string;
  size?: number;
  duration?: number;
  anchor?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}

export default function BorderBeam({
  children,
  className,
  size = 200,
  duration = 15,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = "#898AC4",
  colorTo = "#C0C9EE",
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-background p-px",
        className
      )}
      style={{
        background: `conic-gradient(from ${anchor}deg, transparent, ${colorFrom}, ${colorTo}, transparent)`,
        animation: `spin ${duration}s linear infinite`,
      }}
    >
      <div
        className="h-full w-full rounded-lg bg-background"
        style={{
          margin: `${borderWidth}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}