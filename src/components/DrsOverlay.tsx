import { CheckCircle2, Eye, ShieldAlert, XCircle } from 'lucide-react';
import type { HudSnapshot } from '../types/game';

interface DrsOverlayProps {
  hud: HudSnapshot;
  onTriggerDrs: () => void;
  onAcceptOut: () => void;
  onFinishReview: () => void;
}

export function DrsOverlay({
  hud,
  onTriggerDrs,
  onAcceptOut,
  onFinishReview,
}: DrsOverlayProps) {
  if (hud.phase === 'drsPrompt' && hud.drsData) {
    const appealLabel =
      hud.drsData.dismissalType === 'edge' ? 'CAUGHT BEHIND' : 'LBW APPEAL';
    const secondsLeft = Math.max(1, Math.ceil(hud.drsCountdown));

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-rose-500/50 bg-[#091120]/95 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-rose-400">
                  ON-FIELD UMPIRE DECISION · {appealLabel}
                </div>
                <div className="font-display text-3xl font-extrabold tracking-wide text-white">
                  GIVEN OUT!
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold tracking-wider text-slate-400">
                TIMER
              </div>
              <div className="font-mono-tabular text-2xl font-extrabold text-amber-400">
                {secondsLeft}s
              </div>
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
            Close call at the crease! Use your Decision Review System ({hud.drsReviewsLeft} review
            remaining) to inspect 3D Hawk-Eye Ball Tracking.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onAcceptOut}
              className="font-display rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-lg font-extrabold tracking-wide text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
            >
              ACCEPT OUT
            </button>
            <button
              type="button"
              onClick={onTriggerDrs}
              className="font-display flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-lg font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
            >
              <Eye className="h-4 w-4" />
              <span>CALL DRS ({hud.drsReviewsLeft})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'drsReview' && hud.drsData) {
    const d = hud.drsData;
    const isEdge = d.dismissalType === 'edge';
    const metricColor = (val: string) => {
      if (val === 'HITTING STUMPS' || val === 'IN LINE') {
        return 'text-rose-400';
      }
      if (val === "UMPIRE'S CALL") {
        return 'text-amber-300';
      }
      return 'text-emerald-400';
    };

    return (
      <div className="pointer-events-none fixed right-4 bottom-6 left-4 z-30 flex justify-end sm:left-auto sm:right-6">
        <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-cyan-400/40 bg-[#070f1d]/95 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-cyan-400">
                THIRD UMPIRE · HAWK-EYE TRACKING
              </div>
              <div className="font-display text-2xl font-extrabold tracking-wide text-white">
                DRS BALL TRACKING
              </div>
            </div>
            <Eye className="h-5 w-5 text-cyan-400" />
          </div>

          <div className="mt-3 space-y-2">
            {isEdge && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-xs">
                <span className="font-semibold tracking-wider text-slate-400">
                  ULTRAEDGE
                </span>
                <span
                  className={`font-bold ${
                    d.ultraEdgeSpike ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {d.ultraEdgeSpike ? 'SPIKE DETECTED' : 'FLAT LINE — NO BAT'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-xs">
              <span className="font-semibold tracking-wider text-slate-400">
                PITCHING
              </span>
              <span className={`font-bold ${metricColor(d.pitchingLabel)}`}>
                {d.pitchingLabel}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-xs">
              <span className="font-semibold tracking-wider text-slate-400">
                IMPACT
              </span>
              <span className={`font-bold ${metricColor(d.impactLabel)}`}>
                {d.impactLabel}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/85 px-3 py-2 text-xs">
              <span className="font-semibold tracking-wider text-slate-400">
                WICKETS
              </span>
              <span className={`font-bold ${metricColor(d.wicketsLabel)}`}>
                {d.wicketsLabel}
              </span>
            </div>
          </div>

          {/* Umpire Signal Banner */}
          <div
            className={`mt-3.5 flex items-center justify-between rounded-xl border px-3.5 py-3 ${
              d.overturned
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-500/60 bg-rose-500/15 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {d.overturned ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-6 w-6 shrink-0 text-rose-400" />
              )}
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase opacity-80">
                  THIRD UMPIRE SIGNAL
                </div>
                <div className="font-display text-2xl font-extrabold tracking-wide">
                  {d.overturned ? 'NOT OUT — OVERTURNED' : 'OUT — DECISION STANDS'}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onFinishReview}
            className="font-display mt-3.5 w-full rounded-xl bg-white/12 px-4 py-2.5 text-base font-extrabold tracking-wide text-white transition-colors hover:bg-white/20 cursor-pointer"
          >
            CONTINUE MATCH
          </button>
        </div>
      </div>
    );
  }

  return null;
}
