import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const distDir = path.resolve(__dirname, 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
const hasBuiltDist = fs.existsSync(indexHtmlPath);
const runningUnderTsx = process.execArgv.some((arg) => arg.includes('tsx'));
const isExplicitDev =
  process.env.NODE_ENV === 'development' ||
  process.env.npm_lifecycle_event === 'dev' ||
  runningUnderTsx;
const isProd =
  process.env.NODE_ENV === 'production' || (hasBuiltDist && !isExplicitDev);

let cachedAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

const ALLOWED_DELIVERIES = [
  'In-swinging Yorker',
  'Fast Bouncer',
  'Wide Off-Cutter',
  'Straight Seam-Up',
] as const;

type AllowedDeliveryName = (typeof ALLOWED_DELIVERIES)[number];

interface StrategyRequestBody {
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

interface CommentaryRequestBody {
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

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function normalizeDeliveryName(raw: unknown): AllowedDeliveryName {
  if (typeof raw === 'string') {
    const exact = ALLOWED_DELIVERIES.find(
      (d) => d.toLowerCase() === raw.trim().toLowerCase(),
    );
    if (exact) return exact;
    const lower = raw.toLowerCase();
    if (lower.includes('yorker')) return 'In-swinging Yorker';
    if (lower.includes('bouncer')) return 'Fast Bouncer';
    if (lower.includes('cutter') || lower.includes('wide')) return 'Wide Off-Cutter';
  }
  return 'Straight Seam-Up';
}

let hydrogenCooldownUntil = 0;
let liteCooldownUntil = 0;

function isQuotaOrRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate')
  );
}

async function generateWithModelFallback(options: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
}): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  const tryModel = async (
    model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
    thinkingLevel: ThinkingLevel,
  ): Promise<string | null> => {
    const response = await ai.models.generateContent({
      model,
      contents: options.contents,
      config: {
        thinkingConfig: { thinkingLevel },
        ...(options.systemInstruction
          ? { systemInstruction: options.systemInstruction }
          : {}),
        ...(options.responseMimeType
          ? { responseMimeType: options.responseMimeType }
          : {}),
        ...(options.responseSchema
          ? { responseSchema: options.responseSchema as never }
          : {}),
      },
    });
    const text = (response.text ?? '').trim();
    return text || null;
  };

  if (Date.now() >= hydrogenCooldownUntil) {
    try {
      return await tryModel('gemini-4-hydrogen', ThinkingLevel.LOW);
    } catch (err) {
      if (isQuotaOrRateLimitError(err)) {
        hydrogenCooldownUntil = Date.now() + 10 * 60_000;
        console.warn(
          'gemini-4-hydrogen quota exhausted; switching to gemini-3.1-flash-lite fallback.',
        );
      } else {
        throw err;
      }
    }
  }

  if (Date.now() >= liteCooldownUntil) {
    try {
      return await tryModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL);
    } catch (err) {
      if (isQuotaOrRateLimitError(err)) {
        liteCooldownUntil = Date.now() + 10 * 60_000;
        console.warn(
          'gemini-3.1-flash-lite quota exhausted; using local broadcast fallback.',
        );
        return null;
      }
      throw err;
    }
  }

  return null;
}

