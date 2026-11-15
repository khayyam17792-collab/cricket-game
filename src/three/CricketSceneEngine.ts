import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import {
  AiBatterPlan,
  AiDeliveryName,
  AiDeliveryPlan,
  BallOutcomeCode,
  BallOutcomeRecord,
  BowlerArchetype,
  BowlingDeliveryType,
  BowlingEnd,
  BowlingSide,
  CameraMode,
  DrsDismissalType,
  DrsVerdictData,
  HudSnapshot,
  InningsRole,
  InningsSummary,
  MatchOvers,
  MatchPhase,
  MatchResult,
  PlayerCustomization,
  ShotDirection,
  TimingVerdict,
} from '../types/game';
import {
  updateBatterPose,
  updateBowlerPose,
  updateKeeperPose,
} from './characterAnimator';
import { VictoryFireworks } from './fireworks';
import {
  buildPitchAndCharacters,
  PitchAndActorsResult,
} from './pitchAndCharacters';
import { buildCricketStadium, StadiumBuildResult } from './stadiumBuilder';
import {
  updateXbotBatterPose,
  updateXbotBowlerPose,
  updateXbotFielderPose,
  updateXbotKeeperPose,
  updateXbotNonStrikerPose,
} from './xbotAnimator';
import { XbotRosterResult } from './xbotLoader';

interface DeliveryPreset {
  label: AiDeliveryName;
  speedKph: number;
  flightSpeed: number;
  bounceZ: number;
  bounceX: number;
  swingAccelX: number;
  seamTurnX: number;
  restitution: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onRequestStrategy: (context: {
    runs: number;
    wickets: number;
    maxWickets: number;
    target: number | null;
    inningsNumber: 1 | 2;
    ballsRemaining: number;
    lastShots: Array<{
      direction: ShotDirection;
      timing: TimingVerdict;
      outcome: BallOutcomeCode;
    }>;
  }) => void;
  onRequestBatterStrategy: (context: {
    deliveryType: BowlingDeliveryType;
    speed: number;
    bounceX: number;
    bounceZ: number;
    runs: number;
    wickets: number;
    target: number | null;
    inningsNumber: 1 | 2;
    ballsRemaining: number;
  }) => void;
  onBallCompleted: (
    outcome: BallOutcomeRecord,
    matchState: {
      runs: number;
      wickets: number;
      target: number | null;
      inningsNumber: 1 | 2;
      ballsRemaining: number;
    },
  ) => void;
}

const BALL_RADIUS = 0.062;
const GROUND_CONTACT_Y = 0.022 + BALL_RADIUS;

function buildPhysicsFromPlan(
  plan: AiDeliveryPlan,
  archetype: BowlerArchetype = 'fast',
): DeliveryPreset {
  const isSpin = archetype === 'spin';
  const isSwing = archetype === 'swing';

  const speedKph = isSpin
    ? Math.round(THREE.MathUtils.clamp(86 + ((plan.speed % 12) + 12) % 12, 84, 97))
    : isSwing
      ? Math.round(THREE.MathUtils.clamp(plan.speed - 6, 128, 141))
      : Math.round(THREE.MathUtils.clamp(plan.speed, 136, 152));

  // Map speed to 3D flight velocity
  const flightSpeed = isSpin
    ? THREE.MathUtils.mapLinear(speedKph, 84, 98, 15.6, 18.2)
    : THREE.MathUtils.mapLinear(speedKph, 120, 152, 21.5, 28.4);

  const bounceX = THREE.MathUtils.clamp(plan.bounceX, -0.35, 0.42);
  const bounceZ = THREE.MathUtils.clamp(plan.bounceZ, -1.0, 7.75);

  if (isSpin) {
    const isGoogly = plan.deliveryName === 'Wide Off-Cutter' || plan.bounceX > 0.16;
    return {
      label: isGoogly ? 'Googly Turner' : 'Looping Off-Break',
      speedKph,
      flightSpeed,
      bounceX,
      bounceZ: THREE.MathUtils.clamp(bounceZ, 2.2, 6.4),
      swingAccelX: isGoogly ? -0.45 : 0.45,
      seamTurnX: isGoogly ? 1.85 : -1.95,
      restitution: 0.72,
    };
  }

  const swingBoost = isSwing ? 1.72 : 1.0;

  switch (plan.deliveryName) {
    case 'Fast Yorker':
    case 'In-swinging Yorker':
      return {
        label: plan.deliveryName,
        speedKph,
        flightSpeed,
        bounceX,
        bounceZ,
        swingAccelX: -1.15 * swingBoost,
        seamTurnX: -0.35,
        restitution: 0.55,
      };
    case 'Bouncer':
    case 'Fast Bouncer':
      return {
        label: plan.deliveryName,
        speedKph,
        flightSpeed,
        bounceX,
        bounceZ,
        swingAccelX: 0.15 * swingBoost,
        seamTurnX: 0.12,
        restitution: 0.88,
      };
    case 'Outswinger':
      return {
        label: 'Outswinger',
        speedKph,
        flightSpeed,
        bounceX,
        bounceZ,
        swingAccelX: 1.75 * swingBoost,
        seamTurnX: 0.32,
        restitution: 0.72,
      };
    case 'Slower Cutter':
    case 'Wide Off-Cutter':
      return {
        label: plan.deliveryName,
        speedKph:
          plan.deliveryName === 'Slower Cutter'
            ? Math.round(THREE.MathUtils.clamp(plan.speed, 108, 120))
            : speedKph,
        flightSpeed:
          plan.deliveryName === 'Slower Cutter'
            ? THREE.MathUtils.mapLinear(
                THREE.MathUtils.clamp(plan.speed, 108, 120),
                108,
                122,
                19.2,
                21.8,
              )
            : flightSpeed,
        bounceX,
        bounceZ,
        swingAccelX: 0.3 * swingBoost,
        seamTurnX: plan.deliveryName === 'Slower Cutter' ? -1.55 : -1.35,
        restitution: 0.68,
      };
    case 'Straight Seam-Up':
    default:
      return {
        label: 'Straight Seam-Up',
        speedKph,
        flightSpeed,
        bounceX,
        bounceZ,
        swingAccelX: -0.22 * swingBoost,
        seamTurnX: -0.25,
        restitution: 0.74,
      };
  }
}

const DEFAULT_PRESET: DeliveryPreset = buildPhysicsFromPlan({
  deliveryName: 'Straight Seam-Up',
  speed: 142,
  bounceX: 0.02,
  bounceZ: 3.9,
});

