import * as THREE from 'three';
import {
  BallOutcomeCode,
  BowlerArchetype,
  BowlingSide,
  MatchPhase,
  ShotDirection,
  TimingVerdict,
} from '../types/game';
import { XbotCharacterInstance, XbotFielderInstance } from './xbotLoader';

export interface XbotBatterAnimState {
  phase: MatchPhase;
  selectedDirection: ShotDirection;
  swingActive: boolean;
  swingTimer: number;
  swingDirection: ShotDirection;
  runupProgress: number;
  walkinProgress?: number;
  ballY?: number;
}

export interface XbotBowlerAnimState {
  phase: MatchPhase;
  runupProgress: number;
  deliveryElapsed: number;
  walkinProgress?: number;
  archetype?: BowlerArchetype;
  bowlingSide?: BowlingSide;
}

export interface XbotKeeperAnimState {
  phase: MatchPhase;
  ballPos: THREE.Vector3;
  stumpsBroken: boolean;
  lastOutcomeCode: BallOutcomeCode | null;
  lastTiming: TimingVerdict | null;
  walkinProgress?: number;
}

// Pre-allocated scratch Euler & Quaternion (zero GC in 60fps loop)
const _euler = new THREE.Euler(0, 0, 0, 'XYZ');
const _qTarget = new THREE.Quaternion();
const _vTmp = new THREE.Vector3();

