import * as THREE from 'three';
import {
  ARM_LOWER_LEN,
  ARM_UPPER_LEN,
  SculptedBatterRig,
  SculptedBowlerRig,
  SculptedKeeperRig,
} from './characterBuilder';
import {
  BallOutcomeCode,
  BowlerArchetype,
  BowlingSide,
  MatchPhase,
  ShotDirection,
  TimingVerdict,
} from '../types/game';

export interface BatterAnimState {
  phase: MatchPhase;
  selectedDirection: ShotDirection;
  swingActive: boolean;
  swingTimer: number;
  swingDirection: ShotDirection;
  runupProgress: number;
  walkinProgress?: number;
}

export interface BowlerAnimState {
  phase: MatchPhase;
  runupProgress: number;
  deliveryElapsed: number;
  archetype?: BowlerArchetype;
  bowlingSide?: BowlingSide;
}

export interface KeeperAnimState {
  phase: MatchPhase;
  ballPos: THREE.Vector3;
  stumpsBroken: boolean;
  lastOutcomeCode: BallOutcomeCode | null;
  lastTiming: TimingVerdict | null;
}

// Module-scope scratch math objects (zero GC allocations per frame)
const _vS = new THREE.Vector3();
const _vT = new THREE.Vector3();
const _vD = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _vBendSide = new THREE.Vector3();
const _vElbow = new THREE.Vector3();
const _vUDir = new THREE.Vector3();
const _vFDir = new THREE.Vector3();
const _vBasisX = new THREE.Vector3();
const _vBasisY = new THREE.Vector3();
const _vBasisZ = new THREE.Vector3();
const _mBasis = new THREE.Matrix4();
const _qTarget = new THREE.Quaternion();
const _mBatToSpine = new THREE.Matrix4();

function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

/**
 * Zero-allocation analytical 2-bone arm IK in spine-local space.
 * Locks shoulder + elbow so the gloved wrist lands directly on the bat handle anchor.
 */
