import type { ReactNode } from 'react';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  rightSlot?: ReactNode;
}

export function SectionHeader({ eyebrow, title, subtitle, rightSlot }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        <div className="text-xs font-semibold tracking-[0.18em] uppercase text-[#02808F] mb-1.5 tabular-nums">
          {eyebrow}
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1B1B2F] tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-sm italic text-[#6B7280] mt-1.5 max-w-2xl">
          {subtitle}
        </p>
      </div>
      {rightSlot && <div className="shrink-0 no-print">{rightSlot}</div>}
    </div>
  );
}

interface AlternatingKpiCardProps {
  index: number; // 0-based -> even = #02808F, odd = #00A795
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
}

export function AlternatingKpiCard({ index, icon, title, value, description }: AlternatingKpiCardProps) {
  const bgClass = index % 2 === 0 ? 'bg-[#02808F]' : 'bg-[#00A795]';

  return (
    <div
      className={`${bgClass} rounded-[6px] p-6 text-white flex flex-col justify-between min-h-[176px] print-break-avoid`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-11 h-11 rounded-full bg-[#0A2E36] text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-white/80 tabular-nums pt-1">
          0{index + 1}
        </span>
      </div>
      <div className="mt-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/90">
          {title}
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums tracking-tight">
          {value}
        </div>
        <p className="text-xs sm:text-sm text-white/90 mt-2 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
