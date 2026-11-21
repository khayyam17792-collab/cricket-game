import { Type } from '@google/genai';
import { Router } from 'express';
import { generateWithModelFallback } from '../config/gemini.ts';
import {
  ALLOWED_DELIVERIES,
  buildFallbackBatterStrategy,
  buildFallbackCommentary,
  buildFallbackStrategy,
  clamp,
  normalizeDeliveryName,
  type BatterStrategyRequestBody,
  type CommentaryRequestBody,
  type StrategyRequestBody,
} from '../services/cricketFallbackService.ts';

export function createCricketRouter(): Router {
  const router = Router();

  // 1. AI Bowler Strategy Endpoint (Structured JSON via Gemini)
  router.post('/bowler-strategy', async (req, res) => {
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

      res.json({
        deliveryName: normalizeDeliveryName(parsed.deliveryName),
        speed: Math.round(clamp(Number(parsed.speed) || 138, 120, 150)),
        bounceX: Number(clamp(Number(parsed.bounceX) || 0, -0.35, 0.42).toFixed(3)),
        bounceZ: Number(clamp(Number(parsed.bounceZ) || 3.9, -1.0, 7.75).toFixed(3)),
      });
    } catch (err) {
      console.error('Gemini /api/bowler-strategy error:', err);
      res.json(buildFallbackStrategy(body));
    }
  });

  // 2. AI Batter Strategy Endpoint (Structured JSON for Bowling Mode)
  router.post('/batter-strategy', async (req, res) => {
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

  // 3. Live Broadcast Commentary Endpoint
  router.post('/commentary', async (req, res) => {
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

  return router;
}
