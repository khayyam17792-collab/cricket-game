import type {
  AiBatterPlan,
  AiDeliveryPlan,
  BallOutcomeRecord,
  CommentaryStyle,
} from '../types/game';

export interface StrategyRequestPayload {
  runs: number;
  wickets: number;
  maxWickets: number;
  target: number | null;
  inningsNumber: 1 | 2;
  ballsRemaining: number;
  lastShots: Array<{
    direction: string;
    timing: string;
    outcome: string;
  }>;
}

export interface BatterStrategyRequestPayload {
  deliveryType: string;
  speed: number;
  bounceX: number;
  bounceZ: number;
  runs: number;
  wickets: number;
  target: number | null;
  inningsNumber: 1 | 2;
  ballsRemaining: number;
}

export interface CommentaryRequestPayload {
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
  inningsNumber: 1 | 2;
  ballsRemaining: number;
  commentaryStyle: CommentaryStyle;
}

async function postJsonWithRetry<T>(
  url: string,
  payload: unknown,
  retries = 1,
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as T & { error?: string };
      if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status})`);
        if (res.status >= 400 && res.status < 500) {
          throw err;
        }
        throw err;
      }
      return data;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error('Network request failed');
      const isQuota =
        lastErr.message.includes('429') ||
        lastErr.message.includes('RESOURCE_EXHAUSTED');
      if (isQuota || attempt >= retries) {
        break;
      }
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error('Request failed');
}

export async function fetchAiBowlerStrategy(
  payload: StrategyRequestPayload,
): Promise<AiDeliveryPlan> {
  return postJsonWithRetry<AiDeliveryPlan>('/api/bowler-strategy', payload, 1);
}

export async function fetchAiBatterStrategy(
  payload: BatterStrategyRequestPayload,
): Promise<AiBatterPlan> {
  return postJsonWithRetry<AiBatterPlan>('/api/batter-strategy', payload, 0);
}

export function buildLocalFallbackBatterStrategy(
  payload: BatterStrategyRequestPayload,
): AiBatterPlan {
  const shotDirection =
    payload.bounceX > 0.14 ? 'off' : payload.bounceX < -0.1 ? 'leg' : 'straight';
  const isTough = payload.bounceZ >= 6.8 || payload.bounceZ <= 0.4;
  return {
    shotDirection,
    aggression: isTough ? 'defend' : 'attack',
    timingOffsetSec: isTough ? 0.08 : 0.01,
  };
}

export async function fetchLiveCommentary(
  outcome: BallOutcomeRecord,
  matchState: {
    runs: number;
    wickets: number;
    target: number | null;
    inningsNumber: 1 | 2;
    ballsRemaining: number;
  },
  commentaryStyle: CommentaryStyle,
): Promise<string> {
  const payload: CommentaryRequestPayload = {
    outcomeCode: outcome.code,
    outcomeLabel: outcome.headline,
    runsScored: outcome.runs,
    deliveryName: outcome.deliveryLabel,
    speed: outcome.deliverySpeedKph,
    bounceX: outcome.bounceX,
    bounceZ: outcome.bounceZ,
    direction: outcome.direction,
    timing: outcome.timing,
    runs: matchState.runs,
    wickets: matchState.wickets,
    target: matchState.target,
    inningsNumber: matchState.inningsNumber,
    ballsRemaining: matchState.ballsRemaining,
    commentaryStyle,
  };
  const data = await postJsonWithRetry<{ commentary: string }>(
    '/api/commentary',
    payload,
    1,
  );
  const text = (data?.commentary ?? '').trim();
  if (
    !text ||
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('"code":429') ||
    text.startsWith('{')
  ) {
    return buildLocalFallbackCommentary(outcome, matchState, commentaryStyle);
  }
  return text;
}

export function buildLocalFallbackStrategy(
  ballsBowled: number,
  lastShots: BallOutcomeRecord[],
): AiDeliveryPlan {
  const last = lastShots[lastShots.length - 1];
  if (last?.code === '6' || last?.code === '4') {
    return {
      deliveryName: 'In-swinging Yorker',
      speed: 143,
      bounceX: -0.04,
      bounceZ: 7.4,
    };
  }
  if (last?.direction === 'leg') {
    return {
      deliveryName: 'Wide Off-Cutter',
      speed: 127,
      bounceX: 0.31,
      bounceZ: 4.1,
    };
  }
  const rotation: AiDeliveryPlan[] = [
    { deliveryName: 'Straight Seam-Up', speed: 142, bounceX: 0.02, bounceZ: 3.8 },
    { deliveryName: 'In-swinging Yorker', speed: 144, bounceX: -0.05, bounceZ: 7.45 },
    { deliveryName: 'Fast Bouncer', speed: 146, bounceX: -0.08, bounceZ: -0.35 },
    { deliveryName: 'Wide Off-Cutter', speed: 126, bounceX: 0.32, bounceZ: 4.2 },
  ];
  return rotation[ballsBowled % rotation.length];
}

export function buildLocalFallbackCommentary(
  outcome: BallOutcomeRecord,
  matchState: {
    runs: number;
    wickets: number;
    target: number | null;
    inningsNumber?: 1 | 2;
    ballsRemaining: number;
  },
  commentaryStyle: CommentaryStyle,
): string {
  const isDesi = commentaryStyle === 'roman-urdu-desi';
  const isCaught = outcome.headline.toUpperCase().includes('CAUGHT');
  const chaseContext =
    matchState.target !== null
      ? `Need ${Math.max(0, matchState.target - matchState.runs)} from ${matchState.ballsRemaining} ball(s).`
      : `Score ${matchState.runs}/${matchState.wickets} with ${matchState.ballsRemaining} ball(s) left in the 1st innings.`;

  if (outcome.code === 'W') {
    if (isCaught) {
      return isDesi
        ? `Arrey boss, hawa mein shot aur fielder ne shandaar catch lapak liya! Poora stadium gasp ke baad jhoom utha hai!`
        : `Gone! Spliced off ${outcome.deliveryLabel} and the charging fielder pulls off a brilliant catch under the floodlights!`;
    }
    return isDesi
      ? `Arrey yaar, ${outcome.deliveryLabel} ne seedha wicket udda diya aur stadium mein sannata chha gaya! Bowler aur fielders ka jashan shuru ho gaya hai!`
      : `Big breakthrough! That ${outcome.deliverySpeedKph} kph ${outcome.deliveryLabel} claims the wicket and turns the match on its head!`;
  }
  if (outcome.code === '6') {
    return isDesi
      ? `Kya shot maara hai boss, seedha chakka ${outcome.direction} boundary ke paar! Crowd ka shor aasman chhoo raha hai!`
      : `Launched into orbit! Pure ${outcome.timing.toLowerCase()} timing sends it high over the ${outcome.direction} boundary for six!`;
  }
  if (outcome.code === '4') {
    return isDesi
      ? `Zabardast shot, ball goli ki tarah ${outcome.direction} rope ke paar chaar runs ke liye! Stadium jhoom utha hai!`
      : `Cracking boundary! Raced across the turf past the chasing fielder for four on the ${outcome.direction} side.`;
  }
  if (outcome.code === '2' || outcome.code === '1') {
    return isDesi
      ? `Tez bhaag kar ${outcome.runs} run le liye, fielder ne pickup karke keeper ko throw kar diya! Score ${matchState.runs}/${matchState.wickets} par pahunch gaya.`
      : `Placed cleanly into the ${outcome.direction} gap for ${outcome.runs} run(s) before the relay throw reaches the keeper. ${chaseContext}`;
  }
  return isDesi
    ? `Uff, ${outcome.deliverySpeedKph} kph ki ball par dot ball nikal gayi aur keeper ne clean collect kiya! Agli ball pe bada hit chahiye.`
    : `Tight delivery at ${outcome.deliverySpeedKph} kph — collected cleanly behind the stumps. ${chaseContext}`;
}
