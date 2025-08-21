"use client";

import { cn } from "@/lib/utils";
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from "react";

interface NumberTickerProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimalPlaces?: number;
  duration?: number;
}

export default function NumberTicker({
  value,
  className,
  prefix = "",
  suffix = "",
  decimalPlaces = 0,
  duration = 1,
}: NumberTickerProps) {
  const springValue = useSpring(value, {
    stiffness: 100,
    damping: 30,
  });
  
  const displayValue = useTransform(springValue, (latest) =>
    (latest).toFixed(decimalPlaces)
  );

  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      springValue.set(value);
      prevValueRef.current = value;
    }
  }, [value, springValue]);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}