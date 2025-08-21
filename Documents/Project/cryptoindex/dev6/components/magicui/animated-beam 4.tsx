"use client";

import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { ReactNode, useEffect, useRef, useState } from "react";

interface AnimatedBeamProps {
  className?: string;
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export default function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 1,
  delay = 0,
  pathColor = "#898AC4",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#898AC4",
  gradientStopColor = "#C0C9EE",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}: AnimatedBeamProps) {
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const fromRect = fromRef.current.getBoundingClientRect();
        const toRect = toRef.current.getBoundingClientRect();

        const startX = fromRect.left - containerRect.left + fromRect.width / 2 + startXOffset;
        const startY = fromRect.top - containerRect.top + fromRect.height / 2 + startYOffset;
        const endX = toRect.left - containerRect.left + toRect.width / 2 + endXOffset;
        const endY = toRect.top - containerRect.top + toRect.height / 2 + endYOffset;

        const controlX = startX + (endX - startX) / 2;
        const controlY = startY + (endY - startY) / 2 + curvature;

        const d = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
        setPathD(d);
        setSvgDimensions({ width: containerRect.width, height: containerRect.height });
      }
    };

    updatePath();
    const handleResize = () => updatePath();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset]);

  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={gradientStartColor} stopOpacity="0" />
          <stop offset="50%" stopColor={gradientStopColor} stopOpacity="1" />
          <stop offset="100%" stopColor={gradientStartColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        ref={pathRef}
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        fill="none"
      />
      <path
        d={pathD}
        stroke="url(#beam-gradient)"
        strokeWidth={pathWidth}
        fill="none"
        strokeDasharray="20 20"
        strokeLinecap="round"
      >
        <motion.animate
          attributeName="stroke-dashoffset"
          values={reverse ? ["0", "40"] : ["40", "0"]}
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </path>
    </svg>
  );
}