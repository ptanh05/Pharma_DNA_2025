"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SkeletonTransitionProps {
  isLoading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  fadeDelay?: number;
  className?: string;
}

/**
 * Smoothly transitions from skeleton loading to content.
 * Skeleton fades out, content fades in — no jarring swap.
 */
export function SkeletonTransition({
  isLoading,
  skeleton,
  children,
  fadeDelay = 150,
  className,
}: SkeletonTransitionProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), fadeDelay);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isLoading, fadeDelay]);

  return (
    <div className={cn("relative", className)}>
      {isLoading && (
        <div
          className={cn(
            "transition-all duration-200",
            showContent ? "opacity-0" : "opacity-100"
          )}
        >
          {skeleton}
        </div>
      )}
      <div
        className={cn(
          "transition-all duration-300",
          isLoading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
