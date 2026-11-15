import { ArrowRightLeft, Play, Trophy } from 'lucide-react';
import type { HudSnapshot } from '../types/game';

interface InningsBreakModalProps {
  hud: HudSnapshot;
  onStartSecondInnings: () => void;
}

export function InningsBreakModal({
  hud,
  onStartSecondInnings,
}: InningsBreakModalProps) {
  const first = hud.firstInningsSummary;
  if (!first || hud.target === null) return null;

  const playerLabel = (hud.playerProfile.playerName || 'STRIKER').toUpperCase();
  const firstBattingLabel =
    first.battingTeam === 'user' ? `YOU (${playerLabel})` : 'OPPONENT XI';
  const nextBattingLabel =
    first.battingTeam === 'user' ? 'OPPONENT XI' : `YOU (${playerLabel})`;
  const nextIsUserBatting = first.battingTeam === 'ai';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/55 px-4">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/15 bg-[#0a111f]/96 p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold tracking-wider text-amber-400">
          INNINGS BREAK · {hud.oversCount}-OVER MATCH
        </div>
        <h2 className="font-display mt-1 text-4xl font-extrabold tracking-tight text-white">
          TARGET SET: {hud.target} RUNS
        </h2>

        {/* 1st Innings Scorecard */}
        <div className="mt-4 rounded-xl border border-white/12 bg-slate-900/90 p-4 text-left">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-slate-400">
                1ST INNINGS SCORECARD
              </div>
              <div className="font-display text-xl font-extrabold text-white">
                {firstBattingLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-extrabold leading-none text-emerald-400 tabular-nums">
                {first.runs}/{first.wickets}
              </div>
              <div className="mt-0.5 font-mono-tabular text-[11px] text-slate-400">
                {first.ballsBowled}/{hud.totalBalls} balls · {first.sixesHit} six
                {first.sixesHit === 1 ? '' : 'es'}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {first.history.map((item) => (
              <div
                key={item.ballNumber}
                className={`font-mono-tabular flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold ${
                  item.code === '6'
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                    : item.code === '4'
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : item.code === 'W'
                        ? 'border-rose-500/70 bg-rose-500/25 text-rose-300'
                        : 'border-white/15 bg-slate-800 text-slate-200'
                }`}
              >
                {item.code === '0' ? '•' : item.code}
              </div>
            ))}
          </div>
        </div>

        {/* Exact Target & Role Swap */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-3">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold tracking-wider text-amber-300">
              <Trophy className="h-3.5 w-3.5" />
              <span>TARGET TO WIN</span>
            </div>
            <div className="font-display mt-0.5 text-3xl font-extrabold text-amber-300 tabular-nums">
              {hud.target} RUNS
            </div>
            <div className="text-[11px] text-slate-300">
              in {hud.totalBalls} balls
            </div>
          </div>

          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold tracking-wider text-emerald-300">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>2ND INNINGS ROLE</span>
            </div>
            <div className="font-display mt-0.5 text-2xl font-extrabold text-white">
              {nextIsUserBatting ? 'YOU BAT' : 'YOU BOWL'}
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              {nextBattingLabel} chasing
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartSecondInnings}
          className="font-display mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-2xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
        >
          <Play className="h-5 w-5 fill-current" />
          <span>START 2ND INNINGS</span>
        </button>
      </div>
    </div>
  );
}
