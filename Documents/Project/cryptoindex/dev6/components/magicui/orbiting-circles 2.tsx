"use client";

import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { ReactNode } from "react";

interface OrbitingCirclesProps {
  className?: string;
  children?: ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
}

export default function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-cryptoindex-medium/20 stroke-1 fill-none"
            cx="50%"
            cy="50%"
            r={radius}
          />
        </svg>
      )}

      <motion.div
        className={cn(
          "absolute flex size-full transform-gpu items-center justify-center rounded-full",
          className
        )}
        style={{
          transformOrigin: `${radius}px ${radius}px`,
        }}
        animate={{
          rotate: reverse ? -360 : 360,
        }}
        transition={{
          duration,
          delay,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        <div className="flex size-2 items-center justify-center rounded-full bg-cryptoindex-accent">
          {children}
        </div>
      </motion.div>
    </>
  );
}