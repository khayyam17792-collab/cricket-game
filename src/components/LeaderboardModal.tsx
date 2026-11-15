import { Trash2, Trophy, X } from 'lucide-react';
import { LeaderboardEntry, TEAM_KITS } from '../types/game';

interface LeaderboardModalProps {
  isOpen: boolean;
  entries: LeaderboardEntry[];
  onClose: () => void;
  onClear: () => void;
}

export function LeaderboardModal({
  isOpen,
  entries,
  onClose,
  onClear,
}: LeaderboardModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Top Scorers Leaderboard"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/15 bg-[#08101f]/96 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-wider text-amber-400">
                DEVFEST STAGE HALL OF FAME
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-wide text-white">
                TOP SCORERS LEADERBOARD
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Entries Table */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-6 py-10 text-center">
              <div className="font-display text-xl font-bold text-slate-200">
                NO SCORES RECORDED YET
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Complete a 6-ball Super Over innings to post your score on the stage leaderboard.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/65">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-white/10 bg-slate-900/90 text-[11px] font-semibold tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">PLAYER</th>
                    <th className="px-3 py-2.5 text-right">RUNS</th>
                    <th className="px-3 py-2.5 text-right">BALLS</th>
                    <th className="px-3 py-2.5 text-right">6S</th>
                    <th className="px-3 py-2.5 text-right">RESULT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {entries.map((entry, idx) => {
                    const kit = TEAM_KITS[entry.kitId] ?? TEAM_KITS['green-gold'];
                    return (
                      <tr
                        key={entry.id}
                        className={
                          idx === 0
                            ? 'bg-amber-400/8 text-white'
                            : 'text-slate-200 hover:bg-white/4'
                        }
                      >
                        <td className="font-mono-tabular px-3 py-2.5 font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-white/25"
                              style={{ backgroundColor: kit.jerseyMain }}
                              aria-hidden="true"
                            />
                            <span className="font-bold tracking-wide text-white">
                              {entry.playerName}
                            </span>
                            <span className="font-mono-tabular text-xs text-slate-400">
                              #{entry.jerseyNumber}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono-tabular px-3 py-2.5 text-right text-base font-extrabold text-amber-300">
                          {entry.runs}
                          <span className="text-xs font-normal text-slate-400">
                            /{entry.wicketsLost}
                          </span>
                        </td>
                        <td className="font-mono-tabular px-3 py-2.5 text-right text-slate-300">
                          {entry.ballsFaced}
                        </td>
                        <td className="font-mono-tabular px-3 py-2.5 text-right font-bold text-emerald-300">
                          {entry.sixesHit}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">
                          <span
                            className={
                              entry.won ? 'text-emerald-400' : 'text-slate-400'
                            }
                          >
                            {entry.inningsRole === 'bowling'
                              ? entry.won
                                ? 'DEFENDED'
                                : 'BOWLED'
                              : entry.won
                                ? 'WON'
                                : 'SHORT'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3.5">
          {entries.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Board</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="font-display rounded-lg bg-amber-400 px-5 py-2 text-base font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
