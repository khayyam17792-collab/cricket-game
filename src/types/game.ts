export type ShotDirection = 'leg' | 'straight' | 'off';

export type CameraMode = 'batter' | 'bowler' | 'side';

export type CommentaryStyle = 'english-tv' | 'roman-urdu-desi';

export type BowlingEnd = 'pavilion' | 'cathedral';

export type BowlingSide = 'over' | 'around';

export type BowlerArchetype = 'fast' | 'swing' | 'spin';

export type InningsRole = 'batting' | 'bowling';

export type TossCall = 'heads' | 'tails';

export type TeamKitId =
  | 'green-gold'
  | 'blue-orange'
  | 'yellow-green'
  | 'black-silver';

export interface TeamKitSpec {
  id: TeamKitId;
  label: string;
  jerseyMain: string;
  jerseyAccent: string;
  trouserMain: string;
  helmetHex: number;
  accentHex: number;
}

export const TEAM_KITS: Record<TeamKitId, TeamKitSpec> = {
  'green-gold': {
    id: 'green-gold',
    label: 'Green / Gold',
    jerseyMain: '#059669',
    jerseyAccent: '#fbbf24',
    trouserMain: '#064e3b',
    helmetHex: 0x064e3b,
    accentHex: 0xfbbf24,
  },
  'blue-orange': {
    id: 'blue-orange',
    label: 'Blue / Orange',
    jerseyMain: '#1d4ed8',
    jerseyAccent: '#f97316',
    trouserMain: '#0f172a',
    helmetHex: 0x0f172a,
    accentHex: 0xf97316,
  },
  'yellow-green': {
    id: 'yellow-green',
    label: 'Yellow / Green',
    jerseyMain: '#eab308',
    jerseyAccent: '#15803d',
    trouserMain: '#14532d',
    helmetHex: 0x14532d,
    accentHex: 0xfacc15,
  },
  'black-silver': {
    id: 'black-silver',
    label: 'Black / Silver',
    jerseyMain: '#18181b',
    jerseyAccent: '#cbd5e1',
    trouserMain: '#09090b',
    helmetHex: 0x09090b,
    accentHex: 0xe2e8f0,
  },
};

export interface PlayerCustomization {
  playerName: string;
  jerseyNumber: string;
  kitId: TeamKitId;
}

export type BowlingDeliveryType =
  | 'Fast Yorker'
  | 'Outswinger'
  | 'Bouncer'
  | 'Slower Cutter';

export type AiDeliveryName =
  | 'In-swinging Yorker'
  | 'Fast Bouncer'
  | 'Wide Off-Cutter'
  | 'Straight Seam-Up'
  | 'Looping Off-Break'
  | 'Googly Turner'
  | BowlingDeliveryType;

export interface AiDeliveryPlan {
  deliveryName: AiDeliveryName;
  speed: number;
  bounceX: number;
  bounceZ: number;
}

export interface AiBatterPlan {
  shotDirection: ShotDirection;
  aggression: 'defend' | 'rotate' | 'attack';
  timingOffsetSec: number;
}

export type DrsDismissalType = 'lbw' | 'edge';

export interface DrsVerdictData {
  dismissalType: DrsDismissalType;
  pitchingLabel: 'IN LINE' | 'OUTSIDE OFF' | 'OUTSIDE LEG';
  impactLabel: 'IN LINE' | "UMPIRE'S CALL" | 'OUTSIDE OFF' | 'OUTSIDE LEG';
  wicketsLabel: 'HITTING STUMPS' | "UMPIRE'S CALL" | 'MISSING STUMPS';
  ultraEdgeSpike: boolean;
  overturned: boolean;
  finalDecision: 'OUT' | 'NOT OUT';
  headline: string;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  jerseyNumber: string;
  kitId: TeamKitId;
  runs: number;
  ballsFaced: number;
  sixesHit: number;
  wicketsLost: number;
  inningsRole: InningsRole;
  won: boolean;
  timestamp: number;
}

export type BallOutcomeCode = '6' | '4' | '2' | '1' | '0' | 'W';

export type TimingVerdict = 'PERFECT' | 'GOOD' | 'EARLY' | 'LATE' | 'MISSED';

export type MatchPhase =
  | 'customize'
  | 'toss'
  | 'walkin'
  | 'endSelect'
  | 'intro'
  | 'ready'
  | 'runup'
  | 'delivery'
  | 'ballInPlay'
  | 'drsPrompt'
  | 'drsReview'
  | 'inningsBreak'
  | 'gameover';

export type MatchOvers = 1 | 2;
export type MatchResult = 'won' | 'lost' | 'tied' | null;

export interface InningsSummary {
  battingTeam: 'user' | 'ai';
  runs: number;
  wickets: number;
  ballsBowled: number;
  sixesHit: number;
  history: BallOutcomeRecord[];
}

export interface BallOutcomeRecord {
  ballNumber: number;
  code: BallOutcomeCode;
  runs: number;
  isWicket: boolean;
  timing: TimingVerdict;
  direction: ShotDirection;
  deliveryLabel: string;
  deliverySpeedKph: number;
  bounceX: number;
  bounceZ: number;
  headline: string;
  detail: string;
}

export interface BowlingAimCursorHud {
  visible: boolean;
  locked: boolean;
  screenX: number;
  screenY: number;
  lengthLabel: 'YORKER' | 'FULL' | 'GOOD LENGTH' | 'SHORT BOUNCER';
  lineLabel: 'OUTSIDE OFF' | 'MIDDLE STUMP' | 'LEG SIDE';
  distanceMeters: number;
}

export interface HudSnapshot {
  phase: MatchPhase;
  walkinProgress: number;
  playerProfile: PlayerCustomization;
  oversCount: MatchOvers;
  inningsNumber: 1 | 2;
  inningsRole: InningsRole;
  firstInningsSummary: InningsSummary | null;
  bowlingEnd: BowlingEnd;
  bowlingSide: BowlingSide;
  bowlerArchetype: BowlerArchetype;
  bowlingDeliveryType: BowlingDeliveryType;
  releaseMeter: number;
  aimCursor: BowlingAimCursorHud;
  runs: number;
  wickets: number;
  sixesHit: number;
  maxWickets: number;
  target: number | null;
  ballsBowled: number;
  totalBalls: number;
  ballsLeft: number;
  selectedDirection: ShotDirection;
  cameraMode: CameraMode;
  deliveryLabel: string;
  deliverySpeedKph: number;
  bounceX: number;
  bounceZ: number;
  isPlanningStrategy: boolean;
  /** 0..1 normalized progress of ball from release to crease; ~0.88 is optimal hit point */
  timingProgress: number;
  canSwing: boolean;
  hasBouncedAfterBat: boolean;
  drsReviewsLeft: number;
  drsCountdown: number;
  drsData: DrsVerdictData | null;
  lastOutcome: BallOutcomeRecord | null;
  history: BallOutcomeRecord[];
  matchResult: MatchResult;
}

export const SUPER_OVER_CONFIG = {
  target: 16,
  maxWickets: 2,
  totalBalls: 6,
} as const;
