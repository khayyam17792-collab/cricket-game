import { Mic, Play, Shirt, Trophy, User } from 'lucide-react';
import {
  CommentaryStyle,
  PlayerCustomization,
  TEAM_KITS,
  TeamKitId,
} from '../types/game';

interface CustomizerModalProps {
  profile: PlayerCustomization;
  commentaryStyle: CommentaryStyle;
  leaderboardCount: number;
  onChangeProfile: (profile: PlayerCustomization) => void;
  onChangeCommentaryStyle: (style: CommentaryStyle) => void;
  onEnterStadium: () => void;
  onOpenLeaderboard: () => void;
}

const KIT_ORDER: TeamKitId[] = [
  'green-gold',
  'blue-orange',
  'yellow-green',
  'black-silver',
];

const STYLE_OPTIONS: Array<{ id: CommentaryStyle; label: string }> = [
  { id: 'english-tv', label: 'TV Broadcast English' },
  { id: 'roman-urdu-desi', label: 'Funny Roman Urdu / Desi' },
];

export function CustomizerModal({
  profile,
  commentaryStyle,
  leaderboardCount,
  onChangeProfile,
  onChangeCommentaryStyle,
  onEnterStadium,
  onOpenLeaderboard,
}: CustomizerModalProps) {
  const handleNameChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9 .'-]/g, '').slice(0, 12);
    onChangeProfile({ ...profile, playerName: cleaned });
  };

  const handleNumberChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(0, 3);
    onChangeProfile({ ...profile, jerseyNumber: cleaned });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalProfile: PlayerCustomization = {
      playerName: profile.playerName.trim() || 'STRIKER',
      jerseyNumber: profile.jerseyNumber.trim() || '56',
      kitId: profile.kitId,
    };
    onChangeProfile(finalProfile);
    onEnterStadium();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4 sm:justify-start sm:pl-8 lg:pl-14">
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-[#080f1d]/92 p-5 shadow-2xl backdrop-blur-md sm:p-6"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-amber-400">
              NIGHT STADIUM SUPER OVER · PRE-WALK-IN
            </div>
            <h1 className="font-display mt-0.5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              PLAYER &amp; KIT SETUP
            </h1>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-400">
            <Shirt className="h-5 w-5" />
          </div>
        </div>

        {/* Name & Jersey Number */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <label className="col-span-2 block">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-300">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              <span>PLAYER NAME</span>
            </span>
            <input
              type="text"
              value={profile.playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="STRIKER"
              maxLength={12}
              className="w-full rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2.5 text-sm font-bold tracking-wider text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-300">
              JERSEY #
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={profile.jerseyNumber}
              onChange={(e) => handleNumberChange(e.target.value)}
              placeholder="56"
              maxLength={3}
              className="font-mono-tabular w-full rounded-lg border border-white/15 bg-slate-900/95 px-3 py-2.5 text-center text-sm font-bold text-amber-300 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Team Kit Swatches */}
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-slate-300">
            TEAM KIT COLORS
          </div>
          <div className="grid grid-cols-2 gap-2">
            {KIT_ORDER.map((id) => {
              const kit = TEAM_KITS[id];
              const active = profile.kitId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeProfile({ ...profile, kitId: id })}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-amber-400 bg-amber-400/15 text-white'
                      : 'border-white/12 bg-slate-900/80 text-slate-300 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 overflow-hidden rounded border border-white/25">
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: kit.jerseyMain }}
                    />
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: kit.jerseyAccent }}
                    />
                  </span>
                  <span className="text-xs font-semibold truncate">{kit.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Commentary Style */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-300">
            <Mic className="h-3.5 w-3.5 text-amber-400" />
            <span>COMMENTARY BOX STYLE</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-900/90 p-1">
            {STYLE_OPTIONS.map((opt) => {
              const active = commentaryStyle === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeCommentaryStyle(opt.id)}
                  className={`min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors truncate cursor-pointer ${
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

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="submit"
            className="font-display flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xl font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>SAVE KIT &amp; BACK TO TOSS</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900/85 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-200 transition-colors hover:border-amber-400/50 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>
              TOP SCORERS LEADERBOARD
              {leaderboardCount > 0 ? ` (${leaderboardCount})` : ''}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
