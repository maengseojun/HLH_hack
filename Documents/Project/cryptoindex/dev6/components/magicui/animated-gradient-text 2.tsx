"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AnimatedGradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
}

export default function AnimatedGradientText({
  children,
  className,
  colors = ["#555879", "#898AC4", "#A2AADB", "#C0C9EE"]
}: AnimatedGradientTextProps) {
  return (
    <div
      className={cn(
        "relative inline-block bg-gradient-to-r bg-clip-text text-transparent",
        "animate-gradient bg-[length:200%_200%]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(45deg, ${colors.join(", ")})`
      }}
    >
      {children}
    </div>
  );
}