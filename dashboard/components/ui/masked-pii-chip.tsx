"use client";

import { useState } from "react";
import { Lock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MaskedPiiChipProps {
  label: string;
  maskedValue?: string;
  unmaskedValue?: string;
  entityType?: string;
  className?: string;
}

export function MaskedPiiChip({
  label,
  maskedValue,
  unmaskedValue,
  entityType,
  className,
}: MaskedPiiChipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 bg-accentSoft border border-[#C9D0E0] text-accent font-mono text-[11px] px-1.5 py-0.5 rounded-[2px] cursor-help transition-colors hover:border-accent/40",
          className
        )}
      >
        <Lock size={10} className="text-accent shrink-0" />
        <span>{label}</span>
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap bg-ink text-paper text-[11px] font-mono px-2 py-1 rounded-[2px] shadow-none pointer-events-none border border-borderStrong">
          <div className="flex items-center gap-1.5">
            {entityType && <span className="text-inkFaint uppercase text-[9px]">{entityType}:</span>}
            <span className="font-semibold">{unmaskedValue || maskedValue || "[REDACTED_PII]"}</span>
          </div>
          <div className="text-[9px] text-inkFaint mt-0.5">Encrypted Vault Token (Audited)</div>
        </div>
      )}
    </span>
  );
}