function slerpBone(
  bone: THREE.Bone,
  rx: number,
  ry: number,
  rz: number,
  lambda: number,
  dt: number,
): void {
  _euler.set(rx, ry, rz, 'XYZ');
  _qTarget.setFromEuler(_euler);
  const alpha = 1 - Math.exp(-lambda * dt);
  bone.quaternion.slerp(_qTarget, alpha);
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

/**
 * Smooth skeletal Batter pose using quaternion slerp on Mixamo bones.
 */
export function updateXbotBatterPose(
  rig: XbotCharacterInstance,
  state: XbotBatterAnimState,
  dt: number,
  elapsed: number,
): void {
  const b = rig.bones;
  const lambda = state.swingActive ? 22 : 10;

  // Base side-on batting stance (Left side toward bowler -Z, chest toward Off Side +X)
  let modelYaw = Math.PI * 0.44;
  let modelOffsetZ = 0;
  let modelOffsetX = 0;
  let hipsY = 96; // slightly crouched athletic stance (104 = straight standing)

  let spineX = 0.16;
  let spine1X = 0.12;
  let spine2Y = -0.06;
  let headY = Math.PI * 0.42; // turned left toward bowler (-Z world)
  let headX = -0.08;

  // Legs
  let lUpLegX = -0.34;
  let lUpLegZ = 0.14;
  let lKneeX = 0.48;
  let lFootX = -0.14;

  let rUpLegX = -0.26;
  let rUpLegZ = -0.14;
  let rKneeX = 0.42;
  let rFootX = -0.16;

  // Arms holding bat in low blockhole stance
  let lArmX = -0.45;
  let lArmY = -0.56;
  let lArmZ = -1.1;
  let lForeY = -1.18;

  let rArmX = -0.35;
  let rArmY = 0.52;
  let rArmZ = 1.15;
  let rForeY = 1.24;
  let rHandZ = -0.22;

  const guardBias =
    state.selectedDirection === 'leg'
      ? -0.08
      : state.selectedDirection === 'off'
        ? 0.08
        : 0;

  const inCustomize = state.phase === 'customize';
  const inWalkin = state.phase === 'walkin';
  const inBacklift =
    (state.phase === 'runup' && state.runupProgress >= 0.42) ||
    (state.phase === 'delivery' && !state.swingActive);

  if (inCustomize) {
    // Stand proudly just outside Players' Tunnel facing the stadium so customized Name/Number/Kit shines
    const targetYaw = Math.atan2(-0.52 - 11.8, 8.84 - 48.0);
    rig.root.position.set(11.8, 0.022, 48.0);
    modelYaw = targetYaw;
    hipsY = 102 + Math.sin(elapsed * 2.2) * 0.9;
    spineX = 0.04;
    spine1X = 0.02;
    headY = Math.sin(elapsed * 0.9) * 0.16;
    headX = -0.05;

    lUpLegX = -0.06;
    lKneeX = 0.12;
    lFootX = -0.06;
    rUpLegX = 0.04;
    rKneeX = 0.12;
    rFootX = -0.06;

    lArmX = -0.14;
    lArmY = 0;
    lArmZ = -1.28;
    lForeY = -0.35;

    rArmX = 0.12;
    rArmY = 0.05;
    rArmZ = 1.24;
    rForeY = 0.32;
    rHandZ = -0.38;
  } else if (inWalkin) {
    const wp = THREE.MathUtils.clamp(state.walkinProgress ?? 0, 0, 1);
    // Stage 2 (0.48 -> 0.94): Two opening batters walk out together after fielding team takes positions
    const moveT = THREE.MathUtils.clamp((wp - 0.48) / 0.46, 0, 1);
    const wx = THREE.MathUtils.lerp(11.4, -0.52, moveT) - Math.sin(moveT * Math.PI) * 1.4;
    const wz = THREE.MathUtils.lerp(48.0, 8.84, moveT);
    rig.root.position.set(wx, 0.022, wz);

    if (moveT > 0 && moveT < 1) {
      const targetYaw = Math.atan2(-0.52 - 11.4, 8.84 - 48.0);
      const stride = elapsed * 5.8;
      const sSin = Math.sin(stride);
      const sCos = Math.cos(stride);

      modelYaw = targetYaw;
      hipsY = 101.5 + Math.abs(sSin) * 2.4;
      spineX = 0.05;
      spine1X = 0.03;
      spine2Y = sSin * 0.06;
      headY = Math.sin(elapsed * 1.3) * 0.24;
      headX = -0.06;

      lUpLegX = sSin * 0.44;
      lKneeX = Math.max(0.08, -sCos * 0.52 + 0.28);
      lFootX = -lKneeX * 0.25;
      rUpLegX = -sSin * 0.44;
      rKneeX = Math.max(0.08, sCos * 0.52 + 0.28);
      rFootX = -rKneeX * 0.25;

      // Left arm swings naturally; Right arm carries willow bat low beside leg
      lArmX = -sSin * 0.36;
      lArmY = 0;
      lArmZ = -1.28;
      lForeY = -0.35;

      rArmX = 0.14 + sSin * 0.14;
      rArmY = 0.05;
      rArmZ = 1.24;
      rForeY = 0.32;
      rHandZ = -0.38;
    } else if (moveT <= 0) {
      modelYaw = Math.atan2(-0.52 - 11.4, 8.84 - 48.0);
      hipsY = 102;
      spineX = 0.04;
      lArmZ = -1.28;
      lForeY = -0.35;
      rArmX = 0.12;
      rArmZ = 1.24;
      rForeY = 0.32;
      rHandZ = -0.38;
    } else {
      // Arrived at crease: settle smoothly into side-on guard
      rig.root.position.set(-0.52, 0.022, 8.84);
      modelYaw = Math.PI * 0.44;
    }
  } else {
    rig.root.position.set(-0.52, 0.022, 8.84);
  }

  const inEntrance = inCustomize || inWalkin;

  if (!inEntrance && state.swingActive) {
    const rawT = THREE.MathUtils.clamp(state.swingTimer / 0.42, 0, 1);
    const s =
      rawT < 0.42
        ? Math.pow(rawT / 0.42, 0.72)
        : 1 + 0.1 * Math.sin(((rawT - 0.42) / 0.58) * Math.PI * 0.5);
    const heightAdj = THREE.MathUtils.clamp(
      (0.65 - (state.ballY ?? 0.65)) * 0.48,
      -0.24,
      0.32,
    );

    if (state.swingDirection === 'off') {
      // Cover Drive: stride forward onto front pad, high front elbow follow-through
      modelYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.24, s);
      modelOffsetZ = THREE.MathUtils.lerp(0, -0.24, s);
      modelOffsetX = THREE.MathUtils.lerp(0, 0.12, s);
      hipsY = THREE.MathUtils.lerp(93, 88, s);

      spineX = THREE.MathUtils.lerp(0.18, 0.26, s);
      spine1X = THREE.MathUtils.lerp(0.14, 0.2, s);
      spine2Y = THREE.MathUtils.lerp(-0.18, 0.25, s);
      headY = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.22, s);
      headX = -0.14;

      lUpLegX = THREE.MathUtils.lerp(-0.36, -0.75, s);
      lKneeX = THREE.MathUtils.lerp(0.5, 0.85, s);
      lFootX = -0.1;
      rUpLegX = THREE.MathUtils.lerp(-0.24, 0.34, s);
      rKneeX = THREE.MathUtils.lerp(0.42, 0.25, s);
      rFootX = -0.45;

      rArmX = THREE.MathUtils.lerp(-0.95, -1.75 + heightAdj * 0.45, s);
      rArmY = THREE.MathUtils.lerp(0.25, 0.92, s);
      rArmZ = THREE.MathUtils.lerp(0.85, 0.42 + heightAdj * 0.2, s);
      rForeY = THREE.MathUtils.lerp(1.45, 0.35, s);
      rHandZ = THREE.MathUtils.lerp(-0.3, 0.35 + heightAdj * 0.35, s);

      lArmX = THREE.MathUtils.lerp(-0.95, -2.05 + heightAdj * 0.45, s);
      lArmY = THREE.MathUtils.lerp(-0.35, -0.65, s);
      lArmZ = THREE.MathUtils.lerp(-0.75, -0.45, s);
      lForeY = THREE.MathUtils.lerp(-1.3, -0.48, s);
    } else if (state.swingDirection === 'leg') {
      // Pull Shot: swivel hips toward leg side, horizontal bat whip across chest
      modelYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.86, s);
      modelOffsetZ = THREE.MathUtils.lerp(0, 0.1, s);
      hipsY = 93;

      spineX = THREE.MathUtils.lerp(0.16, 0.08 + heightAdj * 0.2, s);
      spine1X = 0.08;
      spine2Y = THREE.MathUtils.lerp(-0.2, 0.46, s);
      headY = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.65, s);

      lUpLegX = THREE.MathUtils.lerp(-0.32, -0.18, s);
      lKneeX = 0.28;
      rUpLegX = THREE.MathUtils.lerp(-0.28, -0.48, s);
      rKneeX = THREE.MathUtils.lerp(0.45, 0.65, s);

      rArmX = THREE.MathUtils.lerp(-0.95, -0.65 + heightAdj * 0.4, s);
      rArmY = THREE.MathUtils.lerp(0.2, 1.35, s);
      rArmZ = THREE.MathUtils.lerp(0.8, 0.35, s);
      rForeY = THREE.MathUtils.lerp(1.4, 0.85, s);
      rHandZ = THREE.MathUtils.lerp(-0.2, 0.65 + heightAdj * 0.3, s);

      lArmX = THREE.MathUtils.lerp(-0.95, -0.75 + heightAdj * 0.4, s);
      lArmY = THREE.MathUtils.lerp(-0.3, -1.15, s);
      lArmZ = THREE.MathUtils.lerp(-0.75, -0.35, s);
      lForeY = THREE.MathUtils.lerp(-1.3, -0.9, s);
    } else {
      // Lofted Straight Drive: clear front leg, full vertical follow-through
      modelYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.34, s);
      modelOffsetZ = THREE.MathUtils.lerp(0, -0.16, s);
      hipsY = 93;

      spineX = THREE.MathUtils.lerp(0.18, 0.14 + heightAdj * 0.25, s);
      spine1X = 0.1;
      spine2Y = THREE.MathUtils.lerp(-0.18, 0.18, s);
      headY = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.34, s);

      lUpLegX = THREE.MathUtils.lerp(-0.34, -0.62, s);
      lKneeX = 0.56;
      rUpLegX = THREE.MathUtils.lerp(-0.26, 0.2, s);
      rKneeX = 0.32;

      rArmX = THREE.MathUtils.lerp(-0.95, -2.35 + heightAdj * 0.5, s);
      rArmY = THREE.MathUtils.lerp(0.22, 0.42, s);
      rArmZ = THREE.MathUtils.lerp(0.82, 0.3, s);
      rForeY = THREE.MathUtils.lerp(1.42, 0.25, s);
      rHandZ = THREE.MathUtils.lerp(-0.25, 0.28 + heightAdj * 0.3, s);

      lArmX = THREE.MathUtils.lerp(-0.95, -2.4 + heightAdj * 0.5, s);
      lArmY = THREE.MathUtils.lerp(-0.3, -0.45, s);
      lArmZ = THREE.MathUtils.lerp(-0.75, -0.3, s);
      lForeY = THREE.MathUtils.lerp(-1.3, -0.3, s);
    }
  } else if (!inEntrance && inBacklift) {
    // Trigger & high backlift as bowler nears delivery stride
    const lift =
      state.phase === 'delivery'
        ? 1
        : THREE.MathUtils.clamp((state.runupProgress - 0.42) / 0.45, 0, 1);

    modelYaw = Math.PI * 0.44 + guardBias;
    hipsY = THREE.MathUtils.lerp(96, 93, lift);
    spineX = THREE.MathUtils.lerp(0.16, 0.18, lift);
    spine2Y = THREE.MathUtils.lerp(-0.06, -0.22, lift);
    headY = modelYaw - spine2Y * 0.7;

    lKneeX = THREE.MathUtils.lerp(0.48, 0.54, lift);
    rKneeX = THREE.MathUtils.lerp(0.42, 0.48, lift);

    // Raise bat smoothly into cocked backlift behind waist/shoulder
    rArmX = THREE.MathUtils.lerp(-0.35, -0.95, lift);
    rArmY = THREE.MathUtils.lerp(0.52, 0.22, lift);
    rArmZ = THREE.MathUtils.lerp(1.15, 0.85, lift);
    rForeY = THREE.MathUtils.lerp(1.24, 1.48, lift);
    rHandZ = THREE.MathUtils.lerp(-0.22, -0.32, lift);

    lArmX = THREE.MathUtils.lerp(-0.45, -0.95, lift);
    lArmY = THREE.MathUtils.lerp(-0.56, -0.32, lift);
    lArmZ = THREE.MathUtils.lerp(-1.1, -0.75, lift);
    lForeY = THREE.MathUtils.lerp(-1.18, -1.32, lift);
  } else if (!inEntrance) {
    // Idle athletic batting stance with breathing & rhythmic crease tap
    const breathe = Math.sin(elapsed * 2.5) * 0.015;
    const tap = Math.sin(elapsed * 4.2) * 0.14;
    modelYaw = Math.PI * 0.44 + guardBias;
    hipsY = 96 + Math.sin(elapsed * 2.5) * 1.1;
    spineX = 0.16 + breathe;
    headY = modelYaw;

    rArmX = -0.35 - Math.max(0, tap) * 0.55;
    rForeY = 1.24 + tap * 0.45;
    rHandZ = -0.22 - tap * 0.45;
    lArmX = -0.45 - Math.max(0, tap) * 0.45;
    lForeY = -1.18 - tap * 0.35;
  }

  rig.model.rotation.y = damp(rig.model.rotation.y, modelYaw, inEntrance ? 6 : lambda, dt);
  rig.model.position.x = damp(rig.model.position.x, modelOffsetX, lambda, dt);
  rig.model.position.z = damp(rig.model.position.z, modelOffsetZ, lambda, dt);
  b.hips.position.y = damp(b.hips.position.y, hipsY, lambda, dt);

  slerpBone(b.spine, spineX, 0, 0, lambda, dt);
  slerpBone(b.spine1, spine1X, 0, 0, lambda, dt);
  slerpBone(b.spine2, 0.04, spine2Y, 0, lambda, dt);
  slerpBone(b.neck, -0.05, headY * 0.3, 0, lambda, dt);
  slerpBone(b.head, headX, headY * 0.7, 0, lambda, dt);

  slerpBone(b.leftUpLeg, lUpLegX, 0, lUpLegZ, lambda, dt);
  slerpBone(b.leftLeg, lKneeX, 0, 0, lambda, dt);
  slerpBone(b.leftFoot, lFootX, 0, 0, lambda, dt);

  slerpBone(b.rightUpLeg, rUpLegX, 0, rUpLegZ, lambda, dt);
  slerpBone(b.rightLeg, rKneeX, 0, 0, lambda, dt);
  slerpBone(b.rightFoot, rFootX, 0, 0, lambda, dt);

  slerpBone(b.leftArm, lArmX, lArmY, lArmZ, lambda, dt);
  slerpBone(b.leftForeArm, 0, lForeY, 0, lambda, dt);

  slerpBone(b.rightArm, rArmX, rArmY, rArmZ, lambda, dt);
  slerpBone(b.rightForeArm, 0, rForeY, 0, lambda, dt);
  slerpBone(b.rightHand, 0, 0, rHandZ, lambda, dt);

  rig.contactShadow.position.x = rig.model.position.x;
  rig.contactShadow.position.z = rig.model.position.z;
}

