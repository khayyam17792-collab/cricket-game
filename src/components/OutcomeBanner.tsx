import { FastForward, Mic, RotateCcw, Trophy } from 'lucide-react';
import type { CommentaryStyle, HudSnapshot } from '../types/game';

interface OutcomeBannerProps {
  hud: HudSnapshot;
  commentaryStyle: CommentaryStyle;
  onChangeCommentaryStyle: (style: CommentaryStyle) => void;
  onSkipWalkIn: () => void;
  onStartOrRestart: () => void;
  onNewToss: () => void;
  onOpenLeaderboard: () => void;
}

const STYLE_OPTIONS: Array<{ id: CommentaryStyle; label: string }> = [
  { id: 'english-tv', label: 'TV Broadcast English' },
  { id: 'roman-urdu-desi', label: 'Funny Roman Urdu / Desi Street Cricket' },
];

export function OutcomeBanner({
  hud,
  commentaryStyle,
  onChangeCommentaryStyle,
  onSkipWalkIn,
  onStartOrRestart,
  onNewToss,
  onOpenLeaderboard,
}: OutcomeBannerProps) {
  // 1. Two-Stage Pre-Match Walk-In Lower-Third Overlay
  if (hud.phase === 'walkin') {
    const playerTitle = `${(hud.playerProfile.playerName || 'STRIKER').toUpperCase()} #${
      hud.playerProfile.jerseyNumber || '56'
    }`;
    const stageOne = hud.walkinProgress < 0.48;

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border border-white/15 bg-[#0a111f]/90 px-5 py-3.5 shadow-2xl">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-amber-400">
              {stageOne
                ? 'STAGE 1 · FIELDING UNIT ENTERING THE GROUND'
                : 'STAGE 2 · OPENING PARTNERSHIP WALKING OUT'}
            </div>
            <div className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
              {stageOne
                ? 'BOWLER, KEEPER & FIELDERS TAKING POSITIONS'
                : `${playerTitle} & PARTNER #18 TO THE CREASE`}
            </div>
          </div>

          <button
            type="button"
            onClick={onSkipWalkIn}
            className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 font-display text-lg font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
          >
            <span>SKIP WALK-IN</span>
            <FastForward className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Legacy Intro Fallback (if entered directly)
  if (hud.phase === 'intro') {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-8 z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#0a111f]/94 p-6 text-center shadow-2xl">
          <div className="text-xs font-semibold tracking-wider text-amber-400">
            NIGHT STADIUM CHALLENGE
          </div>
          <h1 className="font-display mt-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            2-INNINGS SUPER OVER
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {hud.target !== null
              ? `Chase ${hud.target} runs in ${hud.totalBalls} balls.`
              : `Set a strong 1st innings target across ${hud.totalBalls} balls.`}
          </p>

          <div className="mt-5 text-left">
            <div className="mb-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-300">
              <Mic className="h-3.5 w-3.5 text-amber-400" />
              <span>Commentary Style</span>
            </div>
            <div
              className="grid grid-cols-1 gap-1.5 rounded-xl bg-slate-900/90 p-1 sm:grid-cols-2"
              role="group"
              aria-label="Commentary style"
            >
              {STYLE_OPTIONS.map((opt) => {
                const active = commentaryStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeCommentaryStyle(opt.id)}
                    className={`min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      active
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartOrRestart}
            className="font-display mt-5 w-full rounded-xl bg-amber-400 px-6 py-3 text-xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
          >
            START INNINGS
          </button>
        </div>
      </div>
    );
  }

  // 3. Final 2-Innings Match Winner Trophy Modal
  if (hud.phase === 'gameover') {
    const won = hud.matchResult === 'won';
    const tied = hud.matchResult === 'tied';
    const isBattingSecond = hud.inningsRole === 'batting';
    const targetVal = hud.target ?? 1;
    const firstInnScore = Math.max(0, targetVal - 1);
    const runsShort = Math.max(0, targetVal - hud.runs);
    const runsMargin = Math.max(0, firstInnScore - hud.runs);
    const wicketsInHand = Math.max(1, hud.maxWickets - hud.wickets);

    const strikeRate =
      hud.ballsBowled > 0
        ? Math.round((hud.runs / hud.ballsBowled) * 100)
        : 0;

    let summaryText = '';
    if (tied) {
      summaryText = `Scores level on ${hud.runs} after both innings — a thrilling Super Over tie!`;
    } else if (isBattingSecond) {
      summaryText = won
        ? `Chased ${targetVal} with ${wicketsInHand} wicket${
            wicketsInHand === 1 ? '' : 's'
          } and ${hud.ballsLeft} ball${hud.ballsLeft === 1 ? '' : 's'} remaining!`
        : hud.wickets >= hud.maxWickets
          ? `All out for ${hud.runs} — fell ${runsShort} run${
              runsShort === 1 ? '' : 's'
            } short of ${targetVal}.`
          : `Finished on ${hud.runs}/${hud.wickets} — ${runsShort} run${
              runsShort === 1 ? '' : 's'
            } short of ${targetVal}.`;
    } else {
      summaryText = won
        ? `Defended ${firstInnScore} cleanly — won by ${runsMargin} run${
            runsMargin === 1 ? '' : 's'
          }!`
        : `Opponent chased down ${targetVal} with ${hud.ballsLeft} ball${
            hud.ballsLeft === 1 ? '' : 's'
          } to spare.`;
    }

    const firstInn = hud.firstInningsSummary;
    const playerName = (hud.playerProfile.playerName || 'STRIKER').toUpperCase();

    return (
      <div
        className={`fixed inset-0 z-20 flex justify-center p-4 pointer-events-none ${
          won ? 'items-end pb-20 bg-black/25' : 'items-center bg-black/55'
        }`}
      >
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/15 bg-[#0a111f]/94 p-6 text-center shadow-2xl">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
              won
                ? 'bg-emerald-400/15 text-emerald-400'
                : tied
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            <Trophy className="h-6 w-6" />
          </div>

          <h2
            className={`font-display mt-3 text-4xl font-extrabold tracking-tight ${
              won
                ? 'text-emerald-400'
                : tied
                  ? 'text-amber-300'
                  : 'text-rose-400'
            }`}
          >
            {won ? 'MATCH WON!' : tied ? 'MATCH TIED!' : 'OPPONENT WON'}
          </h2>

          <p className="mt-1.5 text-sm text-slate-300">{summaryText}</p>

          {/* Two-Innings Comparison Summary */}
          {firstInn && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
                <div className="text-[10px] font-semibold tracking-wider text-slate-400">
                  1ST INN ·{' '}
                  {firstInn.battingTeam === 'user'
                    ? `YOU (${playerName})`
                    : 'OPPONENT'}
                </div>
                <div className="font-display mt-0.5 text-2xl font-extrabold text-white tabular-nums">
                  {firstInn.runs}/{firstInn.wickets}
                  <span className="ml-1.5 font-mono-tabular text-xs font-normal text-slate-400">
                    ({firstInn.ballsBowled}/{hud.totalBalls})
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3">
                <div className="text-[10px] font-semibold tracking-wider text-slate-400">
                  2ND INN ·{' '}
                  {isBattingSecond ? `YOU (${playerName})` : 'OPPONENT'}
                </div>
                <div className="font-display mt-0.5 text-2xl font-extrabold text-amber-300 tabular-nums">
                  {hud.runs}/{hud.wickets}
                  <span className="ml-1.5 font-mono-tabular text-xs font-normal text-slate-400">
                    ({hud.ballsBowled}/{hud.totalBalls})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2nd Innings Key Metrics */}
          <div className="mt-2.5 grid grid-cols-4 gap-2 rounded-xl border border-white/10 bg-slate-900/90 p-2.5">
            <div>
              <div className="text-[10px] text-slate-400">Target</div>
              <div className="font-mono-tabular text-base font-bold text-amber-300">
                {targetVal}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Balls</div>
              <div className="font-mono-tabular text-base font-bold text-white">
                {hud.ballsBowled}/{hud.totalBalls}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Sixes</div>
              <div className="font-mono-tabular text-base font-bold text-emerald-400">
                {hud.sixesHit}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">SR</div>
              <div className="font-mono-tabular text-base font-bold text-slate-200">
                {strikeRate}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {hud.history.map((item) => (
              <div
                key={item.ballNumber}
                className={`font-mono-tabular flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${
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

          <div className="mt-4 grid grid-cols-1 gap-1.5 rounded-lg bg-slate-900/90 p-1 sm:grid-cols-2">
            {STYLE_OPTIONS.map((opt) => {
              const active = commentaryStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeCommentaryStyle(opt.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                    active
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onNewToss}
              className="font-display rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-lg font-extrabold tracking-wide text-slate-100 transition-colors hover:bg-slate-700 cursor-pointer"
            >
              NEW TOSS
            </button>
            <button
              type="button"
              onClick={onStartOrRestart}
              className="font-display flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-3 text-lg font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>REMATCH</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900/90 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-200 transition-colors hover:border-amber-400/50 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>TOP SCORERS LEADERBOARD</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Live Shot Outcome Broadcast Callout during ballInPlay
  if (hud.phase === 'ballInPlay' && hud.lastOutcome) {
    const o = hud.lastOutcome;
    const isCaught = o.headline.includes('CAUGHT');
    const isBouncedSafe = o.headline.includes('BOUNCED SAFE');
    const accent =
      o.code === '6'
        ? 'border-amber-400/70 text-amber-300'
        : o.code === '4' || isBouncedSafe
          ? 'border-emerald-400/70 text-emerald-300'
          : o.code === 'W'
            ? isCaught
              ? 'border-rose-400 bg-rose-950/90 text-rose-300'
              : 'border-rose-500/80 text-rose-400'
            : 'border-white/15 text-white';

    return (
      <div
        key={o.ballNumber}
        className="pointer-events-none fixed inset-x-0 top-24 z-20 flex justify-center px-4"
      >
        <div
          className={`animate-callout rounded-xl border bg-[#0a111f]/92 px-6 py-3 text-center shadow-2xl ${accent}`}
        >
          <div className="font-display text-3xl font-extrabold tracking-wide sm:text-4xl">
            {o.headline}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">
            {o.detail}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
