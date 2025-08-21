"use client";

import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { ReactNode, useState } from "react";

interface RippleProps {
  children: ReactNode;
  className?: string;
  color?: string;
  duration?: number;
}

export default function Ripple({
  children,
  className,
  color = "#898AC4",
  duration = 0.6,
}: RippleProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, duration * 1000);
  };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onClick={createRipple}
    >
      {children}
      {ripples.map(ripple => (
        <motion.div
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            backgroundColor: color,
            opacity: 0.3,
          }}
          initial={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}