/**
 * Smooth skeletal Non-Striker Opening Batter pose:
 * walks out side-by-side with striker from pavilion tunnel, then stands at bowler's end.
 */
export function updateXbotNonStrikerPose(
  rig: XbotCharacterInstance,
  state: {
    phase: MatchPhase;
    walkinProgress?: number;
    runupProgress: number;
  },
  dt: number,
  elapsed: number,
): void {
  const b = rig.bones;
  const lambda = 10;

  let modelYaw = 0.25; // angled toward striker's crease (+Z)
  let hipsY = 101;
  let spineX = 0.08;
  let spine2Y = 0;
  let headY = 0;

  let lUpLegX = -0.1;
  let lKneeX = 0.18;
  let rUpLegX = 0.08;
  let rKneeX = 0.16;

  let lArmX = -0.25;
  let lArmZ = -1.24;
  let lForeY = -0.52;
  let rArmX = -0.22;
  let rArmZ = 1.22;
  let rForeY = 0.65;
  let rHandZ = -0.32;

  if (state.phase === 'walkin') {
    const wp = THREE.MathUtils.clamp(state.walkinProgress ?? 0, 0, 1);
    const moveT = THREE.MathUtils.clamp((wp - 0.48) / 0.48, 0, 1);
    const wx = THREE.MathUtils.lerp(12.6, -1.08, moveT) - Math.sin(moveT * Math.PI) * 1.1;
    const wz = THREE.MathUtils.lerp(48.6, -8.84, moveT);
    rig.root.position.set(wx, 0.022, wz);

    if (moveT > 0 && moveT < 1) {
      const targetYaw = Math.atan2(-1.08 - 12.6, -8.84 - 48.6);
      const stride = elapsed * 5.8 + 0.8;
      const sSin = Math.sin(stride);
      const sCos = Math.cos(stride);

      modelYaw = targetYaw;
      hipsY = 101.5 + Math.abs(sSin) * 2.4;
      spineX = 0.05;
      spine2Y = sSin * 0.05;
      headY = Math.sin(elapsed * 1.2) * 0.2;

      lUpLegX = sSin * 0.44;
      lKneeX = Math.max(0.08, -sCos * 0.52 + 0.28);
      rUpLegX = -sSin * 0.44;
      rKneeX = Math.max(0.08, sCos * 0.52 + 0.28);

      lArmX = -sSin * 0.34;
      lForeY = -0.35;
      rArmX = 0.14 + sSin * 0.12;
      rForeY = 0.32;
      rHandZ = -0.38;
    } else if (moveT <= 0) {
      modelYaw = Math.atan2(-1.08 - 12.6, -8.84 - 48.6);
    } else {
      rig.root.position.set(-1.08, 0.022, -8.84);
      modelYaw = 0.18;
    }
  } else {
    // Back up slightly down the pitch during runup/delivery
    const backupZ =
      state.phase === 'runup'
        ? -8.84 + state.runupProgress * 0.85
        : state.phase === 'delivery' || state.phase === 'ballInPlay'
          ? -7.95
          : -8.84;
    rig.root.position.x = damp(rig.root.position.x, -1.08, 8, dt);
    rig.root.position.z = damp(rig.root.position.z, backupZ, 6, dt);
    hipsY = 100 + Math.sin(elapsed * 2.4) * 1.1;
  }

  rig.model.rotation.y = damp(rig.model.rotation.y, modelYaw, 7, dt);
  b.hips.position.y = damp(b.hips.position.y, hipsY, lambda, dt);

  slerpBone(b.spine, spineX * 0.65, 0, 0, lambda, dt);
  slerpBone(b.spine1, spineX * 0.35, 0, 0, lambda, dt);
  slerpBone(b.spine2, 0.02, spine2Y, 0, lambda, dt);
  slerpBone(b.head, -0.05, headY, 0, lambda, dt);

  slerpBone(b.leftUpLeg, lUpLegX, 0, 0.08, lambda, dt);
  slerpBone(b.leftLeg, lKneeX, 0, 0, lambda, dt);
  slerpBone(b.rightUpLeg, rUpLegX, 0, -0.08, lambda, dt);
  slerpBone(b.rightLeg, rKneeX, 0, 0, lambda, dt);

  slerpBone(b.leftArm, lArmX, 0, lArmZ, lambda, dt);
  slerpBone(b.leftForeArm, 0, lForeY, 0, lambda, dt);
  slerpBone(b.rightArm, rArmX, 0, rArmZ, lambda, dt);
  slerpBone(b.rightForeArm, 0, rForeY, 0, lambda, dt);
  slerpBone(b.rightHand, 0, 0, rHandZ, lambda, dt);
}

