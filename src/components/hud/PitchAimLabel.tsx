import type { BowlingAimCursorHud } from '../../types/game';

interface PitchAimLabelProps {
  aimCursor: BowlingAimCursorHud;
}

export function PitchAimLabel({ aimCursor }: PitchAimLabelProps) {
  if (!aimCursor.visible) {
    return null;
  }

  const lengthAccent =
    aimCursor.lengthLabel === 'YORKER'
      ? 'text-rose-400'
      : aimCursor.lengthLabel === 'FULL'
        ? 'text-amber-300'
        : aimCursor.lengthLabel === 'GOOD LENGTH'
          ? 'text-emerald-400'
          : 'text-sky-300';

  const maxW = typeof window !== 'undefined' ? window.innerWidth - 196 : 1000;
  const maxH = typeof window !== 'undefined' ? window.innerHeight - 180 : 700;
  const left = Math.min(maxW, Math.max(12, Math.round(aimCursor.screenX + 24)));
  const top = Math.min(maxH, Math.max(74, Math.round(aimCursor.screenY - 26)));

  return (
    <div
      className="pointer-events-none fixed z-15 select-none rounded-lg border border-yellow-400/50 bg-[#070d19]/90 px-2.5 py-1.5 shadow-xl"
      style={{ left, top }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-display text-sm font-extrabold tracking-wide ${lengthAccent}`}>
          {aimCursor.lengthLabel}
        </span>
        <span aria-hidden="true" className="text-slate-600">
          ·
        </span>
        <span className="font-mono-tabular text-[11px] font-bold text-white">
          {aimCursor.distanceMeters.toFixed(1)}m
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-slate-300">
        <span>{aimCursor.lineLabel}</span>
        {aimCursor.locked && (
          <>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-rose-400">LOCKED</span>
          </>
        )}
      </div>
    </div>
  );
}
