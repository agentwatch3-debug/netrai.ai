import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "outline" | "ghost" | "destructive" | "accent";
  size?: "sm" | "default" | "lg" | "icon";
}

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const variantClasses = {
    default: "border border-border bg-surface text-ink hover:bg-accentSoft hover:text-accent hover:border-borderStrong",
    primary: "border border-ink bg-ink text-paper hover:bg-ink/90",
    accent: "border border-accent bg-accent text-white hover:bg-accent/90",
    outline: "border border-border bg-transparent text-ink hover:bg-paper hover:border-borderStrong",
    ghost: "border border-transparent bg-transparent text-inkDim hover:bg-paper hover:text-ink",
    destructive: "border border-bad bg-bad text-white hover:bg-bad/90",
  }[variant];

  const sizeClasses = {
    sm: "h-7 px-2.5 text-xs",
    default: "h-8 px-3 text-xs",
    lg: "h-9 px-4 text-sm",
    icon: "h-8 w-8 p-0",
  }[size];

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-none font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
        variantClasses,
        sizeClasses,
        className
      )}
      {...props}
    />
  );
}
