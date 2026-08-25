import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={cn("inline-flex h-9 items-center justify-center rounded-md bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50", className)} {...props} />; }