/**
 * Smooth skeletal Bowler pose:
 * accelerating run-up -> side-on bound -> 360° overhead windmill release -> follow-through.
 */
export function updateXbotBowlerPose(
  rig: XbotCharacterInstance,
  state: XbotBowlerAnimState,
  dt: number,
  elapsed: number,
): void {
  const b = rig.bones;
  const lambda = 16;

  const isSpin = state.archetype === 'spin';
  const startZ = isSpin ? -14.8 : -22.2;
  const sideX = state.bowlingSide === 'around' ? -0.42 : 0.42;

  let rootZ = startZ;
  let hipsY = 102;
  let modelYaw = 0;
  let spineX = 0.06;
  let spine2Y = 0;
  let spine2Z = 0;
  let headY = 0;
  let headX = 0;

  let lUpLegX = 0;
  let lKneeX = 0.08;
  let lFootX = 0;
  let rUpLegX = 0;
  let rKneeX = 0.08;
  let rFootX = 0;

  let lArmX = -0.2;
  let lArmZ = -1.32;
  let lForeY = -0.55;

  let rArmX = -0.45;
  let rArmZ = 1.32;
  let rForeY = 1.15;
  let rHandX = 0;

  if (state.phase === 'walkin') {
    const wp = THREE.MathUtils.clamp(state.walkinProgress ?? 0, 0, 1);
    const jogT = THREE.MathUtils.clamp((wp - 0.04) / 0.44, 0, 1);
    const bx = THREE.MathUtils.lerp(12.8, sideX, jogT);
    const bz = THREE.MathUtils.lerp(48.8, startZ, jogT);
    rig.root.position.set(bx, 0.022, bz);

    if (jogT < 1) {
      const stride = elapsed * 10.5;
      const sSin = Math.sin(stride);
      const sCos = Math.cos(stride);
      modelYaw = Math.atan2(sideX - 12.8, startZ - 48.8);
      hipsY = 99 + Math.abs(sSin) * 4.2;
      spineX = 0.16;
      lUpLegX = sSin * 0.62;
      lKneeX = Math.max(0.1, -sCos * 0.68 + 0.35);
      rUpLegX = -sSin * 0.62;
      rKneeX = Math.max(0.1, sCos * 0.68 + 0.35);
      lArmX = -sSin * 0.55;
      lForeY = -1.15;
      rArmX = sSin * 0.45 - 0.2;
      rForeY = 1.25;
    } else {
      modelYaw = 0;
    }
  } else {
    rig.root.position.x = damp(rig.root.position.x, sideX, 8, dt);
  }

  if (state.phase === 'walkin') {
    // Position already driven by stadium jog-in above
  } else if (state.phase === 'runup') {
    const t = THREE.MathUtils.clamp(state.runupProgress, 0, 1);
    const accelT = isSpin ? 0.35 * t * t + 0.65 * t : 0.55 * t * t + 0.45 * t;
    rootZ = THREE.MathUtils.lerp(startZ, -9.45, accelT);

    if (t < 0.7) {
      // Accelerating sprint stride (or rhythmic spin jog)
      const stridePhase = t * Math.PI * (isSpin ? 5.0 : 8.0);
      const strideAmp = THREE.MathUtils.lerp(
        isSpin ? 0.28 : 0.35,
        isSpin ? 0.56 : 0.84,
        t / 0.7,
      );
      const sSin = Math.sin(stridePhase);
      const sCos = Math.cos(stridePhase);

      hipsY = 98 + Math.abs(sSin) * (isSpin ? 3.5 : 5.5);
      spineX = THREE.MathUtils.lerp(0.12, isSpin ? 0.18 : 0.28, t / 0.7);
      modelYaw = sSin * 0.08;

      lUpLegX = sSin * strideAmp;
      lKneeX = Math.max(0.12, -sCos * 0.95 + 0.45);
      lFootX = -lKneeX * 0.25;

      rUpLegX = -sSin * strideAmp;
      rKneeX = Math.max(0.12, sCos * 0.95 + 0.45);
      rFootX = -rKneeX * 0.25;

      lArmX = -sSin * 0.75;
      lForeY = -1.35;
      rArmX = sSin * 0.55 - 0.25;
      rForeY = 1.45;
    } else if (t < 0.84) {
      // Side-on bound & gather at popping crease
      const g = (t - 0.7) / 0.14;
      hipsY = 98 + Math.sin(g * Math.PI) * (isSpin ? 5 : 10);
      modelYaw = THREE.MathUtils.lerp(0, -Math.PI * 0.42, g);
      spineX = THREE.MathUtils.lerp(0.24, -0.14, g);
      spine2Z = THREE.MathUtils.lerp(0, -0.14, g);
      headY = -modelYaw * 0.9;

      rUpLegX = 0.18;
      rKneeX = 0.42;
      lUpLegX = THREE.MathUtils.lerp(-0.4, -0.82, g);
      lKneeX = THREE.MathUtils.lerp(0.6, 0.92, g);

      lArmX = THREE.MathUtils.lerp(-0.4, -2.15, g);
      lArmZ = -1.2;
      lForeY = THREE.MathUtils.lerp(-1.2, -0.25, g);

      rArmX = THREE.MathUtils.lerp(-0.3, 0.85, g);
      rArmZ = 1.25;
      rForeY = THREE.MathUtils.lerp(1.1, 0.25, g);
    } else {
      // 360° overhead windmill arm rotation & wrist snap
      const w = (t - 0.84) / 0.16;
      hipsY = THREE.MathUtils.lerp(103, 95, w);
      modelYaw = THREE.MathUtils.lerp(-Math.PI * 0.42, -0.1, w);
      spineX = THREE.MathUtils.lerp(-0.14, 0.36, w);
      spine2Z = THREE.MathUtils.lerp(-0.14, 0.2, w);
      headY = -modelYaw * 0.85;

      lUpLegX = THREE.MathUtils.lerp(-0.82, -0.62, w);
      lKneeX = THREE.MathUtils.lerp(0.92, 0.14, w);
      rUpLegX = THREE.MathUtils.lerp(0.18, 0.55, w);
      rKneeX = 0.35;

      lArmX = THREE.MathUtils.lerp(-2.15, 0.35, w);
      lArmZ = -1.25;
      lForeY = THREE.MathUtils.lerp(-0.25, -1.45, w);

      // Bowling arm whips from behind (+0.85) over top (-PI) to release (-3.25)
      rArmX = THREE.MathUtils.lerp(0.85, -3.25, w);
      rArmZ = 1.38;
      rForeY = 0.12;
      rHandX = THREE.MathUtils.lerp(-0.25, 0.42, w);
    }

    rig.root.position.z = rootZ;
  } else if (state.phase === 'delivery' || state.phase === 'ballInPlay') {
    // Decelerating follow-through past the stumps
    const dT = THREE.MathUtils.clamp(state.deliveryElapsed / 1.1, 0, 1);
    const targetZ = THREE.MathUtils.lerp(-9.45, -6.9, 1 - Math.pow(1 - dT, 2));
    rig.root.position.z = damp(rig.root.position.z, targetZ, 7, dt);

    const strideDecay = (1 - dT) * Math.sin(dT * Math.PI * 3.5);
    hipsY = 98 + Math.abs(strideDecay) * 4;
    modelYaw = THREE.MathUtils.lerp(-0.1, 0, dT);
    spineX = THREE.MathUtils.lerp(0.36, 0.06, dT);
    spine2Z = THREE.MathUtils.lerp(0.18, 0, dT);

    lUpLegX = strideDecay * 0.52;
    lKneeX = Math.max(0.1, Math.abs(strideDecay) * 0.45);
    rUpLegX = -strideDecay * 0.52;
    rKneeX = Math.max(0.1, Math.abs(strideDecay) * 0.45);

    rArmX = THREE.MathUtils.lerp(-3.25, -5.85, Math.min(1, dT * 1.35));
    rArmZ = THREE.MathUtils.lerp(1.38, 1.15, Math.min(1, dT * 1.35));
    rForeY = 0.45;
    lArmX = 0.15;
    lForeY = -0.75;
  } else {
    rig.root.position.z = damp(rig.root.position.z, startZ, 8, dt);
    hipsY = 102 + Math.sin(elapsed * 3.1) * 1.5;
    lUpLegX = -0.08;
    rUpLegX = 0.12;
    lKneeX = 0.14;
    rKneeX = 0.14;
    rArmX = -0.55;
    rForeY = 1.25;
    lArmX = -0.35;
    lForeY = -0.85;
  }

  rig.model.rotation.y = damp(rig.model.rotation.y, modelYaw, lambda, dt);
  b.hips.position.y = damp(b.hips.position.y, hipsY, lambda, dt);

  slerpBone(b.spine, spineX, 0, 0, lambda, dt);
  slerpBone(b.spine1, spineX * 0.4, 0, 0, lambda, dt);
  slerpBone(b.spine2, 0, spine2Y, spine2Z, lambda, dt);
  slerpBone(b.head, headX, headY, 0, lambda, dt);

  slerpBone(b.leftUpLeg, lUpLegX, 0, 0.06, lambda, dt);
  slerpBone(b.leftLeg, lKneeX, 0, 0, lambda, dt);
  slerpBone(b.leftFoot, lFootX, 0, 0, lambda, dt);

  slerpBone(b.rightUpLeg, rUpLegX, 0, -0.06, lambda, dt);
  slerpBone(b.rightLeg, rKneeX, 0, 0, lambda, dt);
  slerpBone(b.rightFoot, rFootX, 0, 0, lambda, dt);

  slerpBone(b.leftArm, lArmX, 0, lArmZ, lambda, dt);
  slerpBone(b.leftForeArm, 0, lForeY, 0, lambda, dt);

  const armLambda = state.phase === 'runup' && state.runupProgress >= 0.8 ? 42 : lambda;
  slerpBone(b.rightArm, rArmX, 0, rArmZ, armLambda, dt);
  slerpBone(b.rightForeArm, 0, rForeY, 0, armLambda, dt);
  slerpBone(b.rightHand, rHandX, 0, 0, armLambda, dt);
}

