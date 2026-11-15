import { Compass, Flame, Mic, Wind, Zap } from 'lucide-react';
import { useState } from 'react';
import type {
  BowlerArchetype,
  BowlingEnd,
  BowlingSide,
  CommentaryStyle,
  InningsRole,
  MatchOvers,
} from '../types/game';

interface PreOverSetupModalProps {
  inningsNumber: 1 | 2;
  inningsRole: InningsRole;
  target: number | null;
  oversCount: MatchOvers;
  totalBalls: number;
  initialEnd: BowlingEnd;
  initialSide: BowlingSide;
  initialArchetype: BowlerArchetype;
  commentaryStyle: CommentaryStyle;
  onChangeCommentaryStyle: (style: CommentaryStyle) => void;
  onConfirmSetup: (
    end: BowlingEnd,
    side: BowlingSide,
    archetype: BowlerArchetype,
  ) => void;
}

const ARCHETYPES: Array<{
  id: BowlerArchetype;
  label: string;
  sub: string;
  Icon: typeof Zap;
}> = [
  { id: 'fast', label: 'Fast Pace', sub: '142–152 kph', Icon: Flame },
  { id: 'swing', label: 'Swing', sub: 'Late air curl', Icon: Wind },
  { id: 'spin', label: 'Spin', sub: 'Big clay turn', Icon: Zap },
];

const STYLE_OPTIONS: Array<{ id: CommentaryStyle; label: string }> = [
  { id: 'english-tv', label: 'TV Broadcast English' },
  { id: 'roman-urdu-desi', label: 'Funny Roman Urdu / Desi Street Cricket' },
];

export function PreOverSetupModal({
  inningsNumber,
  inningsRole,
  target,
  oversCount,
  totalBalls,
  initialEnd,
  initialSide,
  initialArchetype,
  commentaryStyle,
  onChangeCommentaryStyle,
  onConfirmSetup,
}: PreOverSetupModalProps) {
  const [end, setEnd] = useState<BowlingEnd>(initialEnd);
  const [side, setSide] = useState<BowlingSide>(initialSide);
  const [archetype, setArchetype] = useState<BowlerArchetype>(initialArchetype);

  const isBatting = inningsRole === 'batting';
  const eyebrow =
    inningsNumber === 1
      ? `1ST INNINGS (${oversCount} OVER${oversCount > 1 ? 'S' : ''}) · ${
          isBatting ? 'SET A BIG TARGET' : 'BOWL FIRST'
        }`
      : `2ND INNINGS · ${
          isBatting ? `CHASE ${target ?? 0}` : `DEFEND ${target ?? 0}`
        }`;

  const subtitle =
    inningsNumber === 1
      ? isBatting
        ? `Choose the bowling end and attack you want to face across ${totalBalls} balls to set the target.`
        : `Pick your bowling end, angle of attack, and bowler style to restrict the opponent over ${totalBalls} balls.`
      : isBatting
        ? `Choose your end and face ${totalBalls} balls to chase down ${target ?? 0} runs.`
        : `Pick your bowling end, angle of attack, and bowler style to defend ${Math.max(0, (target ?? 1) - 1)} runs.`;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#0a111f]/95 p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wider text-amber-400">
            {eyebrow}
          </div>
          <h2 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            SELECT BOWLING END &amp; ATTACK
          </h2>
          <p className="mt-1 text-xs text-slate-300">{subtitle}</p>
        </div>

        {/* 1. Bowling End */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            <span>Stadium Bowling End</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEnd('pavilion')}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                end === 'pavilion'
                  ? 'border-emerald-400 bg-emerald-500/20 text-white'
                  : 'border-white/10 bg-slate-900/90 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="font-display text-lg font-bold leading-tight">
                Pavilion End
              </div>
              <div className="text-[11px] text-slate-400">
                Toward Cathedral Clocktower
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEnd('cathedral')}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                end === 'cathedral'
                  ? 'border-emerald-400 bg-emerald-500/20 text-white'
                  : 'border-white/10 bg-slate-900/90 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="font-display text-lg font-bold leading-tight">
                Cathedral End
              </div>
              <div className="text-[11px] text-slate-400">
                Toward Pavilion Tunnel
              </div>
            </button>
          </div>
        </div>

        {/* 2. Bowling Side & Archetype */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-300">
              Bowling Side
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/90 p-1">
              <button
                type="button"
                onClick={() => setSide('over')}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  side === 'over'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Over Wicket
              </button>
              <button
                type="button"
                onClick={() => setSide('around')}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  side === 'around'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                Around Wicket
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-300">
              Bowler Archetype
            </div>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-900/90 p-1">
              {ARCHETYPES.map(({ id, label, sub, Icon }) => {
                const active = archetype === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setArchetype(id)}
                    className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="mt-0.5 text-[11px] font-bold leading-none">
                      {label}
                    </span>
                    <span
                      className={`mt-0.5 text-[9px] leading-none ${
                        active ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Commentary Style */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Mic className="h-3.5 w-3.5 text-amber-400" />
            <span>Live Commentary Style</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-slate-900/90 p-1 sm:grid-cols-2">
            {STYLE_OPTIONS.map((opt) => {
              const active = commentaryStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeCommentaryStyle(opt.id)}
                  className={`min-h-[38px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
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
        </div>

        <button
          type="button"
          onClick={() => onConfirmSetup(end, side, archetype)}
          className="font-display mt-5 w-full rounded-xl bg-amber-400 px-6 py-3 text-2xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
        >
          {isBatting ? 'TAKE GUARD & START INNINGS' : 'START BOWLING INNINGS'}
        </button>
      </div>
    </div>
  );
}