function solveArmIKInSpine(
  shoulder: THREE.Group,
  elbow: THREE.Group,
  wrist: THREE.Group,
  targetInSpine: THREE.Vector3,
  poleDirInSpine: THREE.Vector3,
  wristRollZ: number,
  lambda: number,
  dt: number,
): void {
  _vS.copy(shoulder.position);
  _vT.copy(targetInSpine);
  _vD.subVectors(_vT, _vS);

  const rawDist = _vD.length();
  const minDist = Math.abs(ARM_UPPER_LEN - ARM_LOWER_LEN) + 0.04;
  const maxDist = ARM_UPPER_LEN + ARM_LOWER_LEN - 0.008;
  const dist = THREE.MathUtils.clamp(rawDist, minDist, maxDist);

  if (rawDist > 1e-5) {
    _vDir.copy(_vD).divideScalar(rawDist);
  } else {
    _vDir.set(0, -1, 0);
  }

  // Orthogonalize pole direction (direction elbow points outward/back) against shoulder->target
  _vPole.copy(poleDirInSpine).normalize();
  const proj = _vPole.dot(_vDir);
  _vBendSide.copy(_vPole).addScaledVector(_vDir, -proj);
  if (_vBendSide.lengthSq() < 1e-5) {
    _vBendSide.set(0, 0, -1);
  } else {
    _vBendSide.normalize();
  }

  // Law of cosines for shoulder angle alpha from shoulder->target toward elbow pole
  const l1 = ARM_UPPER_LEN;
  const l2 = ARM_LOWER_LEN;
  const cosAlpha = THREE.MathUtils.clamp(
    (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist),
    -1,
    1,
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  _vElbow
    .copy(_vS)
    .addScaledVector(_vDir, cosAlpha * l1)
    .addScaledVector(_vBendSide, sinAlpha * l1);

  _vUDir.subVectors(_vElbow, _vS).normalize();
  _vFDir.subVectors(_vT, _vElbow).normalize();

  // Construct shoulder orientation: -Y aligns with uDir, +X is elbow flexion axis
  _vBasisX.crossVectors(_vUDir, _vBendSide);
  if (_vBasisX.lengthSq() < 1e-5) {
    _vBasisX.set(1, 0, 0);
  } else {
    _vBasisX.normalize();
  }
  _vBasisY.copy(_vUDir).negate();
  _vBasisZ.crossVectors(_vBasisX, _vBasisY).normalize();

  _mBasis.makeBasis(_vBasisX, _vBasisY, _vBasisZ);
  _qTarget.setFromRotationMatrix(_mBasis);

  const slerpAlpha = 1 - Math.exp(-lambda * dt);
  shoulder.quaternion.slerp(_qTarget, slerpAlpha);

  // Anatomical elbow hinge flexion around +X (negative X rotates -Y toward +Z)
  const cosElbow = THREE.MathUtils.clamp(_vUDir.dot(_vFDir), -1, 1);
  const flexAngle = Math.acos(cosElbow);
  elbow.rotation.x = damp(elbow.rotation.x, -flexAngle, lambda, dt);
  elbow.rotation.y = damp(elbow.rotation.y, 0, lambda, dt);
  elbow.rotation.z = damp(elbow.rotation.z, 0, lambda, dt);

  wrist.rotation.x = damp(wrist.rotation.x, 0.15, lambda, dt);
  wrist.rotation.z = damp(wrist.rotation.z, wristRollZ, lambda, dt);
}

/**
 * Fluid biomechanical Batter animation:
 * 1) Side-on breathing stance with rhythmic bat tap
 * 2) Trigger & high backlift during bowler's delivery stride
 * 3) Cover Drive (off), Pull Shot (leg), and Lofted Slog (straight) with exact 2-bone arm IK
 */
export function updateBatterPose(
  rig: SculptedBatterRig,
  state: BatterAnimState,
  dt: number,
  elapsed: number,
): void {
  const lambda = state.swingActive ? 22 : 9.5;

  // Target joint parameters
  let hipsY = 0.84;
  let hipsX = 0;
  let hipsZ = 0;
  let hipsYaw = Math.PI * 0.43; // Side-on chest toward Off Side (+X)
  let spinePitch = 0.24;
  let spineRoll = 0.04;
  let spineYaw = 0;
  let headYaw = -Math.PI * 0.42; // Eyes locked down -Z toward bowler
  let headPitch = -0.06;

  // Legs (Left = Front leg toward bowler, Right = Back leg toward stumps)
  let lHipX = -0.34;
  let lHipZ = 0.14;
  let lKneeX = 0.46;
  let lAnkleX = -0.12;

  let rHipX = -0.26;
  let rHipZ = -0.16;
  let rKneeX = 0.42;
  let rAnkleX = -0.16;

  // Bat target in spine-local space
  let batPosX = 0.14;
  let batPosY = 0.14;
  let batPosZ = 0.25;
  let batRotX = 0.36;
  let batRotY = 0.15;
  let batRotZ = -0.28;

  // Elbow pole vectors in spine space (+X=bowler, -X=stumps, +Z=off-side, -Z=leg-side)
  let lPoleX = 0.55;
  let lPoleY = -0.2;
  let lPoleZ = -0.55;
  let rPoleX = -0.55;
  let rPoleY = -0.35;
  let rPoleZ = -0.45;

  // Subtle guard lean based on chosen shot direction
  const guardBias =
    state.selectedDirection === 'leg'
      ? -0.07
      : state.selectedDirection === 'off'
        ? 0.07
        : 0;

  if (state.phase === 'customize') {
    rig.root.position.set(11.8, 0.022, 48.0);
    hipsYaw = Math.atan2(-0.52 - 11.8, 8.84 - 48.0);
    hipsY = 0.89 + Math.sin(elapsed * 2.2) * 0.01;
    spinePitch = 0.05;
    lHipX = -0.05;
    rHipX = 0.05;
    lKneeX = 0.12;
    rKneeX = 0.12;
    headYaw = Math.sin(elapsed * 0.9) * 0.16;
    batPosX = 0.24;
    batPosY = 0.05;
    batPosZ = 0.02;
    batRotX = 0.12;
    batRotZ = -0.15;
  } else if (state.phase === 'walkin') {
    const wp = THREE.MathUtils.clamp(state.walkinProgress ?? 0, 0, 1);
    const moveT = THREE.MathUtils.clamp(wp / 0.86, 0, 1);
    const wx = THREE.MathUtils.lerp(11.8, -0.52, moveT) - Math.sin(moveT * Math.PI) * 1.6;
    const wz = THREE.MathUtils.lerp(48.0, 8.84, moveT);
    rig.root.position.set(wx, 0.022, wz);
    if (moveT < 1) {
      const stride = elapsed * 5.6;
      const sSin = Math.sin(stride);
      hipsYaw = Math.atan2(-0.52 - 11.8, 8.84 - 48.0);
      hipsY = 0.89 + Math.abs(sSin) * 0.025;
      spinePitch = 0.05;
      lHipX = sSin * 0.42;
      rHipX = -sSin * 0.42;
      lKneeX = Math.max(0.08, -Math.cos(stride) * 0.48 + 0.25);
      rKneeX = Math.max(0.08, Math.cos(stride) * 0.48 + 0.25);
      headYaw = Math.sin(elapsed * 1.3) * 0.25;
      batPosX = 0.24;
      batPosY = 0.05;
      batPosZ = 0.02;
      batRotX = 0.12;
      batRotZ = -0.15;
    }
  } else {
    rig.root.position.set(-0.52, 0.022, 8.84);
  }

  const inEntrance = state.phase === 'customize' || state.phase === 'walkin';
  const inBacklift =
    !inEntrance &&
    ((state.phase === 'runup' && state.runupProgress >= 0.42) ||
      (state.phase === 'delivery' && !state.swingActive));

  if (!inEntrance && state.swingActive) {
    const rawT = THREE.MathUtils.clamp(state.swingTimer / 0.42, 0, 1);
    // Fast downswing (0..0.42), smooth follow-through (0.42..1)
    const swingE =
      rawT < 0.42
        ? Math.pow(rawT / 0.42, 0.72)
        : 1 + 0.12 * Math.sin(((rawT - 0.42) / 0.58) * Math.PI * 0.5);
    const s = THREE.MathUtils.clamp(swingE, 0, 1.12);

    if (state.swingDirection === 'off') {
      // Classic Cover Drive: front-foot stride, head over ball, high front elbow follow-through
      hipsY = THREE.MathUtils.lerp(0.81, 0.77, s);
      hipsZ = THREE.MathUtils.lerp(0, -0.24, s); // Stride toward bowler (-Z world)
      hipsX = THREE.MathUtils.lerp(0, 0.1, s); // Into off side
      hipsYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.22, s);
      spinePitch = THREE.MathUtils.lerp(0.26, 0.38, s);
      spineYaw = THREE.MathUtils.lerp(-0.18, 0.22, s);
      headYaw = -hipsYaw * 0.85;
      headPitch = -0.14;

      // Front foot plants strongly forward
      lHipX = THREE.MathUtils.lerp(-0.35, -0.78, s);
      lHipZ = 0.18;
      lKneeX = THREE.MathUtils.lerp(0.42, 0.86, s);
      lAnkleX = -0.08;
      // Back leg extends behind
      rHipX = THREE.MathUtils.lerp(-0.22, 0.34, s);
      rKneeX = THREE.MathUtils.lerp(0.4, 0.28, s);
      rAnkleX = -0.45;

      // Bat sweeps from high backlift down through cover arc up to high finish
      batPosX = THREE.MathUtils.lerp(-0.08, 0.24, s);
      batPosY = THREE.MathUtils.lerp(0.36, 0.46, Math.max(0, s - 0.35) / 0.65);
      batPosZ = THREE.MathUtils.lerp(0.22, 0.36, s);
      batRotX = THREE.MathUtils.lerp(-0.85, 1.95, s);
      batRotY = THREE.MathUtils.lerp(-0.2, 0.45, s);
      batRotZ = THREE.MathUtils.lerp(-0.25, -0.52, s);

      // High left elbow leading the cover drive
      lPoleX = 0.8;
      lPoleY = 0.45;
      lPoleZ = -0.25;
      rPoleX = -0.45;
      rPoleY = -0.2;
      rPoleZ = -0.65;
    } else if (state.swingDirection === 'leg') {
      // Pull / Leg Whip: weight shifts back, hips swivel open toward leg side, horizontal bat whip
      hipsY = THREE.MathUtils.lerp(0.81, 0.83, s);
      hipsZ = THREE.MathUtils.lerp(0, 0.12, s); // Weight onto back foot
      hipsX = THREE.MathUtils.lerp(0, -0.06, s);
      hipsYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.88, s);
      spinePitch = THREE.MathUtils.lerp(0.24, 0.12, s);
      spineYaw = THREE.MathUtils.lerp(-0.2, 0.48, s);
      headYaw = -Math.PI * 0.65;
      headPitch = -0.04;

      lHipX = THREE.MathUtils.lerp(-0.32, -0.15, s);
      lHipZ = 0.24;
      lKneeX = 0.26;
      rHipX = THREE.MathUtils.lerp(-0.28, -0.48, s);
      rKneeX = THREE.MathUtils.lerp(0.45, 0.65, s);

      // Horizontal swivel pull around chest level
      batPosX = THREE.MathUtils.lerp(-0.06, 0.22, s);
      batPosY = THREE.MathUtils.lerp(0.35, 0.3, s);
      batPosZ = THREE.MathUtils.lerp(0.24, 0.22, s);
      batRotX = THREE.MathUtils.lerp(-0.65, 1.35, s);
      batRotY = THREE.MathUtils.lerp(0.1, -1.2, s);
      batRotZ = THREE.MathUtils.lerp(-0.3, 1.25, s);

      lPoleX = 0.55;
      lPoleY = 0.25;
      lPoleZ = -0.6;
      rPoleX = -0.65;
      rPoleY = 0.1;
      rPoleZ = -0.45;
    } else {
      // Straight Lofted Drive / Slog: clears front leg, full vertical arc & wrist roll
      hipsY = THREE.MathUtils.lerp(0.81, 0.82, s);
      hipsZ = THREE.MathUtils.lerp(0, -0.18, s);
      hipsYaw = THREE.MathUtils.lerp(Math.PI * 0.44, Math.PI * 0.36, s);
      spinePitch = THREE.MathUtils.lerp(0.26, 0.22, s);
      spineYaw = THREE.MathUtils.lerp(-0.18, 0.15, s);
      headYaw = -hipsYaw * 0.92;
      headPitch = -0.08;

      lHipX = THREE.MathUtils.lerp(-0.34, -0.62, s);
      lHipZ = 0.22;
      lKneeX = THREE.MathUtils.lerp(0.44, 0.58, s);
      rHipX = THREE.MathUtils.lerp(-0.26, 0.22, s);
      rKneeX = 0.32;

      batPosX = THREE.MathUtils.lerp(-0.08, 0.28, s);
      batPosY = THREE.MathUtils.lerp(0.38, 0.52, s);
      batPosZ = THREE.MathUtils.lerp(0.2, 0.24, s);
      batRotX = THREE.MathUtils.lerp(-0.9, 2.35, s);
      batRotY = THREE.MathUtils.lerp(0.05, 0.15, s);
      batRotZ = THREE.MathUtils.lerp(-0.22, -0.18, s);

      lPoleX = 0.7;
      lPoleY = 0.35;
      lPoleZ = -0.4;
      rPoleX = -0.5;
      rPoleY = -0.25;
      rPoleZ = -0.55;
    }
  } else if (inBacklift) {
    // Trigger & high backlift as bowler hits delivery stride
    const lift =
      state.phase === 'delivery'
        ? 1
        : THREE.MathUtils.clamp((state.runupProgress - 0.42) / 0.45, 0, 1);

    hipsY = THREE.MathUtils.lerp(0.84, 0.81, lift);
    hipsYaw = Math.PI * 0.43 + guardBias;
    spinePitch = THREE.MathUtils.lerp(0.24, 0.28, lift);
    spineYaw = THREE.MathUtils.lerp(0, -0.18, lift); // Coiled shoulders
    headYaw = -hipsYaw - spineYaw * 0.7;
    headPitch = -0.09;

    lHipX = THREE.MathUtils.lerp(-0.34, -0.38, lift);
    lKneeX = THREE.MathUtils.lerp(0.46, 0.52, lift);
    rHipX = THREE.MathUtils.lerp(-0.26, -0.3, lift);
    rKneeX = THREE.MathUtils.lerp(0.42, 0.48, lift);

    // Smoothly raise bat up into cocked backlift over stumps
    batPosX = THREE.MathUtils.lerp(0.14, -0.08, lift);
    batPosY = THREE.MathUtils.lerp(0.14, 0.36, lift);
    batPosZ = THREE.MathUtils.lerp(0.25, 0.22, lift);
    batRotX = THREE.MathUtils.lerp(0.36, -0.88, lift);
    batRotY = THREE.MathUtils.lerp(0.15, -0.15, lift);
    batRotZ = THREE.MathUtils.lerp(-0.28, -0.25, lift);
  } else if (!inEntrance) {
    // Idle athletic batting stance with subtle breathing & crease bat tap
    const breathe = Math.sin(elapsed * 2.5) * 0.012;
    const tap = Math.sin(elapsed * 4.2) * 0.08;
    hipsY = 0.84 + breathe * 0.6;
    hipsYaw = Math.PI * 0.43 + guardBias;
    spinePitch = 0.24 + breathe;
    headYaw = -hipsYaw;
    headPitch = -0.06;

    batPosX = 0.14;
    batPosY = 0.14 + Math.max(0, tap) * 0.18;
    batPosZ = 0.25;
    batRotX = 0.36 + tap;
  }

  // Smoothly damp all skeletal joints
  rig.hips.position.x = damp(rig.hips.position.x, hipsX, lambda, dt);
  rig.hips.position.y = damp(rig.hips.position.y, hipsY, lambda, dt);
  rig.hips.position.z = damp(rig.hips.position.z, hipsZ, lambda, dt);
  rig.hips.rotation.y = damp(rig.hips.rotation.y, hipsYaw, lambda, dt);

  rig.spine.rotation.x = damp(rig.spine.rotation.x, spinePitch, lambda, dt);
  rig.spine.rotation.y = damp(rig.spine.rotation.y, spineYaw, lambda, dt);
  rig.spine.rotation.z = damp(rig.spine.rotation.z, spineRoll, lambda, dt);

  rig.head.rotation.y = damp(rig.head.rotation.y, headYaw, lambda, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, headPitch, lambda, dt);

  rig.leftLeg.hip.rotation.x = damp(rig.leftLeg.hip.rotation.x, lHipX, lambda, dt);
  rig.leftLeg.hip.rotation.z = damp(rig.leftLeg.hip.rotation.z, lHipZ, lambda, dt);
  rig.leftLeg.knee.rotation.x = damp(rig.leftLeg.knee.rotation.x, lKneeX, lambda, dt);
  rig.leftLeg.ankle.rotation.x = damp(rig.leftLeg.ankle.rotation.x, lAnkleX, lambda, dt);

  rig.rightLeg.hip.rotation.x = damp(rig.rightLeg.hip.rotation.x, rHipX, lambda, dt);
  rig.rightLeg.hip.rotation.z = damp(rig.rightLeg.hip.rotation.z, rHipZ, lambda, dt);
  rig.rightLeg.knee.rotation.x = damp(rig.rightLeg.knee.rotation.x, rKneeX, lambda, dt);
  rig.rightLeg.ankle.rotation.x = damp(rig.rightLeg.ankle.rotation.x, rAnkleX, lambda, dt);

  rig.batControl.position.x = damp(rig.batControl.position.x, batPosX, lambda, dt);
  rig.batControl.position.y = damp(rig.batControl.position.y, batPosY, lambda, dt);
  rig.batControl.position.z = damp(rig.batControl.position.z, batPosZ, lambda, dt);
  rig.batControl.rotation.x = damp(rig.batControl.rotation.x, batRotX, lambda, dt);
  rig.batControl.rotation.y = damp(rig.batControl.rotation.y, batRotY, lambda, dt);
  rig.batControl.rotation.z = damp(rig.batControl.rotation.z, batRotZ, lambda, dt);

  // Update batControl local matrix and solve exact 2-bone arm IK for both hands onto handle anchors
  rig.batControl.updateMatrix();
  rig.batMeshGroup.updateMatrix();
  _mBatToSpine.multiplyMatrices(rig.batControl.matrix, rig.batMeshGroup.matrix);

  _vT.copy(rig.topGripAnchor.position).applyMatrix4(_mBatToSpine);
  _vPole.set(lPoleX, lPoleY, lPoleZ);
  solveArmIKInSpine(
    rig.leftArm.shoulder,
    rig.leftArm.elbow,
    rig.leftArm.wrist,
    _vT,
    _vPole,
    0.18,
    36,
    dt,
  );

  _vT.copy(rig.bottomGripAnchor.position).applyMatrix4(_mBatToSpine);
  _vPole.set(rPoleX, rPoleY, rPoleZ);
  solveArmIKInSpine(
    rig.rightArm.shoulder,
    rig.rightArm.elbow,
    rig.rightArm.wrist,
    _vT,
    _vPole,
    -0.18,
    36,
    dt,
  );

  // Keep ground contact shadow locked under hips XZ
  rig.contactShadow.position.x = rig.hips.position.x;
  rig.contactShadow.position.z = rig.hips.position.z;
}