function buildFallbackStrategy(body: StrategyRequestBody): {
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

interface BatterStrategyRequestBody {
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

function buildFallbackBatterStrategy(b: BatterStrategyRequestBody): {
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

function buildFallbackCommentary(b: CommentaryRequestBody): string {
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

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get(['/healthz', '/api/health'], (_req, res) => {
    res.status(200).json({ ok: true, mode: isProd ? 'production' : 'development' });
  });

  // 1. AI Bowler Strategy Endpoint (Structured JSON via Gemini)
  app.post('/api/bowler-strategy', async (req, res) => {
    const body = req.body as StrategyRequestBody;
    try {
      const situationText =
        body.target !== null && body.target !== undefined
          ? `2nd Innings chase: Batter is on ${body.runs}/${body.wickets} (max ${body.maxWickets} wickets), chasing ${body.target} (${Math.max(0, body.target - (body.runs ?? 0))} runs needed) with ${body.ballsRemaining} balls remaining.`
          : `1st Innings (setting a target): Batter is on ${body.runs}/${body.wickets} (max ${body.maxWickets} wickets) with ${body.ballsRemaining} balls remaining.`;
      const shotsText =
        body.lastShots && body.lastShots.length > 0
          ? body.lastShots
              .map(
                (s, i) =>
                  `Shot ${i + 1}: direction=${s.direction}, timing=${s.timing}, result=${s.outcome}`,
              )
              .join('; ')
          : 'No shots faced yet (opening delivery of the innings).';

      const prompt = [
        'You are the tactical fast bowler in a high-pressure Cricket Super Over under stadium floodlights.',
        situationText,
        `Batter's last 2 shots: ${shotsText}.`,
        'Choose the smartest next delivery to deceive the batter and restrict runs or take a wicket.',
        'Coordinate rules for the 3D cricket pitch (striker stumps are at z=+10.06m, popping crease at z=+8.84m, x=0 is middle stump, -x is leg side/left, +x is off side/right):',
        '- "deliveryName" MUST be one of: "In-swinging Yorker", "Fast Bouncer", "Wide Off-Cutter", "Straight Seam-Up".',
        '- "speed": numeric speed in kph between 122 and 148 (Fast Bouncer / Straight Seam-Up: 138-148; In-swinging Yorker: 135-145; Wide Off-Cutter: 122-133).',
        '- "bounceX": numeric lateral bounce coordinate in meters: left/leg = -0.22 to -0.10, middle = -0.05 to 0.06, right/off = 0.16 to 0.36 (for Wide Off-Cutter use ~0.28 to 0.36).',
        '- "bounceZ": numeric length coordinate in meters: yorker = 7.1 to 7.7, good length = 3.2 to 4.6, short = -0.8 to 0.6.',
      ].join('\n');

      const rawText = await generateWithModelFallback({
        contents: prompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            deliveryName: {
              type: Type.STRING,
              enum: [...ALLOWED_DELIVERIES],
              description:
                'Exact delivery type: In-swinging Yorker, Fast Bouncer, Wide Off-Cutter, or Straight Seam-Up.',
            },
            speed: {
              type: Type.NUMBER,
              description: 'Ball release speed in kph (122 to 148).',
            },
            bounceX: {
              type: Type.NUMBER,
              description:
                'Target bounce X on the pitch in meters: left (-0.22), middle (0.0), or right (+0.34).',
            },
            bounceZ: {
              type: Type.NUMBER,
              description:
                'Target bounce Z length in meters: yorker (7.4), good length (3.9), or short (-0.3).',
            },
          },
          required: ['deliveryName', 'speed', 'bounceX', 'bounceZ'],
        },
      });

      if (!rawText) {
        res.json(buildFallbackStrategy(body));
        return;
      }

      const parsed = JSON.parse(rawText) as {
        deliveryName?: unknown;
        speed?: unknown;
        bounceX?: unknown;
        bounceZ?: unknown;
      };

      const deliveryName = normalizeDeliveryName(parsed.deliveryName);
      const speed = Math.round(clamp(Number(parsed.speed) || 138, 120, 150));
      const bounceX = Number(clamp(Number(parsed.bounceX) || 0, -0.35, 0.42).toFixed(3));
      const bounceZ = Number(clamp(Number(parsed.bounceZ) || 3.9, -1.0, 7.75).toFixed(3));

      res.json({
        deliveryName,
        speed,
        bounceX,
        bounceZ,
      });
    } catch (err) {
      console.error('Gemini /api/bowler-strategy error:', err);
      res.json(buildFallbackStrategy(body));
    }
  });

  // 1b. AI Batter Strategy Endpoint (Structured JSON for Bowling Mode)
  app.post('/api/batter-strategy', async (req, res) => {
    const body = req.body as BatterStrategyRequestBody;
    try {
      const matchDesc =
        body.target !== null && body.target !== undefined
          ? `2nd Innings chase: ${body.runs}/${body.wickets}, chasing ${body.target} (${Math.max(0, body.target - (body.runs ?? 0))} needed) with ${body.ballsRemaining} balls left.`
          : `1st Innings (setting target): ${body.runs}/${body.wickets} with ${body.ballsRemaining} balls left.`;
      const prompt = [
        'You are an AI T20 batter facing a human bowler in a Cricket Super Over.',
        matchDesc,
        `Incoming ball: ${body.deliveryType} at ${body.speed} kph, aiming bounceX=${body.bounceX}m (-x leg, +x off), bounceZ=${body.bounceZ}m (+7.4 yorker, +3.8 good, -0.3 short).`,
        'Respond with JSON picking shotDirection ("leg" | "straight" | "off"), aggression ("defend" | "rotate" | "attack"), and timingOffsetSec (-0.12 to +0.12, where 0 is sweet spot, nonzero risks edge/miss on good balls).',
      ].join('\n');

      const rawText = await generateWithModelFallback({
        contents: prompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shotDirection: {
              type: Type.STRING,
              enum: ['leg', 'straight', 'off'],
            },
            aggression: {
              type: Type.STRING,
              enum: ['defend', 'rotate', 'attack'],
            },
            timingOffsetSec: {
              type: Type.NUMBER,
            },
          },
          required: ['shotDirection', 'aggression', 'timingOffsetSec'],
        },
      });

      if (!rawText) {
        res.json(buildFallbackBatterStrategy(body));
        return;
      }

      const parsed = JSON.parse(rawText) as {
        shotDirection?: string;
        aggression?: string;
        timingOffsetSec?: number;
      };
      const shotDirection =
        parsed.shotDirection === 'leg' || parsed.shotDirection === 'off'
          ? parsed.shotDirection
          : 'straight';
      const aggression =
        parsed.aggression === 'defend' || parsed.aggression === 'attack'
          ? parsed.aggression
          : 'rotate';
      const timingOffsetSec = clamp(Number(parsed.timingOffsetSec) || 0, -0.14, 0.14);

      res.json({ shotDirection, aggression, timingOffsetSec });
    } catch (err) {
      console.error('Gemini /api/batter-strategy error:', err);
      res.json(buildFallbackBatterStrategy(body));
    }
  });

  // 2. Live Broadcast Commentary Endpoint
  app.post('/api/commentary', async (req, res) => {
    const b = req.body as CommentaryRequestBody;
    try {
      const lineDesc =
        b.bounceX < -0.08
          ? 'on the leg-side line'
          : b.bounceX > 0.12
            ? 'wide outside the off stump'
            : 'tight on middle-and-off stump';
      const lengthDesc =
        b.bounceZ >= 6.0
          ? 'right up in the yorker blockhole'
          : b.bounceZ <= 1.0
            ? 'dug in short on the pitch'
            : 'on a nagging good length';

      const isDesiStyle = b.commentaryStyle === 'roman-urdu-desi';
      const systemInstruction = isDesiStyle
        ? 'You are a hilarious, hyper-energetic Desi street-cricket / Roman Urdu commentator calling a floodlit Super Over. Use witty, clean Roman Urdu slang (like yaar, chakka, danda ukharr gaya, bouncer, gully style, shor mach gaya) mixed with English cricket terms. Always respond with exactly two punchy sentences.'
        : 'You are a crisp, high-energy T20 television cricket broadcaster. Always respond with exactly two vivid sentences.';

      const scoreboardLine =
        b.target !== null && b.target !== undefined
          ? `Scoreboard now: ${b.runs}/${b.wickets} chasing ${b.target} with ${b.ballsRemaining} ball(s) left in the 2nd innings.`
          : `Scoreboard now: ${b.runs}/${b.wickets} setting the 1st innings target with ${b.ballsRemaining} ball(s) left.`;

      const prompt = [
        isDesiStyle
          ? 'Call this night-stadium Super Over ball in funny Roman Urdu / Desi Street Cricket style!'
          : 'You are an electrifying TV cricket commentator calling a night-stadium Super Over live under floodlights.',
        `Delivery bowled: ${b.deliveryName} at ${b.speed} kph, pitching ${lengthDesc} and ${lineDesc}.`,
        `Batter attempted a ${b.direction} shot with ${b.timing} timing.`,
        `Outcome: ${b.outcomeLabel} (${b.outcomeCode === 'W' ? 'WICKET FELL!' : `${b.runsScored} run(s)`}).`,
        scoreboardLine,
        isDesiStyle
          ? 'Write EXACTLY 2 hilarious, energetic Roman Urdu sentences (under 46 words total): sentence 1 reacts to the ball movement and bat/stump impact with desi street-cricket humor; sentence 2 hypes the crowd reaction and Super Over drama. Plain text only, no hashtags, no emojis, no markdown.'
          : 'Write EXACTLY 2 energetic broadcast sentences (under 42 words total): sentence 1 describes the 3D ball movement and shot/stump impact; sentence 2 captures the stadium crowd reaction and Super Over stakes. Plain text only, no hashtags, no emojis, no markdown.',
      ].join('\n');

      const commentary = await generateWithModelFallback({
        contents: prompt,
        systemInstruction,
      });

      if (!commentary) {
        res.json({ commentary: buildFallbackCommentary(b) });
        return;
      }

      res.json({ commentary });
    } catch (err) {
      console.error('Gemini /api/commentary error:', err);
      res.json({ commentary: buildFallbackCommentary(b) });
    }
  });

  if (isProd && fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir, { index: 'index.html' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      if (req.path.startsWith('/assets/')) {
        res.status(404).end();
        return;
      }
      res.sendFile(indexHtmlPath, (err) => {
        if (err && !res.headersSent) {
          console.error('Failed to send index.html:', err);
          res.status(500).send('Unable to load application.');
        }
      });
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Express error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`,
    );
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
