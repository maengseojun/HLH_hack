"use client";

import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { ReactNode } from "react";

interface SlideInProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  delay?: number;
}

export default function SlideIn({
  children,
  className,
  direction = "up",
  duration = 0.4,
  delay = 0,
}: SlideInProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { opacity: 0, y: 20 };
      case "down":
        return { opacity: 0, y: -20 };
      case "left":
        return { opacity: 0, x: 20 };
      case "right":
        return { opacity: 0, x: -20 };
      default:
        return { opacity: 0, y: 20 };
    }
  };

  const getFinalPosition = () => {
    switch (direction) {
      case "up":
      case "down":
        return { opacity: 1, y: 0 };
      case "left":
      case "right":
        return { opacity: 1, x: 0 };
      default:
        return { opacity: 1, y: 0 };
    }
  };

  return (
    <motion.div
      initial={getInitialPosition()}
      animate={getFinalPosition()}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}