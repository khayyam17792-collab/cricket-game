import { Camera, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { CameraMode, HudSnapshot } from '../types/game';

interface ScoreboardHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onRestart: () => void;
}

const CAMERA_LABELS: Record<CameraMode, string> = {
  batter: 'Batter View',
  bowler: 'Bowler View',
  side: 'Broadcast Side View',
};

export function ScoreboardHUD({
  hud,
  muted,
  onToggleMute,
  onCycleCamera,
  onRestart,
}: ScoreboardHUDProps) {
  if (hud.phase === 'customize' || hud.phase === 'toss') {
    return null;
  }

  const hasTarget = hud.inningsNumber === 2 && hud.target !== null;
  const runsNeeded = hasTarget ? Math.max(0, hud.target! - hud.runs) : 0;

  let equationText =
    hud.inningsRole === 'batting' ? 'Setting Target' : 'Bowl First';
  if (hasTarget) {
    if (hud.inningsRole === 'batting') {
      equationText =
        hud.matchResult === 'won'
          ? 'Target Reached'
          : hud.matchResult === 'lost'
            ? `Short by ${runsNeeded}`
            : hud.matchResult === 'tied'
              ? 'Scores Level'
              : `Need ${runsNeeded} off ${hud.ballsLeft}`;
    } else {
      equationText =
        hud.matchResult === 'won'
          ? 'Target Defended'
          : hud.matchResult === 'lost'
            ? 'Target Breached'
            : hud.matchResult === 'tied'
              ? 'Scores Level'
              : `Defend ${runsNeeded} off ${hud.ballsLeft}`;
    }
  }

  const compactStrip = hud.totalBalls > 6;

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-start px-3 pt-3 sm:px-6 sm:pt-4 lg:justify-center">
        <div className="pointer-events-auto mr-36 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#0a111f]/92 px-4 py-2.5 shadow-2xl lg:mr-0">
          {/* Team Score & Wickets */}
          <div className="flex items-baseline gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400">
                <span className="text-slate-200">
                  {hud.inningsNumber === 1 ? '1ST INN' : '2ND INN'}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    hud.inningsRole === 'batting'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  {hud.inningsRole === 'batting' ? 'BATTING' : 'BOWLING'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {hud.bowlingEnd === 'cathedral'
                    ? 'Cathedral End'
                    : 'Pavilion End'}
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden text-cyan-300 sm:inline">
                  DRS {hud.drsReviewsLeft}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-extrabold leading-none text-white tabular-nums sm:text-4xl">
                  {hud.runs}
                  <span className="text-slate-400">/</span>
                  {hud.wickets}
                </span>
                <span className="text-xs font-medium text-slate-400 tabular-nums">
                  ({hud.maxWickets} max)
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10" aria-hidden="true" />

            {/* Target & Balls Left */}
            <div className="flex items-center gap-4 sm:gap-5">
              <div>
                <div className="text-[11px] font-medium text-slate-400">
                  {hasTarget ? 'Target' : 'Format'}
                </div>
                <div className="font-mono-tabular text-base font-bold text-amber-400 sm:text-lg">
                  {hasTarget
                    ? hud.target
                    : `${hud.oversCount} Over${hud.oversCount > 1 ? 's' : ''}`}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-400">
                  Balls Left
                </div>
                <div className="font-mono-tabular text-base font-bold text-emerald-400 sm:text-lg">
                  {hud.ballsLeft}
                  <span className="text-xs font-normal text-slate-400">
                    /{hud.totalBalls}
                  </span>
                </div>
              </div>

              <div className="hidden sm:block">
                <div className="text-[11px] font-medium text-slate-400">
                  Equation
                </div>
                <div className="font-mono-tabular text-sm font-semibold text-slate-100 whitespace-nowrap">
                  {equationText}
                </div>
              </div>
            </div>
          </div>

          {/* Ball-by-Ball Over Strip & Audio/Restart */}
          <div className="flex items-center gap-3">
            <div
              className="flex flex-wrap items-center gap-1"
              aria-label="Innings ball-by-ball history"
            >
              {Array.from({ length: hud.totalBalls }).map((_, idx) => {
                const rec = hud.history[idx];
                let cellClass =
                  'border-white/12 bg-slate-900/80 text-slate-500';
                if (rec) {
                  if (rec.code === '6') {
                    cellClass =
                      'border-amber-400/60 bg-amber-500/20 text-amber-300';
                  } else if (rec.code === '4') {
                    cellClass =
                      'border-emerald-400/60 bg-emerald-500/20 text-emerald-300';
                  } else if (rec.code === 'W') {
                    cellClass =
                      'border-rose-500/70 bg-rose-500/25 text-rose-300';
                  } else if (rec.code === '0') {
                    cellClass = 'border-white/20 bg-slate-800 text-slate-300';
                  } else {
                    cellClass = 'border-sky-400/50 bg-sky-500/20 text-sky-200';
                  }
                }

                return (
                  <div
                    key={idx}
                    className={`font-mono-tabular flex items-center justify-center rounded-md border font-bold ${
                      compactStrip
                        ? 'h-6 w-6 text-[11px]'
                        : 'h-7 w-7 text-xs'
                    } ${cellClass}`}
                  >
                    {rec ? (rec.code === '0' ? '•' : rec.code) : ''}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 border-l border-white/10 pl-2.5">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-slate-800/80 text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={onRestart}
                title="Restart Match"
                aria-label="Restart Match"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-slate-800/80 text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Dedicated Top-Right Corner Camera Toggle Button */}
      <button
        type="button"
        onClick={onCycleCamera}
        title="Switch Camera Angle (C)"
        className="fixed top-3 right-3 z-20 flex min-h-[42px] items-center gap-2 rounded-xl border border-white/15 bg-[#0a111f]/92 px-3.5 py-2 text-xs font-semibold text-slate-100 shadow-2xl transition-colors hover:border-amber-400/50 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer sm:top-4 sm:right-4"
      >
        <Camera className="h-4 w-4 text-amber-400" />
        <span>{CAMERA_LABELS[hud.cameraMode]}</span>
      </button>
    </>
  );
}