// Reusable math objects (zero GC in animation loop)
const _camPosTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camLookCurrent = new THREE.Vector3(0, 0.9, -4.5);
const _mat4 = new THREE.Matrix4();
const _vec3A = new THREE.Vector3();
const _prevBallPos = new THREE.Vector3();
const _ballWorldA = new THREE.Vector3();
const _ballWorldB = new THREE.Vector3();
const _invBatMat = new THREE.Matrix4();
const _ballLocalA = new THREE.Vector3();
const _ballLocalB = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _closestLocal = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _catchHandWorld = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class CricketSceneEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;
  private stadium: StadiumBuildResult;
  private field: PitchAndActorsResult;
  private xbotRoster: XbotRosterResult | null = null;
  private fireworks: VictoryFireworks;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private contextLost = false;

  // Match State (Starts directly on Coin Toss before players enter the field)
  private phase: MatchPhase = 'toss';
  private walkinProgress = 0;
  private playerProfile: PlayerCustomization = {
    playerName: 'STRIKER',
    jerseyNumber: '56',
    kitId: 'green-gold',
  };
  private oversCount: MatchOvers = 1;
  private inningsNumber: 1 | 2 = 1;
  private firstInningsRole: InningsRole = 'batting';
  private inningsRole: InningsRole = 'batting';
  private firstInningsSummary: InningsSummary | null = null;
  private target: number | null = null;
  private inningsEndPending = false;
  private bowlingEnd: BowlingEnd = 'pavilion';
  private bowlingSide: BowlingSide = 'over';
  private bowlerArchetype: BowlerArchetype = 'fast';
  private bowlingDeliveryType: BowlingDeliveryType = 'Outswinger';
  private bowlingAim = { x: 0.12, z: 4.35 };
  private releaseMeter = 0.5;
  private lockedReleaseQuality = 1.0;
  private aiBatterPlan: AiBatterPlan | null = null;
  private runs = 0;
  private wickets = 0;
  private sixesHit = 0;
  private ballsBowled = 0;
  private selectedDirection: ShotDirection = 'straight';
  private cameraMode: CameraMode = 'batter';
  private history: BallOutcomeRecord[] = [];
  private lastOutcome: BallOutcomeRecord | null = null;
  private matchResult: MatchResult = null;

  // DRS Review State
  private drsReviewsLeft = 1;
  private drsCountdown = 0;
  private drsData: DrsVerdictData | null = null;
  private pendingDrsMeta: {
    dismissalType: DrsDismissalType;
    releasePos: THREE.Vector3;
    bouncePos: THREE.Vector3;
    impactPos: THREE.Vector3;
    projectedStumpsPos: THREE.Vector3;
    hittingStumps: boolean;
    overturned: boolean;
    detailText: string;
  } | null = null;

  // Delivery & Animation Timers
  private phaseTimer = 0;
  private runupProgress = 0;
  private deliveryElapsed = 0;
  private currentPreset: DeliveryPreset = DEFAULT_PRESET;
  private isPlanningStrategy = false;
  private strategyEpoch = 0;
  private ballPos = new THREE.Vector3(0.28, 2.05, -9.15);
  private ballVel = new THREE.Vector3();
  private ballSpin = new THREE.Vector3(18, 0, 4);
  private releaseOriginPos = new THREE.Vector3(0.28, 2.05, -9.15);
  private actualBouncePos = new THREE.Vector3(0, GROUND_CONTACT_Y, 3.9);
  private hasBounced = false;
  private hasBouncedAfterBat = false;
  private ballCrossedBoundary = false;

  // Pitch Raycaster & Keyboard Input for Bowling Aim
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private isDraggingPitchAim = false;
  private lastHoverRaycastTime = 0;
  private aimInput = { left: false, right: false, up: false, down: false };

  // Swing & Contact Tracking
  private swingActive = false;
  private swingTimer = 0;
  private swingDirection: ShotDirection = 'straight';
  private aiBatterSwungThisBall = false;
  private contactResolved = false;

  // Flying Stumps & Bails Physics
  private stumpsBroken = false;
  private bailVel = [new THREE.Vector3(), new THREE.Vector3()];
  private bailAngVel = [new THREE.Vector3(), new THREE.Vector3()];
  private stumpTargetTilt = [0, 0, 0];
  private stumpTargetRoll = [0, 0, 0];

  // Dynamic Fielding AI & Catching State
  private activeChaserIdx = -1;
  private pendingCatchAttempt = false;
  private pendingCatchTiming: TimingVerdict = 'EARLY';
  private pendingCatchIsEdge = false;
  private caughtWicketFielderIdx = -1;
  private celebrationBallStartY = 1.85;
  private ballHeldByFielder = false;
  private throwInFlight = false;
  private throwCompleted = false;
  private throwCompleteTimer = 0;

  // Crowd Celebration Wave
  private crowdExcitement = 0;
  private crowdWaveTime = 0;

  // ResizeObserver
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Modern PBR Renderer with Software-WebGL Guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 2. Scene, Night Sky Fog, and Studio Environment Reflections
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b16);
    this.scene.fog = new THREE.FogExp2(0x060b16, 0.0042);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // 3. Camera (Initial Stadium Overview for Coin Toss before players enter)
    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 320);
    this.camera.position.set(0.0, 8.2, 24.0);
    _camLookCurrent.set(0.0, 1.1, -2.0);
    this.camera.lookAt(_camLookCurrent);

    // 4. Warm/Cool Stadium Floodlight Lighting Rig (<= 2 shadow casters)
    this.setupLighting();

    // 5. Build Stadium & Pitch + Actors
    const maxAniso = Math.min(
      this.renderer.capabilities.getMaxAnisotropy(),
      8,
    );
    this.stadium = buildCricketStadium(maxAniso, this.isSoftwareGl);
    this.scene.add(this.stadium.group);

    this.field = buildPitchAndCharacters(maxAniso, this.isSoftwareGl);
    this.scene.add(this.field.group);

    this.fireworks = new VictoryFireworks(() => {
      soundEngine.playFireworkBurst();
    });
    this.scene.add(this.fireworks.mesh);

    // Swap in official GLTFLoader + SkeletonUtils Xbot athletes once loaded
    this.field.xbotPromise
      .then((roster) => {
        if (this.disposed) {
          roster.dispose();
          return;
        }
        this.xbotRoster = roster;
        this.field.group.add(roster.group);
        roster.applyBatterCustomization(this.playerProfile);
        this.field.disposeFallbackActors();
        this.resetIdleStance();
      })
      .catch(() => {
        // Retain procedural fallback athletes silently if offline
      });

    // Pre-compile shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 6. WebGL Context Loss Safety & Interactive Pitch Raycasting
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.handleCanvasPointerDown,
    );
    this.renderer.domElement.addEventListener(
      'pointermove',
      this.handleCanvasPointerMove,
    );
    window.addEventListener('pointerup', this.handleCanvasPointerUp);

    // 7. Responsive Resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Prepare initial idle pose
    this.resetStumpsAndBails();
    this.resetIdleStance();
    this.emitHud();

    // Start Clock & Loop
    this.clock.start();
    this.tick();
  }

  private setupLighting(): void {
    // Cool night sky / lush turf bounce fill
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x143d22, 0.72);
    this.scene.add(hemi);

    // Primary Floodlight Key Light (Warm stadium halogen-LED tint)
    const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.45);
    keyLight.position.set(32, 46, 28);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 140;
    const d = 28;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.025;
    this.scene.add(keyLight);

    // Opposing Floodlight Fill/Rim (gives crisp stadium double-rim highlights on ball & helmet)
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.35);
    fillLight.position.set(-34, 42, -32);
    this.scene.add(fillLight);

    // Overhead pitch spotlight pool to make clay pitch & players pop brightly
    const pitchSpot = new THREE.SpotLight(0xfffbeb, 1.9, 110, Math.PI / 4, 0.45, 1.0);
    pitchSpot.position.set(-18, 38, 12);
    pitchSpot.target.position.set(0, 0, 2);
    this.scene.add(pitchSpot, pitchSpot.target);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
  };

  private handleResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // --- Public Imperative Controls ---

  private getTotalBalls(): number {
    return this.oversCount * 6;
  }

  private getMaxWickets(): number {
    return this.oversCount === 2 ? 3 : 2;
  }

  public setMatchOvers(overs: MatchOvers): void {
    this.oversCount = overs;
    this.emitHud();
  }

  public setPlayerCustomization(profile: PlayerCustomization): void {
    this.playerProfile = profile;
    if (this.xbotRoster) {
      this.xbotRoster.applyBatterCustomization(profile);
    } else {
      this.field.batter.applyCustomization(profile);
    }
    this.emitHud();
  }

  public startWalkIn(): void {
    soundEngine.unlock();
    this.walkinProgress = 0;
    this.phase = 'walkin';
    this.phaseTimer = 0;
    this.emitHud();
  }

  public skipWalkIn(): void {
    soundEngine.unlock();
    if (this.phase !== 'walkin') return;
    this.walkinProgress = 1;
    this.phase = 'endSelect';
    this.phaseTimer = 0;
    this.resetIdleStance();
    this.emitHud();
  }

  public completeToss(role: InningsRole): void {
    soundEngine.unlock();
    this.firstInningsRole = role;
    this.inningsNumber = 1;
    this.inningsRole = role;
    this.firstInningsSummary = null;
    this.target = null;
    this.inningsEndPending = false;
    this.runs = 0;
    this.wickets = 0;
    this.sixesHit = 0;
    this.ballsBowled = 0;
    this.drsReviewsLeft = 1;
    this.history = [];
    this.lastOutcome = null;
    this.matchResult = null;
    this.cameraMode = role === 'bowling' ? 'bowler' : 'batter';
    // Toss winner chose Bat/Bowl -> trigger 2-stage cinematic stadium walk-in
    this.walkinProgress = 0;
    this.phase = 'walkin';
    this.phaseTimer = 0;
    this.emitHud();
  }

  public configureOverSetup(
    end: BowlingEnd,
    side: BowlingSide,
    archetype: BowlerArchetype,
  ): void {
    this.bowlingEnd = end;
    this.bowlingSide = side;
    this.bowlerArchetype = archetype;
    this.field.group.rotation.y = end === 'cathedral' ? Math.PI : 0;
    this.field.group.updateMatrixWorld(true);
    this.emitHud();
  }

  public openTossScreen(): void {
    soundEngine.unlock();
    this.fireworks.stop();
    this.field.hideDrsBallTracking();
    this.field.group.rotation.y = 0;
    this.inningsNumber = 1;
    this.firstInningsSummary = null;
    this.target = null;
    this.inningsEndPending = false;
    this.runs = 0;
    this.wickets = 0;
    this.sixesHit = 0;
    this.ballsBowled = 0;
    this.history = [];
    this.lastOutcome = null;
    this.matchResult = null;
    this.phase = 'toss';
    this.phaseTimer = 0;
    this.resetStumpsAndBails();
    this.resetIdleStance();
    this.emitHud();
  }

  public startSuperOver(): void {
    soundEngine.unlock();
    this.inningsNumber = 1;
    this.inningsRole = this.firstInningsRole;
    this.firstInningsSummary = null;
    this.target = null;
    this.inningsEndPending = false;
    this.runs = 0;
    this.wickets = 0;
    this.sixesHit = 0;
    this.ballsBowled = 0;
    this.drsReviewsLeft = 1;
    this.drsCountdown = 0;
    this.drsData = null;
    this.pendingDrsMeta = null;
    this.history = [];
    this.lastOutcome = null;
    this.matchResult = null;
    this.cameraMode = this.inningsRole === 'bowling' ? 'bowler' : 'batter';
    this.strategyEpoch += 1;
    this.fireworks.stop();
    this.field.hideDrsBallTracking();
    this.field.group.rotation.y = this.bowlingEnd === 'cathedral' ? Math.PI : 0;
    this.field.group.updateMatrixWorld(true);
    this.prepareNextDelivery();
  }

  public startSecondInnings(): void {
    soundEngine.unlock();
    this.inningsNumber = 2;
    this.inningsRole = this.firstInningsRole === 'batting' ? 'bowling' : 'batting';
    this.inningsEndPending = false;
    this.runs = 0;
    this.wickets = 0;
    this.sixesHit = 0;
    this.ballsBowled = 0;
    this.drsReviewsLeft = 1;
    this.drsCountdown = 0;
    this.drsData = null;
    this.pendingDrsMeta = null;
    this.history = [];
    this.lastOutcome = null;
    this.matchResult = null;
    this.cameraMode = this.inningsRole === 'bowling' ? 'bowler' : 'batter';
    this.strategyEpoch += 1;
    this.fireworks.stop();
    this.field.hideDrsBallTracking();
    this.field.group.rotation.y = this.bowlingEnd === 'cathedral' ? Math.PI : 0;
    this.field.group.updateMatrixWorld(true);
    this.prepareNextDelivery();
  }

  public setBowlingDeliveryType(deliveryType: BowlingDeliveryType): void {
    this.bowlingDeliveryType = deliveryType;
    if (deliveryType === 'Fast Yorker') {
      this.bowlingAim = { x: 0.02, z: 7.42 };
    } else if (deliveryType === 'Outswinger') {
      this.bowlingAim = { x: 0.14, z: 4.35 };
    } else if (deliveryType === 'Bouncer') {
      this.bowlingAim = { x: -0.04, z: -0.35 };
    } else {
      this.bowlingAim = { x: 0.24, z: 3.45 };
    }
    this.syncBowlingPresetFromAim();
    this.emitHud();
  }

  public applyBatterStrategy(plan: AiBatterPlan, epoch: number): void {
    if (this.disposed || epoch !== this.strategyEpoch) return;
    this.aiBatterPlan = plan;
  }

  public triggerDrsReview(): void {
    if (
      this.phase !== 'drsPrompt' ||
      !this.pendingDrsMeta ||
      this.drsReviewsLeft <= 0
    ) {
      return;
    }
    soundEngine.unlock();
    this.drsReviewsLeft -= 1;
    this.phase = 'drsReview';
    this.phaseTimer = 0;
    this.field.showDrsBallTracking({
      releasePos: this.pendingDrsMeta.releasePos,
      bouncePos: this.pendingDrsMeta.bouncePos,
      impactPos: this.pendingDrsMeta.impactPos,
      projectedStumpsPos: this.pendingDrsMeta.projectedStumpsPos,
      hittingStumps: this.pendingDrsMeta.hittingStumps,
    });
    soundEngine.playPitchBounce();
    this.emitHud();
  }

  public acceptDrsDismissal(): void {
    if (this.phase !== 'drsPrompt') return;
    this.finalizeDrsOutcome(false);
  }

  public finishDrsReviewNow(): void {
    if (this.phase !== 'drsReview' || !this.pendingDrsMeta) return;
    this.finalizeDrsOutcome(this.pendingDrsMeta.overturned);
  }

  private finalizeDrsOutcome(overturned: boolean): void {
    const meta = this.pendingDrsMeta;
    this.pendingDrsMeta = null;
    this.field.hideDrsBallTracking();

    if (overturned) {
      soundEngine.playCrowdCheer(0.75);
      this.phase = 'ballInPlay';
      this.phaseTimer = 0.65;
      this.recordOutcome({
        code: '0',
        runs: 0,
        isWicket: false,
        timing: 'MISSED',
        direction: this.selectedDirection,
        headline: 'NOT OUT — OVERTURNED!',
        detail:
          meta?.dismissalType === 'edge'
            ? 'UltraEdge confirms no bat — umpire reverses call!'
            : 'Ball Tracking saves the batter — decision overturned!',
      });
    } else {
      soundEngine.playBowledWicket();
      this.phase = 'ballInPlay';
      this.phaseTimer = 0.75;
      this.recordOutcome({
        code: 'W',
        runs: 0,
        isWicket: true,
        timing: 'MISSED',
        direction: this.selectedDirection,
        headline:
          meta?.dismissalType === 'edge' ? 'OUT — CAUGHT BEHIND!' : 'OUT — LBW!',
        detail: meta?.detailText || 'Three reds on Hawk-Eye — batter has to go!',
      });
    }
  }

  private handleCanvasPointerDown = (e: PointerEvent): void => {
    if (this.inningsRole !== 'bowling' || this.phase !== 'ready') return;
    this.isDraggingPitchAim = this.updatePitchAimFromPointer(e);
  };

  private handleCanvasPointerMove = (e: PointerEvent): void => {
    if (this.inningsRole !== 'bowling' || this.phase !== 'ready') {
      this.isDraggingPitchAim = false;
      return;
    }
    const now = performance.now();
    if (!this.isDraggingPitchAim && now - this.lastHoverRaycastTime < 18) {
      return;
    }
    this.lastHoverRaycastTime = now;
    this.updatePitchAimFromPointer(e);
  };

  private handleCanvasPointerUp = (): void => {
    this.isDraggingPitchAim = false;
  };

  public setBowlingAimInput(input: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  }): void {
    this.aimInput.left = input.left;
    this.aimInput.right = input.right;
    this.aimInput.up = input.up;
    this.aimInput.down = input.down;
  }

  private updatePitchAimFromPointer(e: PointerEvent): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.field.pitchMesh, false);
    if (hits.length === 0) return false;

    _vec3A.copy(hits[0].point);
    this.field.group.worldToLocal(_vec3A);
    this.bowlingAim.x = Number(THREE.MathUtils.clamp(_vec3A.x, -0.56, 0.56).toFixed(3));
    this.bowlingAim.z = Number(THREE.MathUtils.clamp(_vec3A.z, -1.8, 8.2).toFixed(3));
    this.syncBowlingPresetFromAim();
    this.emitHud();
    return true;
  }

  private syncBowlingPresetFromAim(): void {
    const speedMap: Record<BowlingDeliveryType, number> = {
      'Fast Yorker': 145,
      Outswinger: 139,
      Bouncer: 147,
      'Slower Cutter': 114,
    };
    this.currentPreset = buildPhysicsFromPlan(
      {
        deliveryName: this.bowlingDeliveryType,
        speed: speedMap[this.bowlingDeliveryType],
        bounceX: this.bowlingAim.x,
        bounceZ: this.bowlingAim.z,
      },
      this.bowlerArchetype,
    );
    this.field.setPitchMarker(
      this.currentPreset.bounceX,
      this.currentPreset.bounceZ,
      0.85,
      true,
      1,
    );
  }

  public applyBowlerStrategy(plan: AiDeliveryPlan, epoch: number): void {
    if (this.disposed || epoch !== this.strategyEpoch) return;
    this.currentPreset = buildPhysicsFromPlan(plan, this.bowlerArchetype);
    this.isPlanningStrategy = false;

    // Update 3D pitch bounce marker to exact Gemini coordinates
    this.field.setPitchMarker(
      this.currentPreset.bounceX,
      this.currentPreset.bounceZ,
      0.56,
      false,
      1,
    );
    this.emitHud();
  }

  public getStrategyEpoch(): number {
    return this.strategyEpoch;
  }

  public setDirection(dir: ShotDirection): void {
    this.selectedDirection = dir;
    if (this.inningsRole === 'bowling' && this.phase === 'ready') {
      this.bowlingAim.x = dir === 'leg' ? -0.16 : dir === 'off' ? 0.24 : 0.02;
      this.syncBowlingPresetFromAim();
    }
    this.emitHud();
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.emitHud();
  }

  public triggerSwing(): void {
    soundEngine.unlock();
    if (this.phase === 'walkin') {
      this.skipWalkIn();
      return;
    }
    if (this.phase === 'intro') {
      this.startSuperOver();
      return;
    }
    if (this.phase === 'ready') {
      if (this.inningsRole === 'bowling') {
        this.launchPlayerBowlingDelivery();
      } else if (!this.isPlanningStrategy) {
        this.beginRunup();
      }
      return;
    }
    if (this.phase !== 'delivery' || this.swingActive) {
      return;
    }

    // In bowling mode, human does not manually swing batter
    if (this.inningsRole === 'bowling') {
      return;
    }

    this.executeSwing(this.selectedDirection);
  }

  private launchPlayerBowlingDelivery(): void {
    const sweetSpot = 1 - Math.min(1, Math.abs(this.releaseMeter - 0.5) * 2);
    this.lockedReleaseQuality = sweetSpot;

    // Lock in the exact player-selected pitch bounce coordinate (no random target drift)
    const baseSpeedMap: Record<BowlingDeliveryType, number> = {
      'Fast Yorker': 145,
      Outswinger: 139,
      Bouncer: 147,
      'Slower Cutter': 114,
    };
    const finalSpeed =
      baseSpeedMap[this.bowlingDeliveryType] + (sweetSpot >= 0.78 ? 5 : -5);

    this.currentPreset = buildPhysicsFromPlan(
      {
        deliveryName: this.bowlingDeliveryType,
        speed: finalSpeed,
        bounceX: THREE.MathUtils.clamp(this.bowlingAim.x, -0.56, 0.56),
        bounceZ: THREE.MathUtils.clamp(this.bowlingAim.z, -1.8, 8.2),
      },
      this.bowlerArchetype,
    );
    this.currentPreset.bounceX = THREE.MathUtils.clamp(this.bowlingAim.x, -0.56, 0.56);
    this.currentPreset.bounceZ = THREE.MathUtils.clamp(this.bowlingAim.z, -1.8, 8.2);
    if (sweetSpot >= 0.78) {
      this.currentPreset.swingAccelX *= 1.25;
      this.currentPreset.seamTurnX *= 1.25;
    }

    this.aiBatterPlan = null;
    this.callbacks.onRequestBatterStrategy({
      deliveryType: this.bowlingDeliveryType,
      speed: this.currentPreset.speedKph,
      bounceX: this.currentPreset.bounceX,
      bounceZ: this.currentPreset.bounceZ,
      runs: this.runs,
      wickets: this.wickets,
      target: this.target,
      inningsNumber: this.inningsNumber,
      ballsRemaining: this.getTotalBalls() - this.ballsBowled,
    });
    this.beginRunup();
  }

  private executeSwing(direction: ShotDirection): void {
    if (this.swingActive) return;
    this.swingActive = true;
    this.swingTimer = 0;
    this.swingDirection = direction;
    soundEngine.playBatSwing();
  }

  // --- Match & Delivery Sequencing ---

  private prepareNextDelivery(): void {
    this.phase = 'ready';
    this.phaseTimer = 0;
    this.runupProgress = 0;
    this.deliveryElapsed = 0;
    this.swingActive = false;
    this.swingTimer = 0;
    this.aiBatterSwungThisBall = false;
    this.contactResolved = false;
    this.hasBounced = false;
    this.hasBouncedAfterBat = false;
    this.field.ball.userData.hasBouncedAfterBat = false;
    this.ballCrossedBoundary = false;
    this.drsData = null;
    this.pendingDrsMeta = null;
    this.drsCountdown = 0;
    this.strategyEpoch += 1;
    this.activeChaserIdx = -1;
    this.pendingCatchAttempt = false;
    this.pendingCatchIsEdge = false;
    this.caughtWicketFielderIdx = -1;
    this.ballHeldByFielder = false;
    this.throwInFlight = false;
    this.throwCompleted = false;
    this.throwCompleteTimer = 0;
    this.field.hideDrsBallTracking();

    if (this.xbotRoster) {
      for (const f of this.xbotRoster.fielders) {
        f.state = 'idle';
        f.stateTimer = 0;
        f.hasBall = false;
        f.diveDirSign = 1;
        f.currentPos.copy(f.homePos);
        f.catchTargetPos.copy(f.homePos);
        f.root.position.copy(f.homePos);
        f.model.rotation.z = 0;
        f.facingYaw = Math.atan2(-f.homePos.x, 8.84 - f.homePos.z);
      }
    }

    this.resetStumpsAndBails();
    this.resetIdleStance();

    // Place ball in bowler's hand at top of run-up mark
    const activeBowler = this.xbotRoster ? this.xbotRoster.bowler : this.field.bowler;
    const startZ = this.bowlerArchetype === 'spin' ? -14.8 : -22.2;
    const startX = this.bowlingSide === 'around' ? -0.42 : 0.42;
    activeBowler.root.position.set(startX, 0.022, startZ);
    activeBowler.root.updateMatrixWorld(true);
    activeBowler.ballHandAnchor.getWorldPosition(this.ballPos);
    this.field.group.worldToLocal(this.ballPos);
    this.field.ball.position.copy(this.ballPos);
    this.field.ball.visible = true;
    this.field.trail.clear();
    this.field.setPitchMarker(0, 0, 0, false, 1);

    if (this.inningsRole === 'bowling') {
      this.isPlanningStrategy = false;
      this.syncBowlingPresetFromAim();
      this.emitHud();
      return;
    }

    this.isPlanningStrategy = true;
    this.emitHud();

    // Request Gemini AI Bowler Strategy based on match score & last 2 shots
    const lastTwo = this.history.slice(-2).map((item) => ({
      direction: item.direction,
      timing: item.timing,
      outcome: item.code,
    }));
    this.callbacks.onRequestStrategy({
      runs: this.runs,
      wickets: this.wickets,
      maxWickets: this.getMaxWickets(),
      target: this.target,
      inningsNumber: this.inningsNumber,
      ballsRemaining: this.getTotalBalls() - this.ballsBowled,
      lastShots: lastTwo,
    });
  }

  private beginRunup(): void {
    this.phase = 'runup';
    this.phaseTimer = 0;
    this.runupProgress = 0;
    this.emitHud();
  }

  private releaseBall(): void {
    this.phase = 'delivery';
    this.phaseTimer = 0;
    this.deliveryElapsed = 0;
    this.hasBounced = false;
    this.aiBatterSwungThisBall = false;

    const p = this.currentPreset;
    // Release cleanly from bowler's right hand overhead position (convert world -> field-local)
    const activeBowler = this.xbotRoster ? this.xbotRoster.bowler : this.field.bowler;
    this.field.group.updateMatrixWorld(true);
    activeBowler.root.updateMatrixWorld(true);
    activeBowler.ballHandAnchor.getWorldPosition(_vec3A);
    this.field.group.worldToLocal(_vec3A);

    const sideClampMin = this.bowlingSide === 'around' ? -0.45 : 0.08;
    const sideClampMax = this.bowlingSide === 'around' ? -0.08 : 0.45;
    const rx = THREE.MathUtils.clamp(_vec3A.x, sideClampMin, sideClampMax);
    const ry = THREE.MathUtils.clamp(_vec3A.y, 1.92, 2.24);
    const rz = THREE.MathUtils.clamp(_vec3A.z, -9.65, -8.95);

    this.ballPos.set(rx, ry, rz);
    this.releaseOriginPos.copy(this.ballPos);
    this.actualBouncePos.set(p.bounceX, 0.084, p.bounceZ);

    // Solve ballistic release velocity to land at (bounceX, 0.08, bounceZ)
    const distZ = p.bounceZ - rz;
    const tBounce = distZ / p.flightSpeed;
    const g = this.bowlerArchetype === 'spin' ? -11.2 : -9.81;

    // Account for air swing displacement 0.5 * a * t^2
    const vx = (p.bounceX - rx - 0.5 * p.swingAccelX * tBounce * tBounce) / tBounce;
    const vy = (0.08 - ry - 0.5 * g * tBounce * tBounce) / tBounce;
    const vz = p.flightSpeed;

    this.ballVel.set(vx, vy, vz);
    this.ballSpin.set(22, p.seamTurnX * 14, p.swingAccelX * 10);
    this.emitHud();
  }

  /**
   * Explicit 3D swept-OBB collision check against the willow bat blade collider
   * attached directly to the batter's RightHand bat mesh (never the player's hands).
   */
  private checkBatBladeCollision(): {
    outcome: BallOutcomeCode;
    timing: TimingVerdict;
    runs: number;
    isAerialCatchChance?: boolean;
    isEdgeFly?: boolean;
  } | null {
    const batCollider = this.xbotRoster
      ? this.xbotRoster.batter.batCollider
      : this.field.batter.batCollider;

    this.field.group.updateMatrixWorld(true);
    batCollider.updateWorldMatrix(true, false);

    // Convert previous and current ball positions from field-local space -> world -> batCollider local space
    _ballWorldA.copy(_prevBallPos).applyMatrix4(this.field.group.matrixWorld);
    _ballWorldB.copy(this.ballPos).applyMatrix4(this.field.group.matrixWorld);

    _invBatMat.copy(batCollider.matrixWorld).invert();
    _ballLocalA.copy(_ballWorldA).applyMatrix4(_invBatMat);
    _ballLocalB.copy(_ballWorldB).applyMatrix4(_invBatMat);

    // Closest point on ball travel segment [A -> B] to bat blade center (0, 0, 0)
    _segDir.subVectors(_ballLocalB, _ballLocalA);
    const lenSq = _segDir.lengthSq();
    const tSeg =
      lenSq > 1e-6
        ? THREE.MathUtils.clamp(-_ballLocalA.dot(_segDir) / lenSq, 0, 1)
        : 0;
    _closestLocal.copy(_ballLocalA).addScaledVector(_segDir, tSeg);

    // Expanded bounding box half-extents during active swing frames (covers willow blade only, NOT hands)
    const halfW = 0.28; // expanded blade width + ball radius
    const halfH = 0.44; // spans strictly along the willow blade length
    const halfD = 0.42; // generous swept thickness perpendicular to bat face

    const hitsBladeVolume =
      Math.abs(_closestLocal.x) <= halfW &&
      Math.abs(_closestLocal.y) <= halfH &&
      Math.abs(_closestLocal.z) <= halfD;

    // Secondary sweet-spot crease plane alignment check if player timed the swing right as ball crossed z = 8.4..9.15
    const inCreaseZone =
      _prevBallPos.z <= 9.25 &&
      this.ballPos.z >= 8.38 &&
      Math.abs(this.ballPos.x) <= 0.62 &&
      this.swingTimer >= 0.05 &&
      this.swingTimer <= 0.34;

    if (!hitsBladeVolume && !inCreaseZone) {
      return null;
    }

    // Grade timing from swing progression peak (sweet spot at ~0.145s into downswing)
    const swingDelta = this.swingTimer - 0.145;
    const absSwing = Math.abs(swingDelta);
    const bladeCenterPenalty = hitsBladeVolume
      ? Math.abs(_closestLocal.y) * 0.12
      : 0.04;
    const scoreMetric = absSwing + bladeCenterPenalty * 0.45;

    if (scoreMetric <= 0.072) {
      return { outcome: '6', timing: 'PERFECT', runs: 6 };
    }
    if (scoreMetric <= 0.134) {
      return { outcome: '4', timing: 'GOOD', runs: 4 };
    }
    if (scoreMetric <= 0.182) {
      const twoOrOne = scoreMetric <= 0.158 ? 2 : 1;
      return {
        outcome: twoOrOne === 2 ? '2' : '1',
        timing: swingDelta < 0 ? 'EARLY' : 'LATE',
        runs: twoOrOne,
      };
    }

    // Mistimed lofted / outside-edge contact: launches catchable ball in the air toward fielders
    const isTopOrOutsideEdge = Math.abs(_closestLocal.x) > 0.14 || scoreMetric >= 0.245;
    if (this.xbotRoster && scoreMetric <= 0.34) {
      return {
        outcome: '0',
        timing: swingDelta < 0 ? 'EARLY' : 'LATE',
        runs: 0,
        isAerialCatchChance: true,
        isEdgeFly: isTopOrOutsideEdge,
      };
    }

    return {
      outcome: '0',
      timing: swingDelta < 0 ? 'EARLY' : 'LATE',
      runs: 0,
    };
  }

  private resolveBatImpact(hit: {
    outcome: BallOutcomeCode;
    timing: TimingVerdict;
    runs: number;
    isAerialCatchChance?: boolean;
    isEdgeFly?: boolean;
  }): void {
    if (this.contactResolved) return;
    this.contactResolved = true;

    const { outcome, timing, runs, isAerialCatchChance, isEdgeFly } = hit;
    soundEngine.playBatHit(outcome);
    this.field.setPitchMarker(0, 0, 0, false, 1);

    // Track strict ground-bounce rule: ball has NOT bounced since leaving the bat
    this.hasBouncedAfterBat = false;
    this.field.ball.userData.hasBouncedAfterBat = false;

    // Ensure ball launches cleanly off the willow blade in front of crease (never from hands)
    this.ballPos.z = Math.min(this.ballPos.z, 8.68);
    this.ballPos.y = THREE.MathUtils.clamp(this.ballPos.y, 0.28, 1.28);

    // Aerial catch opportunity on mistimed lofted shots or flying edges
    if (isAerialCatchChance && this.xbotRoster && this.xbotRoster.fielders.length > 0) {
      const fielders = this.xbotRoster.fielders;
      // Pick candidate fielder indices by shot sector (indices match FIELDER_POSITIONS)
      const sectorIndices = isEdgeFly
        ? [0, 1] // First Slip, Backward Point
        : this.swingDirection === 'leg'
          ? [4, 5, 6] // Mid-On, Deep Mid-Wicket, Square Leg
          : this.swingDirection === 'off'
            ? [1, 2, 3] // Backward Point, Extra Cover, Mid-Off
            : [3, 4, 8]; // Mid-Off, Mid-On, Long-Off

      const chosenIdx = sectorIndices[Math.floor(Math.random() * sectorIndices.length)];
      const chosen = fielders[chosenIdx] ?? fielders[0];

      // Target landing point near the fielder's zone so they sprint ~3-8m to intercept
      const offsetAngle = Math.random() * Math.PI * 2;
      const offsetDist = isEdgeFly ? 1.2 + Math.random() * 1.4 : 2.8 + Math.random() * 3.8;
      const landX = THREE.MathUtils.clamp(
        chosen.homePos.x + Math.cos(offsetAngle) * offsetDist,
        -this.stadium.boundaryRx * 0.85,
        this.stadium.boundaryRx * 0.85,
      );
      const landZ = THREE.MathUtils.clamp(
        chosen.homePos.z + Math.sin(offsetAngle) * offsetDist,
        -this.stadium.boundaryRz * 0.85,
        20,
      );

      const distToTarget = Math.hypot(landX - this.ballPos.x, landZ - this.ballPos.z);
      const flightTime = isEdgeFly
        ? THREE.MathUtils.clamp(distToTarget / 14.5, 0.72, 1.15)
        : THREE.MathUtils.clamp(distToTarget / 17.5, 1.25, 2.05);
      const catchHeight = isEdgeFly ? 1.05 + Math.random() * 0.55 : 1.15 + Math.random() * 0.85;

      this.ballVel.set(
        (landX - this.ballPos.x) / flightTime,
        (catchHeight - this.ballPos.y + 0.5 * 9.81 * flightTime * flightTime) / flightTime,
        (landZ - this.ballPos.z) / flightTime,
      );
      this.field.trail.setActive(false);

      this.phase = 'ballInPlay';
      this.phaseTimer = 0;
      this.pendingCatchAttempt = true;
      this.pendingCatchTiming = timing;
      this.pendingCatchIsEdge = !!isEdgeFly;
      this.caughtWicketFielderIdx = -1;
      this.activeChaserIdx = chosenIdx;

      fielders.forEach((f, i) => {
        f.state = i === chosenIdx ? 'chase' : 'idle';
        f.stateTimer = 0;
        f.hasBall = false;
        if (i === chosenIdx) {
          f.catchTargetPos.set(landX, 0.022, landZ);
        }
      });

      this.emitHud();
      return;
    }

    // Standard ground/boundary shot resolution
    const baseAngle =
      this.swingDirection === 'leg'
        ? -Math.PI * 0.34 + (Math.random() - 0.5) * 0.14
        : this.swingDirection === 'off'
          ? Math.PI * 0.32 + (Math.random() - 0.5) * 0.14
          : (Math.random() - 0.5) * 0.14;

    const dirX = Math.sin(baseAngle);
    const dirZ = -Math.cos(baseAngle); // into the outfield (-Z)

    if (outcome === '6') {
      // Soaring lofted strike clear over boundary rope!
      const speed = 28.5 + Math.random() * 2.5;
      this.ballVel.set(dirX * speed, 16.5 + Math.random() * 2.0, dirZ * speed);
      this.field.trail.setActive(true);
      this.crowdExcitement = 1.0;
    } else if (outcome === '4') {
      // Crisp piercing ground/low-bounce boundary shot
      const speed = 25.5 + Math.random() * 2.5;
      this.ballVel.set(dirX * speed, 1.4 + Math.random() * 0.8, dirZ * speed);
      this.field.trail.setActive(true);
      this.crowdExcitement = 0.72;
    } else if (outcome === '2' || outcome === '1') {
      // Ground drive into outfield gap (bounces cleanly on grass before fielder pickup)
      const speed = outcome === '2' ? 15.5 : 10.5;
      this.ballVel.set(dirX * speed, outcome === '2' ? 1.05 : 0.75, dirZ * speed);
      this.field.trail.setActive(false);
    } else {
      // Soft defensive tap (dot ball onto pitch)
      this.ballVel.set(dirX * 5.2, 0.45, dirZ * 5.2);
      this.field.trail.setActive(false);
    }

    this.phase = 'ballInPlay';
    this.phaseTimer = 0;

    // Assign nearest fielder to sprint and intercept the ball's trajectory
    if (this.xbotRoster) {
      const predX = this.ballPos.x + this.ballVel.x * 1.1;
      const predZ = this.ballPos.z + this.ballVel.z * 1.1;
      let bestIdx = 0;
      let bestDistSq = Infinity;
      this.xbotRoster.fielders.forEach((f, i) => {
        const dx = f.currentPos.x - predX;
        const dz = f.currentPos.z - predZ;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      });
      this.activeChaserIdx = bestIdx;
      this.xbotRoster.fielders.forEach((f, i) => {
        f.state = i === bestIdx ? 'chase' : 'idle';
        f.stateTimer = 0;
        f.hasBall = false;
      });
    }

    const dirLabel =
      this.swingDirection === 'leg'
        ? 'Leg Side'
        : this.swingDirection === 'off'
          ? 'Off Side'
          : 'Straight';

    const headlineMap: Record<BallOutcomeCode, string> = {
      '6': 'MAXIMUM SIX!',
      '4': 'CRACKING FOUR!',
      '2': 'TWO RUNS',
      '1': 'QUICK SINGLE',
      '0': 'DOT BALL',
      W: 'BOWLED!',
    };

    const detailMap: Record<BallOutcomeCode, string> = {
      '6': `Pure willow strike over ${dirLabel} boundary`,
      '4': `Raced off the sweet spot to ${dirLabel} rope`,
      '2': `${timing === 'EARLY' ? 'Slightly early' : 'Slightly late'} push for a brace`,
      '1': `${timing === 'EARLY' ? 'Early' : 'Late'} tuck into ${dirLabel} gap`,
      '0': `Mistimed ${timing.toLowerCase()} defense`,
      W: 'Clean bowled!',
    };

    this.recordOutcome({
      code: outcome,
      runs,
      isWicket: false,
      timing,
      direction: this.swingDirection,
      headline: headlineMap[outcome],
      detail: detailMap[outcome],
    });
  }

  private triggerCloseAppealForDrs(dismissalType: DrsDismissalType): void {
    this.contactResolved = true;
    this.field.setPitchMarker(0, 0, 0, false, 1);

    // Forward-simulate un-deflected ball physics to striker stumps plane (z = 10.06)
    const simPos = this.ballPos.clone();
    const simVel = this.ballVel.clone();
    const g = this.bowlerArchetype === 'spin' ? -11.2 : -9.81;
    const stepDt = 0.004;
    for (let i = 0; i < 80 && simPos.z < 10.06; i++) {
      simVel.y += g * stepDt;
      simPos.addScaledVector(simVel, stepDt);
      if (simPos.y <= 0.084 && simVel.y < 0) {
        simPos.y = 0.084;
        simVel.y = -simVel.y * this.currentPreset.restitution;
      }
    }

    const pitchX = this.actualBouncePos.x;
    const pitchingLabel: DrsVerdictData['pitchingLabel'] =
      pitchX < -0.145
        ? 'OUTSIDE LEG'
        : pitchX > 0.145
          ? 'OUTSIDE OFF'
          : 'IN LINE';

    const impactX = this.ballPos.x;
    const impactLabel: DrsVerdictData['impactLabel'] =
      impactX < -0.145
        ? 'OUTSIDE LEG'
        : impactX > 0.185
          ? 'OUTSIDE OFF'
          : impactX > 0.145
            ? "UMPIRE'S CALL"
            : 'IN LINE';

    const absPredX = Math.abs(simPos.x);
    const hittingCore = absPredX <= 0.128 && simPos.y <= 0.73;
    const hittingEdge = absPredX <= 0.168 && simPos.y <= 0.79;
    const wicketsLabel: DrsVerdictData['wicketsLabel'] = hittingCore
      ? 'HITTING STUMPS'
      : hittingEdge
        ? "UMPIRE'S CALL"
        : 'MISSING STUMPS';

    const ultraEdgeSpike =
      dismissalType === 'edge' && Math.abs(this.swingTimer - 0.145) <= 0.23;

    const overturned =
      dismissalType === 'edge'
        ? !ultraEdgeSpike
        : pitchingLabel === 'OUTSIDE LEG' ||
          impactLabel === 'OUTSIDE OFF' ||
          impactLabel === 'OUTSIDE LEG' ||
          wicketsLabel === 'MISSING STUMPS';

    const detailText =
      dismissalType === 'edge'
        ? 'Thin nick carries straight through to the wicketkeeper!'
        : `${this.currentPreset.label} traps the batter right in front!`;

    this.drsData = {
      dismissalType,
      pitchingLabel,
      impactLabel,
      wicketsLabel,
      ultraEdgeSpike,
      overturned,
      finalDecision: overturned ? 'NOT OUT' : 'OUT',
      headline: overturned ? 'NOT OUT — OVERTURNED' : 'OUT',
    };

    this.pendingDrsMeta = {
      dismissalType,
      releasePos: this.releaseOriginPos.clone(),
      bouncePos: this.actualBouncePos.clone(),
      impactPos: this.ballPos.clone(),
      projectedStumpsPos: new THREE.Vector3(
        simPos.x,
        THREE.MathUtils.clamp(simPos.y, 0.08, 1.35),
        10.06,
      ),
      hittingStumps: hittingCore || hittingEdge,
      overturned,
      detailText,
    };

    if (this.drsReviewsLeft > 0) {
      this.ballVel.multiplyScalar(0.12);
      this.phase = 'drsPrompt';
      this.phaseTimer = 0;
      this.drsCountdown = 6.0;
      this.emitHud();
    } else {
      this.finalizeDrsOutcome(false);
    }
  }

  private resolveBowledOrKeeperDot(hitStumps: boolean): void {
    this.contactResolved = true;
    this.field.setPitchMarker(0, 0, 0, false, 1);
    this.phase = 'ballInPlay';
    this.phaseTimer = 0;

    if (hitStumps) {
      this.stumpsBroken = true;
      soundEngine.playBowledWicket();

      // Launch bails spinning into the air
      this.bailVel[0].set(-1.6 - Math.random(), 5.8 + Math.random(), 4.2 + Math.random());
      this.bailVel[1].set(1.8 + Math.random(), 6.3 + Math.random(), 4.8 + Math.random());
      this.bailAngVel[0].set(16, 12, 19);
      this.bailAngVel[1].set(-14, 15, -18);

      // Determine which stump(s) get knocked back
      const bx = this.ballPos.x;
      this.field.strikerStumps.stumps.forEach((_, idx) => {
        const sx = (idx - 1) * 0.115;
        if (Math.abs(bx - sx) < 0.14) {
          this.stumpTargetTilt[idx] = 0.65 + Math.random() * 0.35;
          this.stumpTargetRoll[idx] = (bx - sx) * -2.2 + (Math.random() - 0.5) * 0.4;
        }
      });

      // Deflect ball after hitting timber
      this.ballVel.set(
        (Math.random() - 0.5) * 3.5,
        2.2,
        4.8,
      );

      this.recordOutcome({
        code: 'W',
        runs: 0,
        isWicket: true,
        timing: 'MISSED',
        direction: this.selectedDirection,
        headline: 'CLEAN BOWLED!',
        detail: `${this.currentPreset.label} crashes into the stumps!`,
      });
    } else {
      // Keeper collects cleanly
      this.ballVel.multiplyScalar(0.15);
      this.recordOutcome({
        code: '0',
        runs: 0,
        isWicket: false,
        timing: 'MISSED',
        direction: this.selectedDirection,
        headline: 'DOT BALL',
        detail: 'Missed outside the stumps — taken by the keeper',
      });
    }
  }

  private recordOutcome(
    partial: Omit<
      BallOutcomeRecord,
      'ballNumber' | 'deliveryLabel' | 'deliverySpeedKph' | 'bounceX' | 'bounceZ'
    >,
  ): void {
    this.ballsBowled += 1;
    this.runs += partial.runs;
    if (partial.code === '6') {
      this.sixesHit += 1;
    }
    if (partial.isWicket) {
      this.wickets += 1;
    }

    const record: BallOutcomeRecord = {
      ...partial,
      ballNumber: this.ballsBowled,
      deliveryLabel: this.currentPreset.label,
      deliverySpeedKph: this.currentPreset.speedKph,
      bounceX: this.currentPreset.bounceX,
      bounceZ: this.currentPreset.bounceZ,
    };
    this.lastOutcome = record;
    this.history = [...this.history, record];

    const maxWickets = this.getMaxWickets();
    const totalBalls = this.getTotalBalls();

    if (this.inningsNumber === 1) {
      if (this.wickets >= maxWickets || this.ballsBowled >= totalBalls) {
        this.inningsEndPending = true;
        this.firstInningsSummary = {
          battingTeam: this.inningsRole === 'batting' ? 'user' : 'ai',
          runs: this.runs,
          wickets: this.wickets,
          ballsBowled: this.ballsBowled,
          sixesHit: this.sixesHit,
          history: [...this.history],
        };
        this.target = this.runs + 1;
      }
    } else {
      const chaseTarget = this.target ?? 16;
      if (this.runs >= chaseTarget) {
        this.matchResult = this.inningsRole === 'batting' ? 'won' : 'lost';
      } else if (this.wickets >= maxWickets || this.ballsBowled >= totalBalls) {
        if (this.runs === chaseTarget - 1) {
          this.matchResult = 'tied';
        } else {
          this.matchResult = this.inningsRole === 'bowling' ? 'won' : 'lost';
        }
      }

      if (this.matchResult === 'won') {
        soundEngine.playCrowdCheer(1.3);
        this.fireworks.start();
      }
    }

    this.emitHud();
    this.callbacks.onBallCompleted(record, {
      runs: this.runs,
      wickets: this.wickets,
      target: this.target,
      inningsNumber: this.inningsNumber,
      ballsRemaining: totalBalls - this.ballsBowled,
    });
  }

  private resetStumpsAndBails(): void {
    this.stumpsBroken = false;
    const rig = this.field.strikerStumps;
    rig.stumps.forEach((s, i) => {
      s.position.copy(rig.stumpBasePositions[i]);
      s.rotation.set(0, 0, 0);
      this.stumpTargetTilt[i] = 0;
      this.stumpTargetRoll[i] = 0;
    });
    rig.bails.forEach((b, i) => {
      b.position.copy(rig.bailBasePositions[i]);
      b.rotation.set(0, 0, 0);
      this.bailVel[i].set(0, 0, 0);
      this.bailAngVel[i].set(0, 0, 0);
    });
  }

  private resetIdleStance(): void {
    // Prime character rigs immediately into natural stance on first frame
    if (this.xbotRoster) {
      const xr = this.xbotRoster;
      const showOnField = this.phase !== 'toss' && this.phase !== 'customize';
      xr.batter.root.visible = showOnField;
      xr.nonStriker.root.visible = showOnField;
      xr.bowler.root.visible = showOnField;
      xr.keeper.root.visible = showOnField;
      for (const f of xr.fielders) {
        f.root.visible = showOnField;
      }
      this.field.ball.visible = showOnField;

      for (let i = 0; i < 8; i++) {
        updateXbotBatterPose(
          xr.batter,
          {
            phase: this.phase,
            selectedDirection: this.selectedDirection,
            swingActive: false,
            swingTimer: 0,
            swingDirection: this.selectedDirection,
            runupProgress: 0,
            walkinProgress: this.walkinProgress,
          },
          0.05,
          0,
        );
        updateXbotNonStrikerPose(
          xr.nonStriker,
          {
            phase: this.phase,
            walkinProgress: this.walkinProgress,
            runupProgress: 0,
          },
          0.05,
          0,
        );
        updateXbotBowlerPose(
          xr.bowler,
          {
            phase: this.phase,
            runupProgress: 0,
            deliveryElapsed: 0,
            walkinProgress: this.walkinProgress,
          },
          0.05,
          0,
        );
        updateXbotKeeperPose(
          xr.keeper,
          {
            phase: this.phase,
            ballPos: this.ballPos,
            stumpsBroken: false,
            lastOutcomeCode: null,
            lastTiming: null,
            walkinProgress: this.walkinProgress,
          },
          0.05,
          0,
        );
        for (const f of xr.fielders) {
          updateXbotFielderPose(f, this.ballPos, xr.keeper.root.position, 0.05, 0);
        }
      }
      return;
    }

    for (let i = 0; i < 6; i++) {
      updateBatterPose(
        this.field.batter,
        {
          phase: this.phase,
          selectedDirection: this.selectedDirection,
          swingActive: false,
          swingTimer: 0,
          swingDirection: this.selectedDirection,
          runupProgress: 0,
        },
        0.05,
        0,
      );
      updateBowlerPose(
        this.field.bowler,
        {
          phase: this.phase,
          runupProgress: 0,
          deliveryElapsed: 0,
        },
        0.05,
        0,
      );
      updateKeeperPose(
        this.field.keeper,
        {
          phase: this.phase,
          ballPos: this.ballPos,
          stumpsBroken: false,
          lastOutcomeCode: null,
          lastTiming: null,
        },
        0.05,
        0,
      );
    }
  }

  // --- Per-Frame Update Loop ---

  private tick = (): void => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);
    const elapsed = this.clock.elapsedTime;

    this.updateState(dt, elapsed);
    this.updateCamera(dt);

    if (!this.contextLost) {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateState(dt: number, elapsed: number): void {
    this.phaseTimer += dt;
    this.fireworks.update(dt);

    // Subtle crowd celebration wave
    if (this.crowdExcitement > 0.01) {
      this.crowdWaveTime += dt * 7.5;
      this.crowdExcitement = Math.max(0, this.crowdExcitement - dt * 0.35);
      const { crowdMesh, crowdBaseMatrices, crowdCount } = this.stadium;
      for (let i = 0; i < crowdCount; i++) {
        _mat4.fromArray(crowdBaseMatrices, i * 16);
        const hop =
          Math.max(0, Math.sin(this.crowdWaveTime + i * 0.45)) *
          0.35 *
          this.crowdExcitement;
        _mat4.elements[13] += hop;
        crowdMesh.setMatrixAt(i, _mat4);
      }
      crowdMesh.instanceMatrix.needsUpdate = true;
    }

    // Two-stage Walk-In Intro: Fielding team jogs onto ground (0..0.48) -> Two opening batters walk out (0.48..1.0)
    if (this.phase === 'walkin') {
      this.walkinProgress = Math.min(this.phaseTimer / 6.8, 1);
      if (this.walkinProgress >= 1) {
        this.phase = 'endSelect';
        this.phaseTimer = 0;
        this.resetIdleStance();
      }
      this.emitHud();
    }

    // Ready countdown before bowler starts run-up (or interactive aiming + Release Timing Bar in Bowling Mode)
    if (this.phase === 'intro' || this.phase === 'ready') {
      if (this.phase === 'ready' && this.inningsRole === 'bowling') {
        const moveHoriz = (this.aimInput.right ? 1 : 0) - (this.aimInput.left ? 1 : 0);
        const moveVert = (this.aimInput.up ? 1 : 0) - (this.aimInput.down ? 1 : 0);
        if (moveHoriz !== 0 || moveVert !== 0) {
          this.camera.getWorldDirection(_camFwd);
          _camFwd.y = 0;
          if (_camFwd.lengthSq() > 1e-4) _camFwd.normalize();
          else _camFwd.set(0, 0, 1);
          if (this.bowlingEnd === 'cathedral') {
            _camFwd.x = -_camFwd.x;
            _camFwd.z = -_camFwd.z;
          }
          _camRight.set(-_camFwd.z, 0, _camFwd.x);
          const speed = 3.6 * dt;
          this.bowlingAim.x = THREE.MathUtils.clamp(
            this.bowlingAim.x + (_camRight.x * moveHoriz + _camFwd.x * moveVert) * speed * 0.45,
            -0.56,
            0.56,
          );
          this.bowlingAim.z = THREE.MathUtils.clamp(
            this.bowlingAim.z + (_camRight.z * moveHoriz + _camFwd.z * moveVert) * speed,
            -1.8,
            8.2,
          );
          this.syncBowlingPresetFromAim();
        }

        this.releaseMeter = 0.5 + 0.5 * Math.sin(elapsed * 4.5);
        const pulse = 1 + 0.18 * Math.sin(elapsed * 6.0);
        this.field.setPitchMarker(
          this.bowlingAim.x,
          this.bowlingAim.z,
          0.92,
          true,
          pulse,
        );
        this.emitHud();
      } else if (
        this.phase === 'ready' &&
        !this.isPlanningStrategy &&
        this.phaseTimer >= 0.75 &&
        this.inningsRole === 'batting'
      ) {
        this.beginRunup();
      }
    }

    // DRS Prompt countdown (auto-accept OUT if player doesn't challenge)
    if (this.phase === 'drsPrompt') {
      this.drsCountdown = Math.max(0, 6.0 - this.phaseTimer);
      this.emitHud();
      if (this.drsCountdown <= 0) {
        this.finalizeDrsOutcome(false);
      }
    }

    // DRS 3D Ball-Tracking Reveal sequence
    if (this.phase === 'drsReview' && this.pendingDrsMeta) {
      if (this.phaseTimer >= 4.2) {
        this.finalizeDrsOutcome(this.pendingDrsMeta.overturned);
      } else {
        this.emitHud();
      }
    }

    // Bowler run-up progression
    if (this.phase === 'runup') {
      const duration = this.bowlerArchetype === 'spin' ? 1.15 : 1.45;
      this.runupProgress = Math.min(this.phaseTimer / duration, 1);
      if (this.inningsRole === 'bowling') {
        this.field.setPitchMarker(
          this.currentPreset.bounceX,
          this.currentPreset.bounceZ,
          0.95,
          true,
          1,
        );
        this.emitHud();
      }
    }

    if (this.phase === 'delivery' || this.phase === 'ballInPlay') {
      this.deliveryElapsed += dt;
    }

    if (this.swingActive) {
      this.swingTimer += dt;
      if (this.swingTimer >= 0.85 && this.phase === 'ballInPlay') {
        this.swingActive = false;
      }
    }

    // Drive smooth skeletal animations for Batter, Non-Striker, Bowler, Wicketkeeper, and 9 Fielders
    if (this.xbotRoster) {
      const xr = this.xbotRoster;
      const inToss = this.phase === 'toss';
      const inWalkin = this.phase === 'walkin';

      xr.batter.root.visible = !inToss && (!inWalkin || this.walkinProgress >= 0.44);
      xr.nonStriker.root.visible = !inToss && (!inWalkin || this.walkinProgress >= 0.44);
      xr.bowler.root.visible = !inToss && (!inWalkin || this.walkinProgress >= 0.02);
      xr.keeper.root.visible = !inToss;
      this.field.ball.visible = !inToss && !inWalkin;

      updateXbotBatterPose(
        xr.batter,
        {
          phase: this.phase,
          selectedDirection: this.selectedDirection,
          swingActive: this.swingActive,
          swingTimer: this.swingTimer,
          swingDirection: this.swingDirection,
          runupProgress: this.runupProgress,
          walkinProgress: this.walkinProgress,
          ballY: this.phase === 'delivery' ? this.ballPos.y : 0.65,
        },
        dt,
        elapsed,
      );

      updateXbotNonStrikerPose(
        xr.nonStriker,
        {
          phase: this.phase,
          walkinProgress: this.walkinProgress,
          runupProgress: this.runupProgress,
        },
        dt,
        elapsed,
      );

      updateXbotBowlerPose(
        xr.bowler,
        {
          phase: this.phase,
          runupProgress: this.runupProgress,
          deliveryElapsed: this.deliveryElapsed,
          walkinProgress: this.walkinProgress,
          archetype: this.bowlerArchetype,
          bowlingSide: this.bowlingSide,
        },
        dt,
        elapsed,
      );

      updateXbotKeeperPose(
        xr.keeper,
        {
          phase: this.phase,
          ballPos: this.ballPos,
          stumpsBroken: this.stumpsBroken,
          lastOutcomeCode: this.lastOutcome?.code ?? null,
          lastTiming: this.lastOutcome?.timing ?? null,
          walkinProgress: this.walkinProgress,
        },
        dt,
        elapsed,
      );

      // Update all 9 fielders (walk-in on toss/runup, chase -> catch/pickup -> throw on hit)
      this.updateFieldersAI(dt, elapsed);

      // Keep ball locked inside bowler's right fingers during customize, walkin, toss, ready & run-up
      if (
        this.phase === 'customize' ||
        this.phase === 'walkin' ||
        this.phase === 'toss' ||
        this.phase === 'endSelect' ||
        this.phase === 'inningsBreak' ||
        this.phase === 'intro' ||
        this.phase === 'ready' ||
        this.phase === 'runup'
      ) {
        this.field.group.updateMatrixWorld(true);
        xr.bowler.root.updateMatrixWorld(true);
        xr.bowler.ballHandAnchor.getWorldPosition(this.ballPos);
        this.field.group.worldToLocal(this.ballPos);
        this.field.ball.position.copy(this.ballPos);
      }
    } else {
      updateBatterPose(
        this.field.batter,
        {
          phase: this.phase,
          selectedDirection: this.selectedDirection,
          swingActive: this.swingActive,
          swingTimer: this.swingTimer,
          swingDirection: this.swingDirection,
          runupProgress: this.runupProgress,
          walkinProgress: this.walkinProgress,
        },
        dt,
        elapsed,
      );

      updateBowlerPose(
        this.field.bowler,
        {
          phase: this.phase,
          runupProgress: this.runupProgress,
          deliveryElapsed: this.deliveryElapsed,
          archetype: this.bowlerArchetype,
          bowlingSide: this.bowlingSide,
        },
        dt,
        elapsed,
      );

      updateKeeperPose(
        this.field.keeper,
        {
          phase: this.phase,
          ballPos: this.ballPos,
          stumpsBroken: this.stumpsBroken,
          lastOutcomeCode: this.lastOutcome?.code ?? null,
          lastTiming: this.lastOutcome?.timing ?? null,
        },
        dt,
        elapsed,
      );

      // Keep ball locked inside bowler's right fingers during customize, walkin, toss, ready & run-up
      if (
        this.phase === 'customize' ||
        this.phase === 'walkin' ||
        this.phase === 'toss' ||
        this.phase === 'endSelect' ||
        this.phase === 'intro' ||
        this.phase === 'ready' ||
        this.phase === 'runup'
      ) {
        this.field.group.updateMatrixWorld(true);
        this.field.bowler.root.updateMatrixWorld(true);
        this.field.bowler.ballHandAnchor.getWorldPosition(this.ballPos);
        this.field.group.worldToLocal(this.ballPos);
        this.field.ball.position.copy(this.ballPos);
      }
    }

    if (this.phase === 'runup' && this.runupProgress >= 1) {
      this.releaseBall();
    }

    // Ball in delivery flight toward batter
    if (this.phase === 'delivery') {
      const p = this.currentPreset;
      _prevBallPos.copy(this.ballPos);

      // Gravity & air swing before bounce
      const g = this.bowlerArchetype === 'spin' ? -11.2 : -9.81;
      this.ballVel.y += g * dt;
      if (!this.hasBounced) {
        this.ballVel.x += p.swingAccelX * dt;
      }
      this.ballPos.addScaledVector(this.ballVel, dt);

      // Pitch bounce check
      if (!this.hasBounced && this.ballPos.y <= 0.084 && this.ballVel.y < 0) {
        this.hasBounced = true;
        this.ballPos.y = 0.084;
        this.actualBouncePos.copy(this.ballPos);
        this.ballVel.y = -this.ballVel.y * p.restitution;
        this.ballVel.x += p.seamTurnX;
        soundEngine.playPitchBounce();
        if (this.inningsRole === 'bowling') {
          this.field.setPitchMarker(0, 0, 0, false, 1);
        }
      }

      // Spin ball mesh
      this.field.ball.rotation.x += this.ballSpin.x * dt;
      this.field.ball.rotation.z += this.ballSpin.z * dt;
      this.field.ball.position.copy(this.ballPos);

      // In Bowling mode, Gemini-controlled AI Batter reacts based on strategic plan
      const aiTriggerZ = this.aiBatterPlan
        ? THREE.MathUtils.clamp(
            6.5 + this.aiBatterPlan.timingOffsetSec * 18,
            5.2,
            8.25,
          )
        : 6.45;
      if (
        this.inningsRole === 'bowling' &&
        !this.aiBatterSwungThisBall &&
        this.ballPos.z >= aiTriggerZ
      ) {
        this.aiBatterSwungThisBall = true;
        const chosenDir: ShotDirection =
          this.aiBatterPlan?.shotDirection ??
          (p.bounceX > 0.12 ? 'off' : p.bounceX < -0.1 ? 'leg' : 'straight');
        const isLethal =
          p.bounceZ >= 6.8 ||
          Math.abs(p.seamTurnX) > 1.4 ||
          this.lockedReleaseQuality >= 0.85;
        const missThreshold =
          this.aiBatterPlan?.aggression === 'defend' ? 0.35 : 0.52;
        if (!isLethal || Math.random() > missThreshold) {
          this.executeSwing(chosenDir);
        }
      }

      // Explicit 3D Bat Blade OBB intersection check during active swing frames
      if (
        this.swingActive &&
        !this.contactResolved &&
        this.swingTimer >= 0.025 &&
        this.swingTimer <= 0.44
      ) {
        const hit = this.checkBatBladeCollision();
        if (hit) {
          this.resolveBatImpact(hit);
        }
      }

      // Close LBW Pad Appeal check (front pad box in front of stumps)
      if (
        !this.contactResolved &&
        _prevBallPos.z < 8.65 &&
        this.ballPos.z >= 8.65 &&
        this.ballPos.z <= 9.05 &&
        this.ballPos.y >= 0.08 &&
        this.ballPos.y <= 0.72 &&
        this.ballPos.x >= -0.26 &&
        this.ballPos.x <= 0.21
      ) {
        this.triggerCloseAppealForDrs('lbw');
      }

      // Close Thin-Edge Caught-Behind Appeal / Aerial Slip Edge check
      if (
        !this.contactResolved &&
        this.swingActive &&
        this.ballPos.z >= 8.7 &&
        this.ballPos.z <= 9.15 &&
        Math.abs(this.ballPos.x) >= 0.16 &&
        Math.abs(this.ballPos.x) <= 0.44 &&
        this.ballPos.y >= 0.22 &&
        this.ballPos.y <= 1.2 &&
        Math.abs(this.swingTimer - 0.145) >= 0.165 &&
        Math.abs(this.swingTimer - 0.145) <= 0.295
      ) {
        if (Math.abs(this.ballPos.x) >= 0.25 && this.xbotRoster) {
          this.resolveBatImpact({
            outcome: '0',
            timing: this.swingTimer < 0.145 ? 'EARLY' : 'LATE',
            runs: 0,
            isAerialCatchChance: true,
            isEdgeFly: true,
          });
        } else {
          this.triggerCloseAppealForDrs('edge');
        }
      }

      // If no contact and ball reaches striker's stumps (z >= 10.0)
      if (!this.contactResolved && this.ballPos.z >= 10.0) {
        const hitStumps =
          Math.abs(this.ballPos.x) <= 0.165 && this.ballPos.y <= 0.78;
        this.resolveBowledOrKeeperDot(hitStumps);
      }

      this.emitHud();
    }

    // Ball in play after hit or wicket
    if (this.phase === 'ballInPlay') {
      if (!this.ballHeldByFielder) {
        this.ballVel.y += -9.81 * dt;
        this.ballPos.addScaledVector(this.ballVel, dt);

        // Outfield/pitch ground bounce check: immediately flag hasBouncedAfterBat = true
        if (!this.throwInFlight && this.ballPos.y <= GROUND_CONTACT_Y) {
          this.ballPos.y = GROUND_CONTACT_Y;
          if (!this.hasBouncedAfterBat) {
            this.hasBouncedAfterBat = true;
            this.field.ball.userData.hasBouncedAfterBat = true;
          }
          if (Math.abs(this.ballVel.y) > 1.2) {
            this.ballVel.y = -this.ballVel.y * 0.48;
            soundEngine.playPitchBounce();
          } else {
            this.ballVel.y = 0;
          }
          // Turf drag
          const drag = Math.exp(-0.85 * dt);
          this.ballVel.x *= drag;
          this.ballVel.z *= drag;
        }
      }

      this.field.ball.position.copy(this.ballPos);
      this.field.ball.rotation.x += this.ballVel.z * 1.4 * dt;

      // Update glowing trail for 4s and 6s
      if (this.lastOutcome?.code === '6' || this.lastOutcome?.code === '4') {
        this.field.trail.pushPoint(this.ballPos);
        this.field.trail.updateVisuals(this.lastOutcome.code === '6');
      }

      // Check boundary crossing
      const normDist =
        (this.ballPos.x / this.stadium.boundaryRx) ** 2 +
        (this.ballPos.z / this.stadium.boundaryRz) ** 2;
      if (!this.ballCrossedBoundary && normDist >= 1.0) {
        this.ballCrossedBoundary = true;
      }

      // Animate flying bails & knocked stumps if bowled
      if (this.stumpsBroken) {
        const rig = this.field.strikerStumps;
        rig.stumps.forEach((s, i) => {
          s.rotation.x = THREE.MathUtils.damp(
            s.rotation.x,
            this.stumpTargetTilt[i],
            12,
            dt,
          );
          s.rotation.z = THREE.MathUtils.damp(
            s.rotation.z,
            this.stumpTargetRoll[i],
            12,
            dt,
          );
        });
        rig.bails.forEach((b, i) => {
          this.bailVel[i].y += -9.81 * dt;
          b.position.addScaledVector(this.bailVel[i], dt);
          b.rotation.x += this.bailAngVel[i].x * dt;
          b.rotation.y += this.bailAngVel[i].y * dt;
          b.rotation.z += this.bailAngVel[i].z * dt;
          if (b.position.y <= 0.02) {
            b.position.y = 0.02;
            this.bailVel[i].y = -this.bailVel[i].y * 0.35;
            this.bailVel[i].x *= 0.65;
            this.bailVel[i].z *= 0.65;
            this.bailAngVel[i].multiplyScalar(0.6);
          }
        });
      }

      // Strict Caught-Out Rule: if ball touched pitch/grass (hasBouncedAfterBat === true) before catch, NO wicket — award completed single only
      if (
        this.pendingCatchAttempt &&
        !this.ballHeldByFielder &&
        this.hasBouncedAfterBat
      ) {
        this.pendingCatchAttempt = false;
        this.recordOutcome({
          code: '1',
          runs: 1,
          isWicket: false,
          timing: this.pendingCatchTiming,
          direction: this.swingDirection,
          headline: 'BOUNCED SAFE — 1 RUN',
          detail: 'Touched the turf before pickup — 1 run completed',
        });
      }

      if (this.throwCompleted) {
        this.throwCompleteTimer += dt;
      }

      const isFieldedHit =
        this.xbotRoster !== null &&
        this.activeChaserIdx >= 0 &&
        this.caughtWicketFielderIdx < 0 &&
        (this.lastOutcome?.code === '1' ||
          this.lastOutcome?.code === '2' ||
          (this.lastOutcome?.code === '0' && this.lastOutcome.timing !== 'MISSED'));

      // Wait briefly for relay throw or celebratory catch sequence
      const readyToAdvance = this.pendingCatchAttempt
        ? this.phaseTimer >= 3.8
        : this.caughtWicketFielderIdx >= 0
          ? this.phaseTimer >= 2.55
          : isFieldedHit
            ? (this.throwCompleted && this.throwCompleteTimer >= 0.45) ||
              this.phaseTimer >= 3.1
            : this.phaseTimer >=
              (this.lastOutcome?.code === '6'
                ? 2.45
                : this.lastOutcome?.code === '4'
                  ? 2.15
                  : this.lastOutcome?.isWicket
                    ? 2.2
                    : 1.55);

      if (readyToAdvance) {
        if (this.inningsEndPending) {
          this.inningsEndPending = false;
          this.phase = 'inningsBreak';
          soundEngine.playCrowdCheer(0.65);
          this.emitHud();
        } else if (this.matchResult !== null) {
          this.phase = 'gameover';
          this.emitHud();
        } else {
          this.prepareNextDelivery();
        }
      }
    }

    // Ground contact shadow beneath ball
    this.field.ballShadow.position.set(this.ballPos.x, 0.032, this.ballPos.z);
    const heightScale = THREE.MathUtils.clamp(1 - this.ballPos.y * 0.08, 0.35, 1);
    this.field.ballShadow.scale.setScalar(heightScale);
    (this.field.ballShadow.material as THREE.MeshBasicMaterial).opacity =
      0.42 * heightScale;
  }

  private updateFieldersAI(dt: number, elapsed: number): void {
    const xr = this.xbotRoster;
    if (!xr) return;
    const keeperPos = xr.keeper.root.position;

    if (this.phase === 'toss') {
      for (const f of xr.fielders) {
        f.root.visible = false;
      }
      return;
    }

    if (this.phase === 'walkin') {
      const wp = this.walkinProgress;
      xr.fielders.forEach((f, idx) => {
        const delay = idx * 0.022;
        f.root.visible = wp >= delay;
        const jogT = THREE.MathUtils.clamp((wp - delay) / 0.4, 0, 1);
        const startX = 12.2 + (idx % 3) * 0.45;
        const startZ = 48.5 + Math.floor(idx / 3) * 0.45;
        f.currentPos.set(
          THREE.MathUtils.lerp(startX, f.homePos.x, jogT),
          0.022,
          THREE.MathUtils.lerp(startZ, f.homePos.z, jogT),
        );
        f.state = jogT < 1 ? 'walkin' : 'idle';
        if (jogT < 1) {
          f.facingYaw = Math.atan2(f.homePos.x - startX, f.homePos.z - startZ);
        } else {
          f.facingYaw = Math.atan2(-f.homePos.x, 8.84 - f.homePos.z);
        }
        updateXbotFielderPose(f, this.ballPos, keeperPos, dt, elapsed);
      });
      return;
    }

    for (const f of xr.fielders) {
      f.root.visible = true;
    }

    if (this.phase === 'runup') {
      const walkT = Math.min(1, this.runupProgress / 0.82);
      for (const f of xr.fielders) {
        f.state = walkT < 1 ? 'walkin' : 'idle';
        f.currentPos.lerpVectors(f.homePos, f.walkInPos, walkT);
        f.facingYaw = Math.atan2(-f.currentPos.x, 8.84 - f.currentPos.z);
      }
    } else if (this.phase === 'delivery') {
      for (const f of xr.fielders) {
        f.state = 'idle';
      }
    } else if (this.phase === 'ballInPlay' && this.activeChaserIdx >= 0) {
      const chaser = xr.fielders[this.activeChaserIdx];
      chaser.stateTimer += dt;

      if (chaser.state === 'chase') {
        let tx = this.pendingCatchAttempt ? chaser.catchTargetPos.x : this.ballPos.x;
        let tz = this.pendingCatchAttempt ? chaser.catchTargetPos.z : this.ballPos.z;
        const rx = this.stadium.boundaryRx * 0.94;
        const rz = this.stadium.boundaryRz * 0.94;
        const norm = Math.hypot(tx / rx, tz / rz);
        if (norm > 1) {
          tx /= norm;
          tz /= norm;
        }

        const dx = tx - chaser.currentPos.x;
        const dz = tz - chaser.currentPos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.25) {
          const sprintSpeed = this.pendingCatchAttempt ? 12.2 : 10.6;
          const step = Math.min(dist, sprintSpeed * dt);
          chaser.currentPos.x += (dx / dist) * step;
          chaser.currentPos.z += (dz / dist) * step;
          chaser.facingYaw = Math.atan2(dx, dz);
        } else if (this.pendingCatchAttempt) {
          // Face incoming ball cleanly while waiting beneath high catch
          chaser.facingYaw = Math.atan2(
            this.ballPos.x - chaser.currentPos.x,
            this.ballPos.z - chaser.currentPos.z,
          );
        }

        const distToBallXZ = Math.hypot(
          this.ballPos.x - chaser.currentPos.x,
          this.ballPos.z - chaser.currentPos.z,
        );

        // Strict Caught-Out Check: ONLY valid if ball has NOT bounced since leaving the bat
        if (
          this.pendingCatchAttempt &&
          !this.hasBouncedAfterBat &&
          !this.ballHeldByFielder &&
          this.ballVel.y < 1.2 &&
          this.ballPos.y > GROUND_CONTACT_Y &&
          this.ballPos.y <= 2.55 &&
          distToBallXZ <= 2.5
        ) {
          const isLowDive = this.ballPos.y < 1.48 && distToBallXZ >= 1.05;
          chaser.state = isLowDive ? 'catchDive' : 'catchOverhead';
          chaser.stateTimer = 0;

          // Compute sideways dive direction relative to fielder facing
          const rightX = Math.cos(chaser.facingYaw);
          const rightZ = -Math.sin(chaser.facingYaw);
          const lateralDot =
            (this.ballPos.x - chaser.currentPos.x) * rightX +
            (this.ballPos.z - chaser.currentPos.z) * rightZ;
          chaser.diveDirSign = lateralDot >= 0 ? -1 : 1;

          // Step fielder toward catch point if diving
          if (isLowDive && distToBallXZ > 0.2) {
            chaser.currentPos.x = THREE.MathUtils.lerp(
              chaser.currentPos.x,
              this.ballPos.x,
              0.55,
            );
            chaser.currentPos.z = THREE.MathUtils.lerp(
              chaser.currentPos.z,
              this.ballPos.z,
              0.55,
            );
          }

          this.pendingCatchAttempt = false;
          this.ballHeldByFielder = true;
          this.caughtWicketFielderIdx = this.activeChaserIdx;
          this.ballVel.set(0, 0, 0);
          this.phaseTimer = 0;
          this.crowdExcitement = 1.0;

          soundEngine.playCaughtWicket();
          this.recordOutcome({
            code: 'W',
            runs: 0,
            isWicket: true,
            timing: this.pendingCatchTiming,
            direction: this.swingDirection,
            headline: 'CAUGHT OUT!',
            detail: this.pendingCatchIsEdge
              ? `Edged on the full and snapped up by ${chaser.name}!`
              : `Caught cleanly before the bounce by ${chaser.name}!`,
          });
        } else if (!this.pendingCatchAttempt) {
          const isBoundaryShot =
            this.lastOutcome?.code === '4' || this.lastOutcome?.code === '6';
          if (isBoundaryShot) {
            if (this.ballCrossedBoundary || dist < 0.85) {
              chaser.state = 'idle';
            }
          } else if (
            this.hasBouncedAfterBat &&
            dist < 1.15 &&
            this.ballPos.y < 1.35
          ) {
            // Ball already touched the ground -> normal ground fielding pickup & throw back to keeper
            chaser.state = 'pickup';
            chaser.stateTimer = 0;
            this.ballHeldByFielder = true;
            this.ballVel.set(0, 0, 0);
          }
        }
      } else if (
        chaser.state === 'catchOverhead' ||
        chaser.state === 'catchDive'
      ) {
        // Snap ball cleanly into fielder's hands during catch animation
        this.field.group.updateMatrixWorld(true);
        chaser.root.updateMatrixWorld(true);
        chaser.catchHandAnchor.getWorldPosition(_catchHandWorld);
        this.field.group.worldToLocal(_catchHandWorld);
        this.ballPos.copy(_catchHandWorld);
        this.field.ball.position.copy(this.ballPos);

        if (chaser.stateTimer >= 0.42) {
          chaser.state = 'celebrate';
          chaser.stateTimer = 0;
          this.celebrationBallStartY = Math.max(1.55, this.ballPos.y);
        }
      } else if (chaser.state === 'celebrate') {
        this.field.group.updateMatrixWorld(true);
        chaser.root.updateMatrixWorld(true);
        chaser.catchHandAnchor.getWorldPosition(_catchHandWorld);
        this.field.group.worldToLocal(_catchHandWorld);

        const ct = chaser.stateTimer;
        if (ct < 0.28) {
          this.ballPos.copy(_catchHandWorld);
          this.celebrationBallStartY = _catchHandWorld.y;
        } else if (ct < 1.42) {
          // Celebratory toss straight into the air above the fielder
          const airT = ct - 0.28;
          const tossY =
            this.celebrationBallStartY + 5.2 * airT - 0.5 * 9.81 * airT * airT;
          if (tossY >= _catchHandWorld.y) {
            this.ballPos.set(_catchHandWorld.x, tossY, _catchHandWorld.z);
          } else {
            this.ballPos.copy(_catchHandWorld);
          }
        } else {
          this.ballPos.copy(_catchHandWorld);
        }
        this.field.ball.position.copy(this.ballPos);
      } else if (chaser.state === 'pickup') {
        this.ballPos.set(chaser.currentPos.x, 0.34, chaser.currentPos.z);
        if (chaser.stateTimer >= 0.24) {
          chaser.state = 'throw';
          chaser.stateTimer = 0;
        }
      } else if (chaser.state === 'throw') {
        if (this.ballHeldByFielder) {
          this.ballPos.set(chaser.currentPos.x, 1.48, chaser.currentPos.z);
          if (chaser.stateTimer >= 0.16) {
            // Release parabolic relay throw directly to wicketkeeper's gloves
            this.ballHeldByFielder = false;
            this.throwInFlight = true;
            const targetX = keeperPos.x;
            const targetY = 1.05;
            const targetZ = keeperPos.z - 0.35;
            const dx = targetX - this.ballPos.x;
            const dz = targetZ - this.ballPos.z;
            const dist = Math.hypot(dx, dz);
            const tFlight = THREE.MathUtils.clamp(dist / 26.5, 0.4, 0.92);
            this.ballVel.set(
              dx / tFlight,
              (targetY - this.ballPos.y + 0.5 * 9.81 * tFlight * tFlight) / tFlight,
              dz / tFlight,
            );
          }
        }
        if (chaser.stateTimer >= 0.42) {
          chaser.state = 'idle';
        }
      }

      if (this.throwInFlight) {
        const targetZ = keeperPos.z - 0.35;
        const distToKeeper = Math.hypot(
          this.ballPos.x - keeperPos.x,
          this.ballPos.z - targetZ,
        );
        if (
          distToKeeper < 0.95 ||
          (this.ballVel.z > 0 && this.ballPos.z >= targetZ)
        ) {
          this.throwInFlight = false;
          this.throwCompleted = true;
          this.throwCompleteTimer = 0;
          this.ballVel.set(0, 0, 0);
          this.ballPos.set(keeperPos.x, 1.02, targetZ);
        }
      }
    }

    for (const f of xr.fielders) {
      updateXbotFielderPose(f, this.ballPos, keeperPos, dt, elapsed);
    }
  }

  private updateCamera(dt: number): void {
    const isBoundaryFlight =
      this.phase === 'ballInPlay' &&
      (this.lastOutcome?.code === '6' || this.lastOutcome?.code === '4');

    if (this.phase === 'customize') {
      // Showcase back nameplate, jersey number, and kit at Players' Tunnel entrance
      _camPosTarget.set(13.15, 1.88, 50.6);
      _camLookTarget.set(11.2, 1.32, 46.5);
    } else if (this.phase === 'walkin') {
      if (this.walkinProgress < 0.48) {
        // Stage 1: Wide angle watching fielding team jog out from the tunnel onto the oval
        _camPosTarget.set(-9.5, 5.4, 24.5);
        _camLookTarget.set(4.5, 1.25, 14.0);
      } else {
        // Stage 2: Shoulder tracking camera following the two opening batters out to the pitch
        const batterRoot = this.xbotRoster
          ? this.xbotRoster.batter.root
          : this.field.batter.root;
        const bx = batterRoot.position.x;
        const bz = batterRoot.position.z;
        _camPosTarget.set(bx + 1.65, 1.95, bz + 3.65);
        _camLookTarget.set(bx * 0.25, 1.45, bz - 18.0);
      }
    } else if (this.phase === 'drsReview') {
      // Dramatic Hawk-Eye Ball-Tracking side-behind-stumps sweep
      _camPosTarget.set(-1.75, 1.72, 13.8);
      _camLookTarget.set(0.0, 0.48, 7.6);
    } else if (this.phase === 'drsPrompt') {
      // Tense close-up on batter pad / keeper appeal
      _camPosTarget.set(1.25, 1.35, 12.1);
      _camLookTarget.set(-0.08, 0.65, 9.4);
    } else if (
      this.phase === 'toss' ||
      this.phase === 'endSelect' ||
      this.phase === 'inningsBreak'
    ) {
      // Dramatic floodlit stadium overview during Toss, Setup & Innings Break
      const t = this.phaseTimer * 0.18;
      _camPosTarget.set(Math.sin(t) * 14.0, 8.2, 24.0 + Math.cos(t) * 3.5);
      _camLookTarget.set(0, 1.1, -2.0);
    } else if (
      this.phase === 'ballInPlay' &&
      this.caughtWicketFielderIdx >= 0 &&
      this.xbotRoster
    ) {
      // Zoom camera cleanly onto the catching & celebrating fielder
      const catcher = this.xbotRoster.fielders[this.caughtWicketFielderIdx];
      const fx = catcher.currentPos.x;
      const fz = catcher.currentPos.z;
      const toCenterLen = Math.max(0.5, Math.hypot(fx, fz));
      const inX = -fx / toCenterLen;
      const inZ = -fz / toCenterLen;
      // Offset camera in front/side of fielder facing them clearly
      _camPosTarget.set(fx + inX * 4.6 - inZ * 1.6, 1.95, fz + inZ * 4.6 + inX * 1.6);
      _camLookTarget.set(fx, 1.38, fz);
    } else if (
      this.phase === 'ballInPlay' &&
      this.pendingCatchAttempt &&
      this.activeChaserIdx >= 0 &&
      this.xbotRoster
    ) {
      // Follow aerial mistimed shot & sprinting fielder toward catch zone
      const chaser = this.xbotRoster.fielders[this.activeChaserIdx];
      const midX = THREE.MathUtils.lerp(this.ballPos.x, chaser.currentPos.x, 0.35);
      const midZ = THREE.MathUtils.lerp(this.ballPos.z, chaser.currentPos.z, 0.35);
      _camPosTarget.set(
        midX * 0.45 + 3.2,
        Math.max(3.6, this.ballPos.y + 1.8),
        Math.min(22, midZ + 11.5),
      );
      _camLookTarget.set(midX, Math.max(0.95, this.ballPos.y * 0.72), midZ);
    } else if (isBoundaryFlight) {
      // Dynamic flight chase behind the ball across the 3D stadium
      const vx = this.ballVel.x;
      const vz = this.ballVel.z;
      const horizLen = Math.hypot(vx, vz);
      const dirX = horizLen > 0.5 ? vx / horizLen : 0;
      const dirZ = horizLen > 0.5 ? vz / horizLen : -1;
      const isSix = this.lastOutcome?.code === '6';

      const chaseDist = isSix ? 8.5 : 7.0;
      const rawX = this.ballPos.x - dirX * chaseDist;
      const rawZ = this.ballPos.z - dirZ * chaseDist;
      // Keep camera cleanly inside the stadium bowl
      const clampScale = Math.min(1, 52 / Math.max(1, Math.hypot(rawX, rawZ)));

      _camPosTarget.set(
        rawX * clampScale,
        Math.max(1.85, this.ballPos.y + (isSix ? 2.6 : 2.1)),
        rawZ * clampScale,
      );
      _camLookTarget.set(
        this.ballPos.x,
        Math.max(0.45, this.ballPos.y * 0.92),
        this.ballPos.z,
      );
    } else if (this.phase === 'gameover' && this.matchResult === 'won') {
      // Elevated stadium celebratory view framing victory fireworks over floodlights
      _camPosTarget.set(0.6, 2.3, 15.8);
      _camLookTarget.set(0, 14.0, -34.0);
    } else if (this.phase === 'ballInPlay' && this.stumpsBroken) {
      // Tight drama shot on shattered stumps
      _camPosTarget.set(0.95, 1.45, 12.2);
      _camLookTarget.set(0, 0.55, 10.06);
    } else if (this.cameraMode === 'bowler') {
      // Bowler View: behind bowler's run-up looking down the pitch toward batter
      const bowlerRoot = this.xbotRoster
        ? this.xbotRoster.bowler.root
        : this.field.bowler.root;
      const followZ =
        this.phase === 'runup'
          ? Math.min(-14.0, bowlerRoot.position.z - 4.2)
          : -24.5;
      _camPosTarget.set(0.68, 2.55, followZ);
      _camLookTarget.set(-0.08, 0.85, 8.8);
    } else if (this.cameraMode === 'side') {
      // Broadcast Side View: elevated square-leg television camera
      _camPosTarget.set(19.5, 5.2, 2.2);
      _camLookTarget.set(0, 0.85, 2.0);
    } else {
      // Batter View: classic behind-the-batter's-shoulder broadcast batting view
      _camPosTarget.set(0.58, 2.28, 15.85);
      _camLookTarget.set(-0.02, 0.92, -6.0);
    }

    // Mirror camera targets seamlessly to world space when playing from Cathedral End
    if (
      this.phase !== 'customize' &&
      this.phase !== 'walkin' &&
      this.bowlingEnd === 'cathedral'
    ) {
      _camPosTarget.x = -_camPosTarget.x;
      _camPosTarget.z = -_camPosTarget.z;
      _camLookTarget.x = -_camLookTarget.x;
      _camLookTarget.z = -_camLookTarget.z;
    }

    const dampLambda =
      this.phase === 'walkin' || this.phase === 'customize'
        ? 4.4
        : this.caughtWicketFielderIdx >= 0
          ? 6.4
          : isBoundaryFlight
            ? 5.2
            : this.phase === 'ballInPlay'
              ? 4.4
              : 6.0;
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _camPosTarget.x,
      dampLambda,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _camPosTarget.y,
      dampLambda,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camPosTarget.z,
      dampLambda,
      dt,
    );

    _camLookCurrent.x = THREE.MathUtils.damp(
      _camLookCurrent.x,
      _camLookTarget.x,
      dampLambda,
      dt,
    );
    _camLookCurrent.y = THREE.MathUtils.damp(
      _camLookCurrent.y,
      _camLookTarget.y,
      dampLambda,
      dt,
    );
    _camLookCurrent.z = THREE.MathUtils.damp(
      _camLookCurrent.z,
      _camLookTarget.z,
      dampLambda,
      dt,
    );

    this.camera.lookAt(_camLookCurrent);
  }

  private emitHud(): void {
    const timingProgress =
      this.phase === 'delivery'
        ? THREE.MathUtils.clamp((this.ballPos.z - -9.15) / (8.75 - -9.15), 0, 1.15)
        : 0;

    const showAimCursor =
      this.inningsRole === 'bowling' &&
      (this.phase === 'ready' || this.phase === 'runup');
    const aimX = this.phase === 'runup' ? this.currentPreset.bounceX : this.bowlingAim.x;
    const aimZ = this.phase === 'runup' ? this.currentPreset.bounceZ : this.bowlingAim.z;

    let screenX = 0;
    let screenY = 0;
    if (showAimCursor) {
      this.field.group.updateMatrixWorld(true);
      this.field.pitchMarker.updateWorldMatrix(true, false);
      this.field.pitchMarker.getWorldPosition(_projVec);
      _projVec.project(this.camera);
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      screenX = ((_projVec.x + 1) / 2) * w;
      screenY = (-(_projVec.y - 1) / 2) * h;
    }

    const lengthLabel =
      aimZ >= 6.8
        ? 'YORKER'
        : aimZ >= 4.8
          ? 'FULL'
          : aimZ >= 1.6
            ? 'GOOD LENGTH'
            : 'SHORT BOUNCER';
    const lineLabel =
      aimX > 0.14
        ? 'OUTSIDE OFF'
        : aimX < -0.11
          ? 'LEG SIDE'
          : 'MIDDLE STUMP';
    const distanceMeters = Math.max(0.2, Number((10.06 - aimZ).toFixed(1)));

    const maxWickets = this.getMaxWickets();
    const totalBalls = this.getTotalBalls();

    this.callbacks.onHudUpdate({
      phase: this.phase,
      walkinProgress: this.walkinProgress,
      playerProfile: this.playerProfile,
      oversCount: this.oversCount,
      inningsNumber: this.inningsNumber,
      inningsRole: this.inningsRole,
      firstInningsSummary: this.firstInningsSummary,
      bowlingEnd: this.bowlingEnd,
      bowlingSide: this.bowlingSide,
      bowlerArchetype: this.bowlerArchetype,
      bowlingDeliveryType: this.bowlingDeliveryType,
      releaseMeter: this.releaseMeter,
      aimCursor: {
        visible: showAimCursor && _projVec.z < 1,
        locked: this.phase === 'runup',
        screenX,
        screenY,
        lengthLabel,
        lineLabel,
        distanceMeters,
      },
      runs: this.runs,
      wickets: this.wickets,
      sixesHit: this.sixesHit,
      maxWickets,
      target: this.target,
      ballsBowled: this.ballsBowled,
      totalBalls,
      ballsLeft: totalBalls - this.ballsBowled,
      selectedDirection: this.selectedDirection,
      cameraMode: this.cameraMode,
      deliveryLabel: this.currentPreset.label,
      deliverySpeedKph: this.currentPreset.speedKph,
      bounceX: this.currentPreset.bounceX,
      bounceZ: this.currentPreset.bounceZ,
      isPlanningStrategy: this.isPlanningStrategy,
      timingProgress,
      canSwing:
        this.inningsRole === 'batting' &&
        this.phase === 'delivery' &&
        !this.swingActive,
      hasBouncedAfterBat: this.hasBouncedAfterBat,
      drsReviewsLeft: this.drsReviewsLeft,
      drsCountdown: this.drsCountdown,
      drsData: this.drsData,
      lastOutcome: this.lastOutcome,
      history: this.history,
      matchResult: this.matchResult,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLost,
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.handleCanvasPointerDown,
    );
    this.renderer.domElement.removeEventListener(
      'pointermove',
      this.handleCanvasPointerMove,
    );
    window.removeEventListener('pointerup', this.handleCanvasPointerUp);
    this.stadium.dispose();
    this.field.dispose();
    this.xbotRoster?.dispose();
    this.fireworks.dispose();
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
