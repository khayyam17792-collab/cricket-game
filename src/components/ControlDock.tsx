import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Crosshair,
} from 'lucide-react';
import { useState } from 'react';
import type {
  BowlingDeliveryType,
  HudSnapshot,
  ShotDirection,
} from '../types/game';
import { CommentaryTicker } from './CommentaryTicker';

interface ControlDockProps {
  hud: HudSnapshot;
  commentary: string;
  commentaryLoading: boolean;
  apiError: string | null;
  onSelectDirection: (dir: ShotDirection) => void;
  onSelectDeliveryType: (type: BowlingDeliveryType) => void;
  onSwing: () => void;
}

const DIRECTIONS: Array<{
  id: ShotDirection;
  label: string;
  keyHint: string;
  Icon: typeof ArrowLeft;
}> = [
  { id: 'leg', label: 'Leg Side', keyHint: '←', Icon: ArrowLeft },
  { id: 'straight', label: 'Straight', keyHint: '↑', Icon: ArrowUp },
  { id: 'off', label: 'Off Side', keyHint: '→', Icon: ArrowRight },
];

const BOWLING_DELIVERIES: BowlingDeliveryType[] = [
  'Fast Yorker',
  'Outswinger',
  'Bouncer',
  'Slower Cutter',
];

export function ControlDock({
  hud,
  commentary,
  commentaryLoading,
  apiError,
  onSelectDirection,
  onSelectDeliveryType,
  onSwing,
}: ControlDockProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (
    hud.phase === 'customize' ||
    hud.phase === 'walkin' ||
    hud.phase === 'toss' ||
    hud.phase === 'endSelect' ||
    hud.phase === 'intro' ||
    hud.phase === 'drsPrompt' ||
    hud.phase === 'drsReview' ||
    hud.phase === 'inningsBreak'
  ) {
    return null;
  }

  const isBowling = hud.inningsRole === 'bowling';
  const showControls = hud.phase !== 'gameover';
  const timingPct = Math.min(100, Math.max(0, hud.timingProgress * 100));
  const inSweetSpot = hud.timingProgress >= 0.87 && hud.timingProgress <= 1.03;

  const releasePct = Math.min(100, Math.max(0, hud.releaseMeter * 100));
  const inReleaseSweetSpot = hud.releaseMeter >= 0.4 && hud.releaseMeter <= 0.6;

  const swingButtonLabel = isBowling
    ? hud.phase === 'ready'
      ? 'RELEASE BALL (Space)'
      : hud.phase === 'runup'
        ? 'Running In...'
        : 'Ball in Flight'
    : hud.phase === 'ready'
      ? hud.isPlanningStrategy
        ? 'Bowler Reading...'
        : 'Bowl Now (Space)'
      : hud.phase === 'delivery'
        ? hud.canSwing
          ? 'SWING (Space)'
          : 'Swung!'
        : 'SWING (Space)';

  const lengthLabel =
    hud.bounceZ >= 6.0 ? 'Yorker' : hud.bounceZ <= 1.0 ? 'Short' : 'Good Length';
  const lineLabel =
    hud.bounceX < -0.08 ? 'Leg' : hud.bounceX > 0.12 ? 'Off' : 'Middle';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-3">
      {showControls && (
        <div className="flex w-full max-w-2xl flex-col items-center">
          {/* Collapse Toggle Tab */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="pointer-events-auto mb-1.5 flex items-center gap-1 rounded-t-lg border border-b-0 border-white/12 bg-[#0a111f]/90 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:text-white cursor-pointer"
          >
            {collapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          {!collapsed && (
            <div className="pointer-events-auto w-full rounded-xl border border-white/12 bg-[#0a111f]/92 p-3 shadow-2xl">
              {isBowling ? (
                <>
                  {/* Bowling Pitch Aim Hint + Release Timing Bar */}
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                      <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="font-semibold text-white">
                        {hud.bowlingDeliveryType}
                      </span>
                      <span aria-hidden="true" className="text-slate-500">
                        ·
                      </span>
                      <span className="font-mono-tabular text-amber-300">
                        {lengthLabel} / {lineLabel}
                      </span>
                    </div>

                    {/* Oscillating Release Timing Meter */}
                    <div className="relative h-3 flex-1 min-w-[140px] overflow-hidden rounded-full bg-slate-800 border border-white/10">
                      {/* Green Release Sweet Spot (40% - 60%) */}
                      <div
                        className="absolute inset-y-0 left-[40%] w-[20%] bg-emerald-500/40 border-x border-emerald-400/80"
                        aria-hidden="true"
                      />
                      {/* Animated Marker */}
                      <div
                        className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 rounded-full ${
                          inReleaseSweetSpot ? 'bg-emerald-300' : 'bg-amber-400'
                        }`}
                        style={{ left: `${releasePct}%` }}
                      />
                    </div>

                    <div className="text-[11px] font-medium text-amber-300 whitespace-nowrap">
                      {hud.phase === 'ready'
                        ? 'Aim pitch with Mouse or WASD/Arrows · Space to bowl!'
                        : 'Target locked — AI Batter reacting...'}
                    </div>
                  </div>

                  {/* 4 Bowling Delivery Type Buttons + Release CTA */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900/90 p-1 sm:grid-cols-4 sm:flex-1"
                      role="group"
                      aria-label="Bowling delivery type"
                    >
                      {BOWLING_DELIVERIES.map((type) => {
                        const active = hud.bowlingDeliveryType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={hud.phase !== 'ready'}
                            onClick={() => onSelectDeliveryType(type)}
                            className={`min-h-[42px] rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap truncate cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                              active
                                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            } ${hud.phase !== 'ready' ? 'opacity-65 cursor-not-allowed' : ''}`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={onSwing}
                      disabled={hud.phase !== 'ready'}
                      className={`min-h-[44px] rounded-lg px-5 py-2.5 font-display text-lg font-extrabold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${
                        hud.phase === 'ready'
                          ? inReleaseSweetSpot
                            ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                            : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {swingButtonLabel}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Batting Mode: AI Bowler Delivery Plan & Live Timing Bar */}
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
                      {hud.isPlanningStrategy ? (
                        <span className="font-semibold text-amber-300">
                          Bowler setting field &amp; strategy...
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-white">
                            {hud.deliveryLabel}
                          </span>
                          <span aria-hidden="true" className="text-slate-500">
                            ·
                          </span>
                          <span className="font-mono-tabular text-amber-300">
                            {hud.deliverySpeedKph} kph
                          </span>
                          <span
                            aria-hidden="true"
                            className="hidden text-slate-500 sm:inline"
                          >
                            ·
                          </span>
                          <span className="hidden text-slate-400 sm:inline">
                            {lengthLabel} / {lineLabel}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      {/* Optimal sweet-spot timing zone (87% - 100%) */}
                      <div
                        className="absolute inset-y-0 right-1 w-[13%] rounded-full border border-amber-400/70 bg-amber-400/35"
                        aria-hidden="true"
                      />
                      {/* Ball progress marker */}
                      {hud.phase === 'delivery' && (
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-none ${
                            inSweetSpot ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, timingPct)}%` }}
                        />
                      )}
                    </div>

                    <div className="hidden text-[11px] font-medium text-slate-400 sm:block whitespace-nowrap">
                      {hud.phase === 'delivery'
                        ? inSweetSpot
                          ? 'Hit Zone!'
                          : 'Watch the ball'
                        : hud.phase === 'runup'
                          ? 'Bowler running in'
                          : 'Choose shot'}
                    </div>
                  </div>

                  {/* Direction Controls + Primary Swing Action */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900/90 p-1 sm:flex-1"
                      role="group"
                      aria-label="Shot direction"
                    >
                      {DIRECTIONS.map(({ id, label, keyHint, Icon }) => {
                        const active = hud.selectedDirection === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onSelectDirection(id)}
                            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                              active
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{label}</span>
                            <span
                              className={`font-mono-tabular text-[11px] ${
                                active ? 'text-slate-900/80' : 'text-slate-500'
                              }`}
                            >
                              {keyHint}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={onSwing}
                      disabled={
                        hud.phase === 'ballInPlay' ||
                        (hud.phase === 'ready' && hud.isPlanningStrategy)
                      }
                      className={`min-h-[44px] rounded-lg px-6 py-2.5 font-display text-lg font-extrabold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${
                        hud.phase === 'delivery' && hud.canSwing
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : hud.phase === 'ready' && !hud.isPlanningStrategy
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {swingButtonLabel}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sleek Live Broadcast Commentary Ticker at Bottom of Screen */}
      <CommentaryTicker
        commentary={commentary}
        isLoading={commentaryLoading}
        error={apiError}
        ballNumber={hud.lastOutcome?.ballNumber ?? null}
      />
    </div>
  );
}
