import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatItemProps {
  label: string;
  value: ReactNode;
  subtext?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
}

export function StatRow({
  items,
  className,
}: {
  items: StatItemProps[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 divide-y divide-border border border-border bg-surface sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:divide-x lg:divide-y-0 text-ink",
        className
      )}
    >
      {items.map((item, idx) => (
        <div key={idx} className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] uppercase tracking-wide text-inkFaint font-medium font-sans">
              {item.label}
            </span>
            {item.badge || item.icon}
          </div>
          <div className={cn("text-xl font-bold font-mono text-ink", item.valueClassName)}>
            {item.value}
          </div>
          {item.subtext && (
            <p className="text-[11px] text-inkDim font-sans truncate">{item.subtext}</p>
          )}
        </div>
      ))}
    </div>
  );
}