/**
 * Fluid biomechanical Bowler animation:
 * 1) Top-of-mark ready stance
 * 2) Accelerating run-up with alternating knee drive & pumping elbows
 * 3) Side-on bound/gather, arched back & 360° overhead windmill arm release
 * 4) Natural decelerating follow-through past the stumps
 */
export function updateBowlerPose(
  rig: SculptedBowlerRig,
  state: BowlerAnimState,
  dt: number,
  elapsed: number,
): void {
  const lambda = 16;

  const sideX = state.bowlingSide === 'around' ? -0.42 : 0.42;
  rig.root.position.x = damp(rig.root.position.x, sideX, 8, dt);

  let rootZ = state.archetype === 'spin' ? -14.8 : -22.2;
  let hipsY = 0.89;
  let hipsYaw = 0;
  let spinePitch = 0.05;
  let spineRoll = 0;
  let headPitch = 0;
  let headYaw = 0;

  let lHipX = 0;
  let lKneeX = 0.08;
  let lAnkleX = 0;
  let rHipX = 0;
  let rKneeX = 0.08;
  let rAnkleX = 0;

  let lShoulderX = -0.15;
  let lShoulderZ = 0.12;
  let lElbowX = -0.45;
  let rShoulderX = -0.35;
  let rShoulderZ = -0.12;
  let rElbowX = -1.1;
  let rWristX = 0;

  if (state.phase === 'runup') {
    const t = THREE.MathUtils.clamp(state.runupProgress, 0, 1);
    // Smooth acceleration curve along run-up toward popping crease (-9.45)
    const accelT = 0.55 * t * t + 0.45 * t;
    rootZ = THREE.MathUtils.lerp(-22.2, -9.45, accelT);

    if (t < 0.7) {
      // Accelerating athletic run-up stride
      const stridePhase = t * Math.PI * 8.0;
      const strideAmp = THREE.MathUtils.lerp(0.35, 0.85, t / 0.7);
      const sSin = Math.sin(stridePhase);
      const sCos = Math.cos(stridePhase);

      hipsY = 0.87 + Math.abs(sSin) * 0.065;
      spinePitch = THREE.MathUtils.lerp(0.14, 0.28, t / 0.7);
      hipsYaw = sSin * 0.08;

      // High alternating knee drive & folded heel recovery
      lHipX = sSin * strideAmp;
      lKneeX = Math.max(0.12, -sCos * 0.95 + 0.45);
      lAnkleX = -lKneeX * 0.28;

      rHipX = -sSin * strideAmp;
      rKneeX = Math.max(0.12, sCos * 0.95 + 0.45);
      rAnkleX = -rKneeX * 0.28;

      // Pumping balance arm & tucked bowling arm
      lShoulderX = -sSin * 0.75;
      lElbowX = -1.35;
      rShoulderX = sSin * 0.55 - 0.25;
      rElbowX = -1.45;
    } else if (t < 0.84) {
      // Side-on gather & bound at the crease
      const g = (t - 0.7) / 0.14;
      hipsY = 0.88 + Math.sin(g * Math.PI) * 0.12;
      hipsYaw = THREE.MathUtils.lerp(0, -Math.PI * 0.42, g);
      spinePitch = THREE.MathUtils.lerp(0.24, -0.14, g); // Arched back coil
      spineRoll = THREE.MathUtils.lerp(0, 0.14, g);
      headYaw = -hipsYaw * 0.9;

      // Back foot lands, front leg lifts before bracing
      rHipX = 0.18;
      rKneeX = 0.42;
      lHipX = THREE.MathUtils.lerp(-0.4, -0.85, g);
      lKneeX = THREE.MathUtils.lerp(0.6, 0.95, g);

      // Left balance arm aims high down the pitch; right arm loads down/back
      lShoulderX = THREE.MathUtils.lerp(-0.4, -2.15, g);
      lShoulderZ = 0.25;
      lElbowX = THREE.MathUtils.lerp(-1.2, -0.25, g);

      rShoulderX = THREE.MathUtils.lerp(-0.3, 0.85, g);
      rShoulderZ = -0.22;
      rElbowX = THREE.MathUtils.lerp(-1.1, -0.22, g);
    } else {
      // Full 360° overhead windmill arm rotation + braced front leg + wrist snap
      const w = (t - 0.84) / 0.16;
      hipsY = THREE.MathUtils.lerp(0.92, 0.85, w);
      hipsYaw = THREE.MathUtils.lerp(-Math.PI * 0.42, -0.12, w);
      spinePitch = THREE.MathUtils.lerp(-0.14, 0.36, w);
      spineRoll = THREE.MathUtils.lerp(0.14, -0.22, w);
      headYaw = -hipsYaw * 0.85;

      // Front (left) leg braces firmly to launch velocity; back leg drags
      lHipX = THREE.MathUtils.lerp(-0.85, -0.62, w);
      lKneeX = THREE.MathUtils.lerp(0.95, 0.14, w);
      rHipX = THREE.MathUtils.lerp(0.18, 0.55, w);
      rKneeX = 0.35;

      // Balance arm pulls hard downward into ribcage
      lShoulderX = THREE.MathUtils.lerp(-2.15, 0.35, w);
      lElbowX = THREE.MathUtils.lerp(-0.25, -1.45, w);

      // Bowling arm sweeps overhead from behind (+0.85) over top (-PI) to release (-3.35)
      rShoulderX = THREE.MathUtils.lerp(0.85, -3.28, w);
      rShoulderZ = -0.16;
      rElbowX = -0.12;
      rWristX = THREE.MathUtils.lerp(-0.25, 0.45, w); // Wrist snap at release
    }

    rig.root.position.z = rootZ;
  } else if (state.phase === 'delivery' || state.phase === 'ballInPlay') {
    // Decelerating follow-through past the stumps
    const dT = THREE.MathUtils.clamp(state.deliveryElapsed / 1.1, 0, 1);
    const targetZ = THREE.MathUtils.lerp(-9.45, -6.9, 1 - Math.pow(1 - dT, 2));
    rig.root.position.z = damp(rig.root.position.z, targetZ, 7, dt);

    const strideDecay = (1 - dT) * Math.sin(dT * Math.PI * 3.5);
    hipsY = 0.87 + Math.abs(strideDecay) * 0.04;
    hipsYaw = THREE.MathUtils.lerp(-0.12, 0, dT);
    spinePitch = THREE.MathUtils.lerp(0.36, 0.06, dT);
    spineRoll = THREE.MathUtils.lerp(-0.2, 0, dT);

    lHipX = strideDecay * 0.55;
    lKneeX = Math.max(0.1, Math.abs(strideDecay) * 0.45);
    rHipX = -strideDecay * 0.55;
    rKneeX = Math.max(0.1, Math.abs(strideDecay) * 0.45);

    // Bowling arm completes arc across body then settles
    rShoulderX = THREE.MathUtils.lerp(-3.28, -5.85, Math.min(1, dT * 1.4));
    rShoulderZ = THREE.MathUtils.lerp(-0.16, 0.25, Math.min(1, dT * 1.4));
    rElbowX = -0.45;
    lShoulderX = 0.15;
    lElbowX = -0.75;
  } else {
    // Top-of-mark ready stance with light athletic bounce
    rig.root.position.z = damp(rig.root.position.z, -22.2, 8, dt);
    const bounce = Math.sin(elapsed * 3.1) * 0.015;
    hipsY = 0.89 + bounce;
    lHipX = -0.08;
    rHipX = 0.12;
    lKneeX = 0.14;
    rKneeX = 0.14;
    rShoulderX = -0.55;
    rElbowX = -1.25; // Holding ball near chest/hip
    lShoulderX = -0.35;
    lElbowX = -0.85;
  }

  rig.hips.position.y = damp(rig.hips.position.y, hipsY, lambda, dt);
  rig.hips.rotation.y = damp(rig.hips.rotation.y, hipsYaw, lambda, dt);
  rig.spine.rotation.x = damp(rig.spine.rotation.x, spinePitch, lambda, dt);
  rig.spine.rotation.z = damp(rig.spine.rotation.z, spineRoll, lambda, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, headPitch, lambda, dt);
  rig.head.rotation.y = damp(rig.head.rotation.y, headYaw, lambda, dt);

  rig.leftLeg.hip.rotation.x = damp(rig.leftLeg.hip.rotation.x, lHipX, lambda, dt);
  rig.leftLeg.knee.rotation.x = damp(rig.leftLeg.knee.rotation.x, lKneeX, lambda, dt);
  rig.leftLeg.ankle.rotation.x = damp(rig.leftLeg.ankle.rotation.x, lAnkleX, lambda, dt);

  rig.rightLeg.hip.rotation.x = damp(rig.rightLeg.hip.rotation.x, rHipX, lambda, dt);
  rig.rightLeg.knee.rotation.x = damp(rig.rightLeg.knee.rotation.x, rKneeX, lambda, dt);
  rig.rightLeg.ankle.rotation.x = damp(rig.rightLeg.ankle.rotation.x, rAnkleX, lambda, dt);

  rig.leftArm.shoulder.rotation.x = damp(rig.leftArm.shoulder.rotation.x, lShoulderX, lambda, dt);
  rig.leftArm.shoulder.rotation.z = damp(rig.leftArm.shoulder.rotation.z, lShoulderZ, lambda, dt);
  rig.leftArm.elbow.rotation.x = damp(rig.leftArm.elbow.rotation.x, lElbowX, lambda, dt);

  // Direct smooth damping on bowling arm during high-speed windmill prevents angle-wrap snapping
  const armLambda = state.phase === 'runup' && state.runupProgress >= 0.8 ? 42 : lambda;
  rig.rightArm.shoulder.rotation.x = damp(rig.rightArm.shoulder.rotation.x, rShoulderX, armLambda, dt);
  rig.rightArm.shoulder.rotation.z = damp(rig.rightArm.shoulder.rotation.z, rShoulderZ, armLambda, dt);
  rig.rightArm.elbow.rotation.x = damp(rig.rightArm.elbow.rotation.x, rElbowX, armLambda, dt);
  rig.rightArm.wrist.rotation.x = damp(rig.rightArm.wrist.rotation.x, rWristX, armLambda, dt);
}

