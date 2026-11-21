import { Coins, LogIn, LogOut, Shield, Shirt, Swords, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  InningsRole,
  MatchOvers,
  PlayerCustomization,
  TossCall,
} from '../../types/game';

interface TossModalProps {
  oversCount: MatchOvers;
  playerProfile: PlayerCustomization;
  leaderboardCount: number;
  userDisplayName: string | null;
  authBusy: boolean;
  onChangeOvers: (overs: MatchOvers) => void;
  onCompleteToss: (inningsRole: InningsRole) => void;
  onOpenCustomizer: () => void;
  onOpenLeaderboard: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

type TossStep = 'pick' | 'spinning' | 'won' | 'lost';

export function TossModal({
  oversCount,
  playerProfile,
  leaderboardCount,
  userDisplayName,
  authBusy,
  onChangeOvers,
  onCompleteToss,
  onOpenCustomizer,
  onOpenLeaderboard,
  onSignIn,
  onSignOut,
}: TossModalProps) {
  const [step, setStep] = useState<TossStep>('pick');
  const [playerCall, setPlayerCall] = useState<TossCall | null>(null);
  const [coinResult, setCoinResult] = useState<TossCall>('heads');
  const [aiElectedRole, setAiElectedRole] = useState<InningsRole>('batting');
  const [spinAngle, setSpinAngle] = useState(0);

  useEffect(() => {
    if (step !== 'spinning' || !playerCall) return;

    const timer = window.setTimeout(() => {
      const playerWon = coinResult === playerCall;
      if (playerWon) {
        setStep('won');
      } else {
        const opponentBatsFirst = Math.random() < 0.5;
        setAiElectedRole(opponentBatsFirst ? 'bowling' : 'batting');
        setStep('lost');
      }
    }, 1250);

    return () => window.clearTimeout(timer);
  }, [step, playerCall, coinResult]);

  const handleCall = (call: TossCall) => {
    const landed: TossCall = Math.random() < 0.5 ? 'heads' : 'tails';
    setPlayerCall(call);
    setCoinResult(landed);
    setSpinAngle((prev) => {
      const base = prev - (prev % 360) + 1440;
      return landed === 'heads' ? base : base + 180;
    });
    setStep('spinning');
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/45 px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#0a111f]/95 p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold tracking-wider text-amber-400">
          OFFICIAL 2-INNINGS MATCH TOSS
        </div>
        <h2 className="font-display mt-1 text-4xl font-extrabold tracking-tight text-white">
          HEADS OR TAILS
        </h2>

        {/* Animated 3D Spinning Cricket Coin */}
        <div className="my-5 flex justify-center" style={{ perspective: '700px' }}>
          <div
            className="relative h-24 w-24 transition-transform duration-[1200ms] ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${spinAngle}deg)`,
            }}
          >
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-slate-950 shadow-xl"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <Coins className="h-6 w-6 stroke-[2.4]" />
              <span className="font-display mt-0.5 text-lg font-extrabold tracking-wider">
                HEADS
              </span>
            </div>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-emerald-300 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 text-slate-950 shadow-xl"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <Shield className="h-6 w-6 stroke-[2.4]" />
              <span className="font-display mt-0.5 text-lg font-extrabold tracking-wider">
                TAILS
              </span>
            </div>
          </div>
        </div>

        {step === 'pick' && (
          <>
            {/* Match Overs Format Selector */}
            <div className="mb-4 text-left">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400">
                MATCH FORMAT (2 INNINGS)
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/90 p-1">
                <button
                  type="button"
                  onClick={() => onChangeOvers(1)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    oversCount === 1
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  1 Over (6 Balls)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeOvers(2)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    oversCount === 2
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  2 Overs (12 Balls)
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Call the coin first — then both squads walk onto the pitch.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleCall('heads')}
                className="font-display min-h-[48px] rounded-xl bg-amber-400 px-5 py-3 text-2xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
              >
                HEADS
              </button>
              <button
                type="button"
                onClick={() => handleCall('tails')}
                className="font-display min-h-[48px] rounded-xl bg-emerald-500 px-5 py-3 text-2xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-emerald-400 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
              >
                TAILS
              </button>
            </div>

            {/* Quick Kit, Leaderboard & Account Sync */}
            <div className="mt-4 space-y-2 border-t border-white/10 pt-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenCustomizer}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-slate-900/90 px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:border-amber-400/50 hover:bg-slate-800 cursor-pointer truncate"
                >
                  <Shirt className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {playerProfile.playerName || 'STRIKER'} #{playerProfile.jerseyNumber || '56'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-slate-900/90 px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:border-amber-400/50 hover:bg-slate-800 cursor-pointer truncate"
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    Leaderboard{leaderboardCount > 0 ? ` (${leaderboardCount})` : ''}
                  </span>
                </button>
              </div>

              {userDisplayName ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px]">
                  <span className="font-semibold text-emerald-300 truncate">
                    Signed in as {userDisplayName}
                  </span>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={onSignOut}
                    className="ml-2 flex shrink-0 items-center gap-1 font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={onSignIn}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-slate-900/90 px-3 py-2 text-[11px] font-semibold text-slate-200 transition-colors hover:border-emerald-400/40 hover:bg-slate-800 cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    {authBusy
                      ? 'Connecting account...'
                      : 'Sign in with Google to save scores'}
                  </span>
                </button>
              )}
            </div>
          </>
        )}

        {step === 'spinning' && (
          <p className="text-sm font-medium text-amber-300">
            Coin spinning under the floodlights — called{' '}
            <span className="font-bold uppercase">{playerCall}</span>...
          </p>
        )}

        {step === 'won' && (
          <div className="space-y-4">
            <div>
              <div className="font-display text-2xl font-extrabold tracking-wide text-emerald-400">
                IT&apos;S {coinResult.toUpperCase()} — YOU WON THE TOSS!
              </div>
              <p className="mt-1 text-sm text-slate-300">
                Choose to bat first and set a target, or bowl first and chase in the 2nd innings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onCompleteToss('batting')}
                className="flex flex-col items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500 px-4 py-3 text-slate-950 transition-colors hover:bg-emerald-400 cursor-pointer"
              >
                <Swords className="h-5 w-5" />
                <span className="font-display mt-1 text-xl font-extrabold">
                  BAT FIRST
                </span>
                <span className="text-[11px] font-semibold text-slate-900">
                  Set 1st Innings Target
                </span>
              </button>

              <button
                type="button"
                onClick={() => onCompleteToss('bowling')}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-400/50 bg-amber-400 px-4 py-3 text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
              >
                <Shield className="h-5 w-5" />
                <span className="font-display mt-1 text-xl font-extrabold">
                  BOWL FIRST
                </span>
                <span className="text-[11px] font-semibold text-slate-900">
                  Bowl 1st &amp; Chase 2nd
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 'lost' && (
          <div className="space-y-4">
            <div>
              <div className="font-display text-2xl font-extrabold tracking-wide text-rose-400">
                IT&apos;S {coinResult.toUpperCase()} — OPPONENT WON THE TOSS
              </div>
              <p className="mt-1.5 text-sm text-slate-200">
                {aiElectedRole === 'batting'
                  ? 'Opponent elected to BOWL first. Your two openers will walk in to set a strong target!'
                  : 'Opponent elected to BAT first. Your fielding unit enters first — restrict their score before your chase!'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onCompleteToss(aiElectedRole)}
              className="font-display w-full rounded-xl bg-amber-400 px-6 py-3 text-xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
            >
              ENTER THE FIELD
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
