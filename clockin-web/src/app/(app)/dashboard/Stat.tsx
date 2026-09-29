import { cn } from '@/lib/cn';

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-slate">{label}</p>
      <p
        className={cn(
          'mt-2 text-[1.75rem] font-semibold tracking-tight tabular-nums',
          accent ? 'text-coral' : 'text-navy',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate">{hint}</p> : null}
    </div>
  );
}