/**
 * Smooth skeletal Wicketkeeper pose:
 * low crouch 2m behind stumps, tracks line, rises with bounce, and catches missed balls.
 */
export function updateXbotKeeperPose(
  rig: XbotCharacterInstance,
  state: XbotKeeperAnimState,
  dt: number,
  elapsed: number,
): void {
  const b = rig.bones;
  const lambda = 11;

  if (state.phase === 'walkin') {
    const wp = THREE.MathUtils.clamp(state.walkinProgress ?? 0, 0, 1);
    const jogT = THREE.MathUtils.clamp(wp / 0.38, 0, 1);
    const kx = THREE.MathUtils.lerp(11.6, -0.14, jogT);
    const kz = THREE.MathUtils.lerp(48.2, 12.06, jogT);
    rig.root.position.set(kx, 0.022, kz);
    if (jogT < 1) {
      rig.root.rotation.y = Math.atan2(-0.14 - 11.6, 12.06 - 48.2);
      const stride = elapsed * 10.2;
      const sSin = Math.sin(stride);
      const sCos = Math.cos(stride);
      b.hips.position.y = damp(b.hips.position.y, 99 + Math.abs(sSin) * 4, lambda, dt);
      slerpBone(b.spine, 0.14, 0, 0, lambda, dt);
      slerpBone(b.spine1, 0.06, 0, 0, lambda, dt);
      slerpBone(b.head, -0.05, 0, 0, lambda, dt);
      slerpBone(b.leftUpLeg, sSin * 0.58, 0, 0.1, lambda, dt);
      slerpBone(b.leftLeg, Math.max(0.1, -sCos * 0.65 + 0.32), 0, 0, lambda, dt);
      slerpBone(b.rightUpLeg, -sSin * 0.58, 0, -0.1, lambda, dt);
      slerpBone(b.rightLeg, Math.max(0.1, sCos * 0.65 + 0.32), 0, 0, lambda, dt);
      slerpBone(b.leftArm, -sSin * 0.5, 0, -1.2, lambda, dt);
      slerpBone(b.leftForeArm, 0, -1.0, 0, lambda, dt);
      slerpBone(b.rightArm, sSin * 0.5, 0, 1.2, lambda, dt);
      slerpBone(b.rightForeArm, 0, 1.0, 0, lambda, dt);
      return;
    }
    rig.root.rotation.y = Math.PI;
  }

  rig.root.rotation.y = Math.PI;
  rig.root.position.z = damp(rig.root.position.z, 12.06, 8, dt);

  const trackX =
    state.phase === 'delivery' || state.phase === 'ballInPlay'
      ? THREE.MathUtils.clamp(state.ballPos.x, -0.58, 0.58)
      : -0.14;
  rig.root.position.x = damp(rig.root.position.x, trackX, 6.5, dt);

  const nearStriker =
    state.phase === 'delivery' && state.ballPos.z > 2.5
      ? THREE.MathUtils.clamp((state.ballPos.z - 2.5) / 7.5, 0, 1)
      : 0;
  const ballRise = nearStriker * THREE.MathUtils.clamp((state.ballPos.y - 0.55) * 0.4, 0, 0.28);

  const isCatching =
    state.phase === 'ballInPlay' &&
    !state.stumpsBroken &&
    state.lastOutcomeCode === '0' &&
    state.lastTiming === 'MISSED';

  const breathe = Math.sin(elapsed * 2.8) * 1.0;
  const hipsY = isCatching ? 82 : 70 + ballRise * 42 + breathe;
  const kneeBend = isCatching ? 0.95 : 1.38 - ballRise * 1.4;
  const hipFlex = isCatching ? -0.78 : -1.18 + ballRise * 1.05;
  const spinePitch = isCatching ? 0.28 : 0.46 - ballRise * 0.45;
  const headPitch = -spinePitch * 0.85;

  const gloveZ = isCatching ? 0.2 : -0.12;
  const armX = isCatching ? -1.05 : -0.78;
  const foreFlex = isCatching ? 0.95 : 0.82;

  b.hips.position.y = damp(b.hips.position.y, hipsY, lambda, dt);
  slerpBone(b.spine, spinePitch * 0.65, 0, 0, lambda, dt);
  slerpBone(b.spine1, spinePitch * 0.35, 0, 0, lambda, dt);
  slerpBone(b.head, headPitch, 0, 0, lambda, dt);

  slerpBone(b.leftUpLeg, hipFlex, 0, 0.24, lambda, dt);
  slerpBone(b.leftLeg, kneeBend, 0, 0, lambda, dt);
  slerpBone(b.leftFoot, -0.25, 0, 0, lambda, dt);

  slerpBone(b.rightUpLeg, hipFlex, 0, -0.24, lambda, dt);
  slerpBone(b.rightLeg, kneeBend, 0, 0, lambda, dt);
  slerpBone(b.rightFoot, -0.25, 0, 0, lambda, dt);

  slerpBone(b.leftArm, armX, -0.25, -1.05 - gloveZ, lambda, dt);
  slerpBone(b.leftForeArm, 0, -foreFlex, 0, lambda, dt);

  slerpBone(b.rightArm, armX, 0.25, 1.05 + gloveZ, lambda, dt);
  slerpBone(b.rightForeArm, 0, foreFlex, 0, lambda, dt);
}

