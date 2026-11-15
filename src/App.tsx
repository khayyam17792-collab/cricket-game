import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { ControlDock } from './components/ControlDock';
import { CustomizerModal } from './components/CustomizerModal';
import { DrsOverlay } from './components/DrsOverlay';
import { InningsBreakModal } from './components/InningsBreakModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OutcomeBanner } from './components/OutcomeBanner';
import { PitchAimLabel } from './components/PitchAimLabel';
import { PreOverSetupModal } from './components/PreOverSetupModal';
import { ScoreboardHUD } from './components/ScoreboardHUD';
import { TossModal } from './components/TossModal';
import {
  buildLocalFallbackBatterStrategy,
  buildLocalFallbackCommentary,
  buildLocalFallbackStrategy,
  fetchAiBatterStrategy,
  fetchAiBowlerStrategy,
  fetchLiveCommentary,
} from './services/geminiCricketService';
import {
  clearLeaderboard,
  getLeaderboard,
  saveLeaderboardEntry,
} from './services/leaderboardService';
import { CricketSceneEngine } from './three/CricketSceneEngine';
import {
  BowlerArchetype,
  BowlingDeliveryType,
  BowlingEnd,
  BowlingSide,
  CameraMode,
  CommentaryStyle,
  HudSnapshot,
  InningsRole,
  LeaderboardEntry,
  MatchOvers,
  PlayerCustomization,
  ShotDirection,
  SUPER_OVER_CONFIG,
} from './types/game';

const DEFAULT_PROFILE: PlayerCustomization = {
  playerName: 'STRIKER',
  jerseyNumber: '56',
  kitId: 'green-gold',
};

const INITIAL_HUD: HudSnapshot = {
  phase: 'toss',
  walkinProgress: 0,
  playerProfile: DEFAULT_PROFILE,
  oversCount: 1,
  inningsNumber: 1,
  inningsRole: 'batting',
  firstInningsSummary: null,
  bowlingEnd: 'pavilion',
  bowlingSide: 'over',
  bowlerArchetype: 'fast',
  bowlingDeliveryType: 'Outswinger',
  releaseMeter: 0.5,
  aimCursor: {
    visible: false,
    locked: false,
    screenX: 0,
    screenY: 0,
    lengthLabel: 'GOOD LENGTH',
    lineLabel: 'MIDDLE STUMP',
    distanceMeters: 5.7,
  },
  runs: 0,
  wickets: 0,
  sixesHit: 0,
  maxWickets: SUPER_OVER_CONFIG.maxWickets,
  target: null,
  ballsBowled: 0,
  totalBalls: SUPER_OVER_CONFIG.totalBalls,
  ballsLeft: SUPER_OVER_CONFIG.totalBalls,
  selectedDirection: 'straight',
  cameraMode: 'batter',
  deliveryLabel: 'Straight Seam-Up',
  deliverySpeedKph: 142,
  bounceX: 0.02,
  bounceZ: 3.9,
  isPlanningStrategy: false,
  timingProgress: 0,
  canSwing: false,
  hasBouncedAfterBat: false,
  drsReviewsLeft: 1,
  drsCountdown: 0,
  drsData: null,
  lastOutcome: null,
  history: [],
  matchResult: null,
};

