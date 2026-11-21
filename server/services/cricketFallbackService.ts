export const ALLOWED_DELIVERIES = [
  'In-swinging Yorker',
  'Fast Bouncer',
  'Wide Off-Cutter',
  'Straight Seam-Up',
] as const;

export type AllowedDeliveryName = (typeof ALLOWED_DELIVERIES)[number];

export interface StrategyRequestBody {
  runs: number;
  wickets: number;
  maxWickets: number;
  target: number | null;
  inningsNumber?: 1 | 2;
  ballsRemaining: number;
  lastShots: Array<{
    direction: string;
    timing: string;
    outcome: string;
  }>;
}

export interface BatterStrategyRequestBody {
  deliveryType: string;
  speed: number;
  bounceX: number;
  bounceZ: number;
  runs: number;
  wickets: number;
  target: number | null;
  inningsNumber?: 1 | 2;
  ballsRemaining: number;
}

export interface CommentaryRequestBody {
  outcomeCode: string;
  outcomeLabel: string;
  runsScored: number;
  deliveryName: string;
  speed: number;
  bounceX: number;
  bounceZ: number;
  direction: string;
  timing: string;
  runs: number;
  wickets: number;
  target: number | null;
  inningsNumber?: 1 | 2;
  ballsRemaining: number;
  commentaryStyle?: 'english-tv' | 'roman-urdu-desi';
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function normalizeDeliveryName(raw: unknown): AllowedDeliveryName {
  if (typeof raw === 'string') {
    const exact = ALLOWED_DELIVERIES.find(
      (d) => d.toLowerCase() === raw.trim().toLowerCase(),
    );
    if (exact) return exact;
    const lower = raw.toLowerCase();
    if (lower.includes('yorker')) return 'In-swinging Yorker';
    if (lower.includes('bouncer')) return 'Fast Bouncer';
    if (lower.includes('cutter') || lower.includes('wide')) {
      return 'Wide Off-Cutter';
    }
  }
  return 'Straight Seam-Up';
}

export function buildFallbackStrategy(body: StrategyRequestBody): {
  deliveryName: AllowedDeliveryName;
  speed: number;
  bounceX: number;
  bounceZ: number;
} {
  const last = body.lastShots?.[body.lastShots.length - 1];
  if (last?.outcome === '6' || last?.outcome === '4') {
    return {
      deliveryName: 'In-swinging Yorker',
      speed: 144,
      bounceX: -0.04,
      bounceZ: 7.45,
    };
  }
  if (last?.direction === 'leg') {
    return {
      deliveryName: 'Wide Off-Cutter',
      speed: 127,
      bounceX: 0.32,
      bounceZ: 4.15,
    };
  }
  if (last?.timing === 'EARLY') {
    return {
      deliveryName: 'Fast Bouncer',
      speed: 146,
      bounceX: -0.06,
      bounceZ: -0.35,
    };
  }
  const idx = Math.max(0, 6 - (body.ballsRemaining ?? 6));
  const rotation = [
    { deliveryName: 'Straight Seam-Up' as const, speed: 142, bounceX: 0.02, bounceZ: 3.85 },
    { deliveryName: 'In-swinging Yorker' as const, speed: 144, bounceX: -0.05, bounceZ: 7.4 },
    { deliveryName: 'Fast Bouncer' as const, speed: 146, bounceX: -0.08, bounceZ: -0.3 },
    { deliveryName: 'Wide Off-Cutter' as const, speed: 126, bounceX: 0.31, bounceZ: 4.2 },
  ];
  return rotation[idx % rotation.length];
}

export function buildFallbackBatterStrategy(b: BatterStrategyRequestBody): {
  shotDirection: 'leg' | 'straight' | 'off';
  aggression: 'defend' | 'rotate' | 'attack';
  timingOffsetSec: number;
} {
  const shotDirection: 'leg' | 'straight' | 'off' =
    b.bounceX > 0.14 ? 'off' : b.bounceX < -0.1 ? 'leg' : 'straight';
  const isYorkerOrBouncer = b.bounceZ >= 6.8 || b.bounceZ <= 0.4;
  const needBigHit =
    b.target !== null
      ? b.runs + 6 < b.target && b.ballsRemaining <= 3
      : b.ballsRemaining <= 2;
  const aggression: 'defend' | 'rotate' | 'attack' = isYorkerOrBouncer
    ? 'defend'
    : needBigHit
      ? 'attack'
      : 'rotate';
  const timingOffsetSec = isYorkerOrBouncer ? 0.08 : b.speed < 120 ? -0.09 : 0.01;
  return { shotDirection, aggression, timingOffsetSec };
}

export function buildFallbackCommentary(b: CommentaryRequestBody): string {
  const isDesi = b.commentaryStyle === 'roman-urdu-desi';
  const dir = b.direction || 'straight';
  const isCaught = (b.outcomeLabel ?? '').toUpperCase().includes('CAUGHT');
  const variant = Math.abs((b.ballsRemaining ?? 0) + (b.runs ?? 0)) % 2;

  if (b.outcomeCode === 'W') {
    if (isCaught) {
      return isDesi
        ? `Arrey boss, hawa mein shot aur fielder ne shandaar catch lapak liya! Poora stadium gasp ke baad jhoom utha, Super Over palat gaya hai!`
        : `Gone! Spliced high off that ${b.deliveryName} and the charging fielder holds a stunning catch! A massive roar shakes the floodlit stadium with ${b.ballsRemaining} ball(s) left.`;
    }
    return isDesi
      ? `Arrey yaar, ${b.deliveryName} ne seedha danda ukharr diya aur bails hawa mein urr gayi! Poora stadium ekdum sannate mein, bowler ka bhangra shuru ho gaya hai!`
      : `Timber! That ${b.speed} kph ${b.deliveryName} crashes straight through the gate and sends the bails flying! The fielding unit erupts as the Super Over drama intensifies.`;
  }
  if (b.outcomeCode === '6') {
    if (variant === 1) {
      return isDesi
        ? `Uff teri, ${b.speed} kph ki ball ko ${dir} stand ke upar se park ke bahar phenk diya! Crowd mein tsunami aa gaya, score ${b.runs}/${b.wickets} par pahunch gaya!`
        : `Dispatched into the night sky! Clean ${b.timing.toLowerCase()} timing launches that ${b.deliveryName} way over ${dir} for a monstrous six! The crowd is on its feet at ${b.runs}/${b.wickets}.`;
    }
    return isDesi
      ? `Kya baat hai boss, ${dir} side pe seedha chakka chhat ke paar! Crowd ka shor aasman chhoo raha hai, ab ${b.runs}/${b.wickets} ho gaya hai score!`
      : `Launched effortlessly! Pure ${b.timing.toLowerCase()} timing sends that ${b.deliveryName} soaring high over the ${dir} boundary rope for a towering maximum! The floodlit crowd goes wild with ${b.ballsRemaining} ball(s) left.`;
  }
  if (b.outcomeCode === '4') {
    if (variant === 1) {
      return isDesi
        ? `Chaaron khaane chitt! ${dir} gap mein aisa punch maara ke fielder sirf shadow chase karta reh gaya! Score ${b.runs}/${b.wickets} par tezi se aage!`
        : `Bullet through the ${dir} ring! Nothing the diving outfielder could do as that ${b.deliveryName} rifles into the cushions for four. Score moves to ${b.runs}/${b.wickets}.`;
    }
    return isDesi
      ? `Zabardast shot, goli ki tarah ball ${dir} boundary ke paar chali gayi chaar runs ke liye! Fielders bas dekhte hi reh gaye aur stadium jhoom utha!`
      : `Cracking strike! That races across the emerald outfield past the diving fielder to the ${dir} cushion for four. Pressure swings back onto the bowler at ${b.runs}/${b.wickets}.`;
  }
  if (b.outcomeCode === '2' || b.outcomeCode === '1') {
    return isDesi
      ? `Chalaaki se ${dir} gap mein khel kar ${b.runsScored} run chura liya hai, fielder ki tezi bhi kaam na aayi! Har ek run ab sone ke bhaav hai Super Over mein!`
      : `Smart placement into the ${dir} gap earns ${b.runsScored} vital run(s) before the chasing fielder relays it cleanly to the keeper. Score moves to ${b.runs}/${b.wickets} with ${b.ballsRemaining} left.`;
  }
  return isDesi
    ? `Uff, ${b.speed} kph ki ${b.deliveryName} par bilkul dot ball nikal gayi aur keeper ne clean catch pakda! Bowler full form mein hai, agle ball pe bada shot chahiye!`
    : `Tight bowling! That ${b.speed} kph ${b.deliveryName} beats the willow cleanly to keep it a priceless dot ball. Tension builds under the floodlights with the chase at ${b.runs}/${b.wickets}.`;
}