/**
 * Smooth skeletal Fielder pose across idle crouch, walk-in step, sprinting chase,
 * bending down to pick up the ball, and throwing back to the keeper.
 */
export function updateXbotFielderPose(
  fielder: XbotFielderInstance,
  ballPos: THREE.Vector3,
  keeperPos: THREE.Vector3,
  dt: number,
  elapsed: number,
): void {
  const b = fielder.bones;
  const lambda =
    fielder.state === 'catchDive' || fielder.state === 'catchOverhead' ? 18 : 12;

  let hipsY = 98;
  let spineX = 0.16;
  let spine2Y = 0;
  let modelRollZ = 0;
  let headXOffset = 0;
  let lUpLegX = -0.22;
  let lKneeX = 0.34;
  let rUpLegX = -0.22;
  let rKneeX = 0.34;
  let lArmX = -0.35;
  let lArmZ = -1.2;
  let lForeY = -0.65;
  let rArmX = -0.35;
  let rArmZ = 1.2;
  let rForeY = 0.65;

  if (fielder.state === 'walkin') {
    const walkPhase = elapsed * 6.5 + fielder.homePos.x;
    const s = Math.sin(walkPhase);
    const c = Math.cos(walkPhase);
    hipsY = 100 + Math.abs(s) * 2.5;
    spineX = 0.12;
    lUpLegX = s * 0.35;
    lKneeX = Math.max(0.1, -c * 0.4 + 0.25);
    rUpLegX = -s * 0.35;
    rKneeX = Math.max(0.1, c * 0.4 + 0.25);
    lArmX = -s * 0.35;
    lForeY = -0.75;
    rArmX = s * 0.35;
    rForeY = 0.75;
  } else if (fielder.state === 'chase' || fielder.state === 'return') {
    const stride = elapsed * 14.5;
    const s = Math.sin(stride);
    const c = Math.cos(stride);
    hipsY = 97 + Math.abs(s) * 6;
    spineX = 0.3;
    lUpLegX = s * 0.88;
    lKneeX = Math.max(0.12, -c * 0.95 + 0.48);
    rUpLegX = -s * 0.88;
    rKneeX = Math.max(0.12, c * 0.95 + 0.48);
    lArmX = -s * 0.82;
    lForeY = -1.42;
    rArmX = s * 0.82;
    rForeY = 1.42;
  } else if (fielder.state === 'catchOverhead') {
    // Athletic leap with both hands stretched high overhead to pluck the ball
    const jumpArc = Math.sin(THREE.MathUtils.clamp(fielder.stateTimer / 0.36, 0, 1) * Math.PI);
    hipsY = 104 + jumpArc * 16;
    spineX = -0.14;
    headXOffset = -0.35;
    lUpLegX = -0.24;
    lKneeX = 0.36;
    rUpLegX = -0.18;
    rKneeX = 0.28;
    // Cupped hands overhead
    lArmX = -2.75;
    lArmZ = -0.42;
    lForeY = -0.45;
    rArmX = -2.75;
    rArmZ = 0.42;
    rForeY = 0.45;
  } else if (fielder.state === 'catchDive') {
    // Full sideways athletic dive toward low descending ball
    const diveT = THREE.MathUtils.clamp(fielder.stateTimer / 0.38, 0, 1);
    const arc = Math.sin(diveT * Math.PI);
    modelRollZ = fielder.diveDirSign * THREE.MathUtils.lerp(0.65, 1.18, Math.min(1, diveT * 1.8));
    hipsY = 36 + arc * 26;
    spineX = 0.22;
    headXOffset = -0.25;
    lUpLegX = 0.18;
    lKneeX = 0.28;
    rUpLegX = 0.28;
    rKneeX = 0.34;
    // Outstretched arms to scoop catch cleanly off the grass
    lArmX = -2.42;
    lArmZ = -0.32;
    lForeY = -0.22;
    rArmX = -2.42;
    rArmZ = 0.32;
    rForeY = 0.22;
  } else if (fielder.state === 'celebrate') {
    // Joyful celebratory jump & ball toss skyward
    const ct = fielder.stateTimer;
    const hop = Math.abs(Math.sin(elapsed * 9.5)) * 9;
    hipsY = 102 + hop;
    spineX = -0.08;
    headXOffset = -0.28;
    lUpLegX = -0.15;
    lKneeX = 0.26;
    rUpLegX = -0.15;
    rKneeX = 0.26;

    if (ct < 0.28) {
      // Wind-up and toss upward with right hand
      const p = ct / 0.28;
      rArmX = THREE.MathUtils.lerp(-0.9, -2.85, p);
      rArmZ = 0.72;
      rForeY = THREE.MathUtils.lerp(1.15, 0.22, p);
      lArmX = -2.35;
      lArmZ = -0.65;
      lForeY = -0.35;
    } else {
      // Fist pumps & both arms raised high as ball flies overhead
      const pump = Math.sin(elapsed * 12) * 0.22;
      rArmX = -2.65 + pump;
      rArmZ = 0.58;
      rForeY = 0.32;
      lArmX = -2.62 - pump;
      lArmZ = -0.58;
      lForeY = -0.32;
    }
  } else if (fielder.state === 'pickup') {
    // Low bend to scoop cricket ball off the grass
    hipsY = 78;
    spineX = 0.82;
    lUpLegX = -0.85;
    lKneeX = 1.05;
    rUpLegX = -0.45;
    rKneeX = 0.65;
    rArmX = -1.15;
    rArmZ = 1.38;
    rForeY = 0.22;
    lArmX = -0.25;
    lForeY = -0.85;
  } else if (fielder.state === 'throw') {
    // Athletic overarm relay throw toward wicketkeeper
    const p = THREE.MathUtils.clamp(fielder.stateTimer / 0.38, 0, 1);
    hipsY = 98;
    spineX = THREE.MathUtils.lerp(-0.15, 0.34, p);
    spine2Y = THREE.MathUtils.lerp(-0.42, 0.35, p);
    rArmX = THREE.MathUtils.lerp(0.85, -2.55, p);
    rArmZ = 1.1;
    rForeY = THREE.MathUtils.lerp(1.4, 0.22, p);
    lArmX = THREE.MathUtils.lerp(-1.2, 0.25, p);
    lForeY = -1.1;
    lUpLegX = -0.58;
    lKneeX = 0.32;
    rUpLegX = 0.38;
    rKneeX = 0.28;

    // Face wicketkeeper during throw
    _vTmp.subVectors(keeperPos, fielder.currentPos);
    fielder.facingYaw = Math.atan2(_vTmp.x, _vTmp.z);
  } else {
    // Alert cricket ready stance watching ball
    const breathe = Math.sin(elapsed * 2.4 + fielder.homePos.z) * 1.0;
    hipsY = 97 + breathe;
    spineX = 0.2;
    _vTmp.subVectors(ballPos, fielder.currentPos);
    fielder.facingYaw = Math.atan2(_vTmp.x, _vTmp.z);
  }

  fielder.root.position.copy(fielder.currentPos);
  // Smoothly turn root toward facingYaw without wrap jumps
  let diff = fielder.facingYaw - fielder.root.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  fielder.root.rotation.y += diff * (1 - Math.exp(-10 * dt));
  fielder.model.rotation.z = damp(fielder.model.rotation.z, modelRollZ, 16, dt);

  b.hips.position.y = damp(b.hips.position.y, hipsY, lambda, dt);
  slerpBone(b.spine, spineX * 0.65, 0, 0, lambda, dt);
  slerpBone(b.spine1, spineX * 0.35, 0, 0, lambda, dt);
  slerpBone(b.spine2, 0, spine2Y, 0, lambda, dt);
  slerpBone(b.head, -spineX * 0.55 + headXOffset, 0, 0, lambda, dt);

  slerpBone(b.leftUpLeg, lUpLegX, 0, 0.08, lambda, dt);
  slerpBone(b.leftLeg, lKneeX, 0, 0, lambda, dt);
  slerpBone(b.rightUpLeg, rUpLegX, 0, -0.08, lambda, dt);
  slerpBone(b.rightLeg, rKneeX, 0, 0, lambda, dt);

  slerpBone(b.leftArm, lArmX, 0, lArmZ, lambda, dt);
  slerpBone(b.leftForeArm, 0, lForeY, 0, lambda, dt);
  slerpBone(b.rightArm, rArmX, 0, rArmZ, lambda, dt);
  slerpBone(b.rightForeArm, 0, rForeY, 0, lambda, dt);
}