/**
 * Fluid biomechanical Wicketkeeper animation:
 * Deep crouch behind the stumps, tracking ball lateral line, rising with bounce,
 * and snapping webbed gloves together when catching.
 */
export function updateKeeperPose(
  rig: SculptedKeeperRig,
  state: KeeperAnimState,
  dt: number,
  elapsed: number,
): void {
  const lambda = 11;

  // Lateral line tracking during delivery
  const trackX =
    state.phase === 'delivery' || state.phase === 'ballInPlay'
      ? THREE.MathUtils.clamp(state.ballPos.x, -0.58, 0.58)
      : -0.14;
  rig.root.position.x = damp(rig.root.position.x, trackX, 6.5, dt);

  // Rise smoothly with ball bounce as ball nears striker's end
  const nearStriker =
    state.phase === 'delivery' && state.ballPos.z > 2.5
      ? THREE.MathUtils.clamp((state.ballPos.z - 2.5) / 7.5, 0, 1)
      : 0;
  const ballRise = nearStriker * THREE.MathUtils.clamp((state.ballPos.y - 0.55) * 0.35, 0, 0.24);

  const isCatching =
    state.phase === 'ballInPlay' &&
    !state.stumpsBroken &&
    state.lastOutcomeCode === '0' &&
    state.lastTiming === 'MISSED';

  const breathe = Math.sin(elapsed * 2.8) * 0.01;
  const hipsY = isCatching ? 0.68 : 0.56 + ballRise + breathe;
  const kneeBend = isCatching ? 1.05 : 1.48 - ballRise * 1.4;
  const hipFlex = isCatching ? -0.82 : -1.25 + ballRise * 1.1;
  const spinePitch = isCatching ? 0.38 : 0.54 - ballRise * 0.45;
  const headPitch = -spinePitch * 0.78;

  // Cupped keeping gloves snap together when catching
  const gloveSpreadZ = isCatching ? -0.18 : 0.08;
  const armReachX = isCatching ? -0.95 : -0.72;
  const elbowBend = isCatching ? -1.05 : -0.82;

  rig.hips.position.y = damp(rig.hips.position.y, hipsY, lambda, dt);
  rig.spine.rotation.x = damp(rig.spine.rotation.x, spinePitch, lambda, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, headPitch, lambda, dt);

  rig.leftLeg.hip.rotation.x = damp(rig.leftLeg.hip.rotation.x, hipFlex, lambda, dt);
  rig.leftLeg.hip.rotation.z = damp(rig.leftLeg.hip.rotation.z, 0.22, lambda, dt);
  rig.leftLeg.knee.rotation.x = damp(rig.leftLeg.knee.rotation.x, kneeBend, lambda, dt);

  rig.rightLeg.hip.rotation.x = damp(rig.rightLeg.hip.rotation.x, hipFlex, lambda, dt);
  rig.rightLeg.hip.rotation.z = damp(rig.rightLeg.hip.rotation.z, -0.22, lambda, dt);
  rig.rightLeg.knee.rotation.x = damp(rig.rightLeg.knee.rotation.x, kneeBend, lambda, dt);

  rig.leftArm.shoulder.rotation.x = damp(rig.leftArm.shoulder.rotation.x, armReachX, lambda, dt);
  rig.leftArm.shoulder.rotation.z = damp(rig.leftArm.shoulder.rotation.z, gloveSpreadZ, lambda, dt);
  rig.leftArm.elbow.rotation.x = damp(rig.leftArm.elbow.rotation.x, elbowBend, lambda, dt);

  rig.rightArm.shoulder.rotation.x = damp(rig.rightArm.shoulder.rotation.x, armReachX, lambda, dt);
  rig.rightArm.shoulder.rotation.z = damp(rig.rightArm.shoulder.rotation.z, -gloveSpreadZ, lambda, dt);
  rig.rightArm.elbow.rotation.x = damp(rig.rightArm.elbow.rotation.x, elbowBend, lambda, dt);
}