const CAMERA_ORDER: CameraMode[] = ['batter', 'bowler', 'side'];

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CricketSceneEngine | null>(null);
  const commentaryReqIdRef = useRef(0);
  const commentaryStyleRef = useRef<CommentaryStyle>('english-tv');
  const totalBallsRef = useRef<number>(SUPER_OVER_CONFIG.totalBalls);
  const savedMatchRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  totalBallsRef.current = hud.totalBalls;

  const [playerProfile, setPlayerProfile] =
    useState<PlayerCustomization>(DEFAULT_PROFILE);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [commentaryStyle, setCommentaryStyle] =
    useState<CommentaryStyle>('english-tv');
  const [commentary, setCommentary] = useState<string>('');
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    LeaderboardEntry[]
  >(() => getLeaderboard());
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const handleChangeCommentaryStyle = useCallback((style: CommentaryStyle) => {
    commentaryStyleRef.current = style;
    setCommentaryStyle(style);
  }, []);

  const handleChangeProfile = useCallback((profile: PlayerCustomization) => {
    setPlayerProfile(profile);
    engineRef.current?.setPlayerCustomization(profile);
  }, []);

  const handleChangeOvers = useCallback((overs: MatchOvers) => {
    engineRef.current?.setMatchOvers(overs);
  }, []);

  const handleCycleCamera = useCallback(() => {
    setHud((prev) => {
      const nextIdx =
        (CAMERA_ORDER.indexOf(prev.cameraMode) + 1) % CAMERA_ORDER.length;
      const nextMode = CAMERA_ORDER[nextIdx];
      engineRef.current?.setCameraMode(nextMode);
      return { ...prev, cameraMode: nextMode };
    });
  }, []);

  // Initialize Three.js WebGL Engine once in isolated mount container
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new CricketSceneEngine(container, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onRequestStrategy: async (context) => {
        const currentEngine = engineRef.current;
        if (!currentEngine) return;
        const epoch = currentEngine.getStrategyEpoch();

        try {
          setApiError(null);
          const plan = await fetchAiBowlerStrategy(context);
          engineRef.current?.applyBowlerStrategy(plan, epoch);
        } catch {
          const ballsDone = Math.max(
            0,
            totalBallsRef.current - context.ballsRemaining,
          );
          const fallback = buildLocalFallbackStrategy(ballsDone, []);
          engineRef.current?.applyBowlerStrategy(fallback, epoch);
        }
      },
      onRequestBatterStrategy: async (context) => {
        const currentEngine = engineRef.current;
        if (!currentEngine) return;
        const epoch = currentEngine.getStrategyEpoch();

        try {
          const plan = await fetchAiBatterStrategy(context);
          engineRef.current?.applyBatterStrategy(plan, epoch);
        } catch {
          const fallback = buildLocalFallbackBatterStrategy(context);
          engineRef.current?.applyBatterStrategy(fallback, epoch);
        }
      },
      onBallCompleted: async (outcome, matchState) => {
        const reqId = ++commentaryReqIdRef.current;
        setCommentaryLoading(true);
        try {
          const text = await fetchLiveCommentary(
            outcome,
            matchState,
            commentaryStyleRef.current,
          );
          const isUnsafe =
            !text ||
            text.includes('RESOURCE_EXHAUSTED') ||
            text.includes('"code":429') ||
            text.trim().startsWith('{');
          if (reqId === commentaryReqIdRef.current) {
            setCommentary(
              isUnsafe
                ? buildLocalFallbackCommentary(
                    outcome,
                    matchState,
                    commentaryStyleRef.current,
                  )
                : text,
            );
            setApiError(null);
          }
        } catch {
          if (reqId === commentaryReqIdRef.current) {
            setCommentary(
              buildLocalFallbackCommentary(
                outcome,
                matchState,
                commentaryStyleRef.current,
              ),
            );
            setApiError(null);
          }
        } finally {
          if (reqId === commentaryReqIdRef.current) {
            setCommentaryLoading(false);
          }
        }
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Auto-save user's batting performance to localStorage leaderboard once per completed 2-innings match
  useEffect(() => {
    if (hud.phase === 'gameover' && !savedMatchRef.current) {
      savedMatchRef.current = true;
      const userBattedFirst = hud.firstInningsSummary?.battingTeam === 'user';
      const battingSummary =
        userBattedFirst && hud.firstInningsSummary
          ? {
              runs: hud.firstInningsSummary.runs,
              ballsFaced: hud.firstInningsSummary.ballsBowled,
              sixesHit: hud.firstInningsSummary.sixesHit,
              wicketsLost: hud.firstInningsSummary.wickets,
              inningsRole: 'batting' as InningsRole,
            }
          : {
              runs: hud.runs,
              ballsFaced: hud.ballsBowled,
              sixesHit: hud.sixesHit,
              wicketsLost: hud.wickets,
              inningsRole: hud.inningsRole,
            };

      const updated = saveLeaderboardEntry({
        playerName: hud.playerProfile.playerName || 'STRIKER',
        jerseyNumber: hud.playerProfile.jerseyNumber || '56',
        kitId: hud.playerProfile.kitId,
        runs: battingSummary.runs,
        ballsFaced: battingSummary.ballsFaced,
        sixesHit: battingSummary.sixesHit,
        wicketsLost: battingSummary.wicketsLost,
        inningsRole: battingSummary.inningsRole,
        won: hud.matchResult === 'won',
      });
      setLeaderboardEntries(updated);
    } else if (
      hud.phase !== 'gameover' &&
      hud.inningsNumber === 1 &&
      hud.ballsBowled === 0
    ) {
      savedMatchRef.current = false;
    }
  }, [
    hud.phase,
    hud.inningsNumber,
    hud.ballsBowled,
    hud.playerProfile,
    hud.firstInningsSummary,
    hud.runs,
    hud.sixesHit,
    hud.wickets,
    hud.inningsRole,
    hud.matchResult,
  ]);

  // Global keyboard controls (WASD / Arrow Keys, Spacebar, C for camera)
  const inningsRoleRef = useRef<InningsRole>('batting');
  inningsRoleRef.current = hud.inningsRole;
  const heldAimKeysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  useEffect(() => {
    const syncAim = () => {
      engineRef.current?.setBowlingAimInput(heldAimKeysRef.current);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      const isBowling = inningsRoleRef.current === 'bowling';

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.left = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('leg');
        }
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.up = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('straight');
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        if (isBowling) {
          heldAimKeysRef.current.right = true;
          syncAim();
        } else if (!e.repeat) {
          engine.setDirection('off');
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (isBowling) {
          e.preventDefault();
          heldAimKeysRef.current.down = true;
          syncAim();
        }
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        engine.triggerSwing();
      } else if (e.code === 'KeyC' && !e.repeat) {
        e.preventDefault();
        handleCycleCamera();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        heldAimKeysRef.current.left = false;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        heldAimKeysRef.current.right = false;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        heldAimKeysRef.current.up = false;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        heldAimKeysRef.current.down = false;
      }
      syncAim();
    };

    const handleBlur = () => {
      heldAimKeysRef.current = {
        left: false,
        right: false,
        up: false,
        down: false,
      };
      syncAim();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleCycleCamera]);

  const handleSelectDirection = useCallback((dir: ShotDirection) => {
    engineRef.current?.setDirection(dir);
  }, []);

  const handleSelectDeliveryType = useCallback((type: BowlingDeliveryType) => {
    engineRef.current?.setBowlingDeliveryType(type);
  }, []);

  const handleSwing = useCallback(() => {
    engineRef.current?.triggerSwing();
  }, []);

  const handleSkipWalkIn = useCallback(() => {
    engineRef.current?.skipWalkIn();
  }, []);

  const handleCompleteToss = useCallback((role: InningsRole) => {
    setCustomizerOpen(false);
    engineRef.current?.completeToss(role);
  }, []);

  const handleStartOrRestart = useCallback(() => {
    savedMatchRef.current = false;
    commentaryReqIdRef.current += 1;
    setCommentary(
      commentaryStyleRef.current === 'roman-urdu-desi'
        ? 'Floodlights on hain boss, aur match full garam hai! Bowler run-up par tayaar, dekhtay hain pehli ball pe kya dhamaka hota hai!'
        : 'Welcome under the floodlights! Both sides are locked in — the bowler is at the top of the mark.',
    );
    setCommentaryLoading(false);
    setApiError(null);
    engineRef.current?.startSuperOver();
  }, []);

  const handleStartSecondInnings = useCallback(() => {
    commentaryReqIdRef.current += 1;
    setCommentary(
      commentaryStyleRef.current === 'roman-urdu-desi'
        ? '2nd Innings shuru ho gayi hai boss! Target board par lag chuka hai — ab asli muqabla shuru!'
        : 'The 2nd Innings chase is underway under the lights! Let us see if this target can be defended.',
    );
    setCommentaryLoading(false);
    setApiError(null);
    engineRef.current?.startSecondInnings();
  }, []);

  const handleConfirmSetup = useCallback(
    (end: BowlingEnd, side: BowlingSide, archetype: BowlerArchetype) => {
      engineRef.current?.configureOverSetup(end, side, archetype);
      handleStartOrRestart();
    },
    [handleStartOrRestart],
  );

  const handleNewToss = useCallback(() => {
    savedMatchRef.current = false;
    setCustomizerOpen(false);
    engineRef.current?.openTossScreen();
  }, []);

  const handleTriggerDrs = useCallback(() => {
    engineRef.current?.triggerDrsReview();
  }, []);

  const handleAcceptOut = useCallback(() => {
    engineRef.current?.acceptDrsDismissal();
  }, []);

  const handleFinishDrsReview = useCallback(() => {
    engineRef.current?.finishDrsReviewNow();
  }, []);

  const handleClearLeaderboard = useCallback(() => {
    setLeaderboardEntries(clearLeaderboard());
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#060b16]">
      {/* Isolated Full-Viewport WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="3D Night Cricket Stadium"
      />

      {/* Broadcast Top Scoreboard HUD + Top-Right Corner Camera Toggle */}
      <ScoreboardHUD
        hud={hud}
        muted={muted}
        onToggleMute={handleToggleMute}
        onCycleCamera={handleCycleCamera}
        onRestart={handleStartOrRestart}
      />

      {/* Interactive Coin Toss Modal (Entry Screen) */}
      {hud.phase === 'toss' && !customizerOpen && (
        <TossModal
          oversCount={hud.oversCount}
          playerProfile={playerProfile}
          leaderboardCount={leaderboardEntries.length}
          onChangeOvers={handleChangeOvers}
          onCompleteToss={handleCompleteToss}
          onOpenCustomizer={() => setCustomizerOpen(true)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
        />
      )}

      {/* Optional Player & Team Kit Customizer Opened From Toss */}
      {hud.phase === 'toss' && customizerOpen && (
        <CustomizerModal
          profile={playerProfile}
          commentaryStyle={commentaryStyle}
          leaderboardCount={leaderboardEntries.length}
          onChangeProfile={handleChangeProfile}
          onChangeCommentaryStyle={handleChangeCommentaryStyle}
          onEnterStadium={() => setCustomizerOpen(false)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
        />
      )}

      {/* Pre-Over Bowling End, Side & Archetype Selection Modal */}
      {hud.phase === 'endSelect' && (
        <PreOverSetupModal
          inningsNumber={hud.inningsNumber}
          inningsRole={hud.inningsRole}
          target={hud.target}
          oversCount={hud.oversCount}
          totalBalls={hud.totalBalls}
          initialEnd={hud.bowlingEnd}
          initialSide={hud.bowlingSide}
          initialArchetype={hud.bowlerArchetype}
          commentaryStyle={commentaryStyle}
          onChangeCommentaryStyle={handleChangeCommentaryStyle}
          onConfirmSetup={handleConfirmSetup}
        />
      )}

      {/* TV Broadcast Innings Break Scorecard & 2nd Innings Role Swap */}
      {hud.phase === 'inningsBreak' && (
        <InningsBreakModal
          hud={hud}
          onStartSecondInnings={handleStartSecondInnings}
        />
      )}

      {/* Dramatic DRS Appeal & 3D Hawk-Eye Ball Tracking Overlay */}
      <DrsOverlay
        hud={hud}
        onTriggerDrs={handleTriggerDrs}
        onAcceptOut={handleAcceptOut}
        onFinishReview={handleFinishDrsReview}
      />

      {/* Dynamic 3D Pitch Aiming Cursor Distance/Length Label */}
      <PitchAimLabel aimCursor={hud.aimCursor} />

      {/* Walk-In Banner, Live Callout, and Final Match Winner Modal */}
      <OutcomeBanner
        hud={hud}
        commentaryStyle={commentaryStyle}
        onChangeCommentaryStyle={handleChangeCommentaryStyle}
        onSkipWalkIn={handleSkipWalkIn}
        onStartOrRestart={handleStartOrRestart}
        onNewToss={handleNewToss}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
      />

      {/* Bottom Collapsible Batting/Bowling Controls + Live Broadcast Commentary Ticker */}
      <ControlDock
        hud={hud}
        commentary={commentary}
        commentaryLoading={commentaryLoading}
        apiError={apiError}
        onSelectDirection={handleSelectDirection}
        onSelectDeliveryType={handleSelectDeliveryType}
        onSwing={handleSwing}
      />

      {/* DevFest Stage Top Scorers Leaderboard Modal */}
      <LeaderboardModal
        isOpen={leaderboardOpen}
        entries={leaderboardEntries}
        onClose={() => setLeaderboardOpen(false)}
        onClear={handleClearLeaderboard}
      />
    </main>
  );
}
