"use client";

import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { ReactNode } from "react";

interface BlurInProps {
  children: ReactNode;
  className?: string;
  variant?: {
    hidden: { filter: string; opacity: number };
    visible: { filter: string; opacity: number };
  };
  duration?: number;
  delay?: number;
}

export default function BlurIn({
  children,
  className,
  variant,
  duration = 0.5,
  delay = 0,
}: BlurInProps) {
  const defaultVariant = {
    hidden: { filter: "blur(10px)", opacity: 0 },
    visible: { filter: "blur(0px)", opacity: 1 },
  };
  const combinedVariant = variant || defaultVariant;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
      variants={combinedVariant}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}