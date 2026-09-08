import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "good" | "bad" | "warn" | "neutral" | "accent" | "default" | "secondary";
  dot?: boolean;
}

export function Badge({ className = "", variant = "default", dot = true, children, ...props }: BadgeProps) {
  let colorClass = "text-inkDim";

  // Check variant or infer from legacy background class patterns
  if (variant === "good" || className.includes("emerald") || className.includes("green")) {
    colorClass = "text-good";
  } else if (variant === "bad" || className.includes("red") || className.includes("rose") || className.includes("destructive")) {
    colorClass = "text-bad";
  } else if (variant === "warn" || className.includes("amber") || className.includes("yellow")) {
    colorClass = "text-warn";
  } else if (variant === "accent" || className.includes("blue") || className.includes("purple") || className.includes("indigo")) {
    colorClass = "text-accent";
  }

  // Filter out heavy background fills and borders for the minimalist dot pattern
  const sanitizedClassName = className
    .replace(/\bbg-\S+/g, "")
    .replace(/\bborder-\S+/g, "")
    .replace(/\brounded-\S+/g, "")
    .replace(/\bshadow-\S+/g, "")
    .trim();

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-mono font-normal bg-transparent border-0 p-0 select-none",
        colorClass,
        sanitizedClassName
      )}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full inline-block mr-1.5 shrink-0"
          style={{ backgroundColor: "currentColor" }}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
