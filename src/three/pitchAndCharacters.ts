import * as THREE from 'three';
import {
  buildAllCricketCharacters,
  SculptedBatterRig,
  SculptedBowlerRig,
  SculptedKeeperRig,
} from './characterBuilder';
import { createCricketBallTexture, createPitchTexture } from './textures';
import { loadXbotRoster, XbotRosterResult } from './xbotLoader';

export interface StumpRig {
  group: THREE.Group;
  stumps: THREE.Mesh[];
  bails: THREE.Mesh[];
  stumpBasePositions: THREE.Vector3[];
  bailBasePositions: THREE.Vector3[];
}

export interface BallTrail {
  mesh: THREE.InstancedMesh;
  points: THREE.Vector3[];
  activeCount: number;
  opacity: number;
  setActive: (active: boolean) => void;
  pushPoint: (p: THREE.Vector3) => void;
  updateVisuals: (isSix: boolean) => void;
  clear: () => void;
}

export interface DrsProjectionParams {
  releasePos: THREE.Vector3;
  bouncePos: THREE.Vector3;
  impactPos: THREE.Vector3;
  projectedStumpsPos: THREE.Vector3;
  hittingStumps: boolean;
}

export interface PitchAndActorsResult {
  group: THREE.Group;
  pitchMesh: THREE.Mesh;
  strikerStumps: StumpRig;
  bowlerStumps: StumpRig;
  batter: SculptedBatterRig;
  bowler: SculptedBowlerRig;
  keeper: SculptedKeeperRig;
  xbotPromise: Promise<XbotRosterResult>;
  disposeFallbackActors: () => void;
  ball: THREE.Mesh;
  ballShadow: THREE.Mesh;
  pitchMarker: THREE.Group;
  setPitchMarker: (
    x: number,
    z: number,
    opacity: number,
    isAiming?: boolean,
    pulse?: number,
  ) => void;
  showDrsBallTracking: (params: DrsProjectionParams) => void;
  hideDrsBallTracking: () => void;
  trail: BallTrail;
  dispose: () => void;
}

const _upVec = new THREE.Vector3(0, 1, 0);
const _beamDir = new THREE.Vector3();
const _beamMid = new THREE.Vector3();

function alignBeamMesh(
  beam: THREE.Mesh,
  start: THREE.Vector3,
  end: THREE.Vector3,
): void {
  _beamDir.subVectors(end, start);
  const len = _beamDir.length();
  if (len < 0.01) {
    beam.visible = false;
    return;
  }
  beam.visible = true;
  _beamMid.addVectors(start, end).multiplyScalar(0.5);
  beam.position.copy(_beamMid);
  beam.scale.set(1, len, 1);
  _beamDir.divideScalar(len);
  beam.quaternion.setFromUnitVectors(_upVec, _beamDir);
}

export function buildPitchAndCharacters(
  anisotropy: number,
  isSoftwareGl: boolean,
): PitchAndActorsResult {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Detailed Brown Clay Pitch with Crease Markings
  const pitchTex = createPitchTexture(anisotropy);
  const pitchGeo = new THREE.PlaneGeometry(3.05, 23.2);
  pitchGeo.rotateX(-Math.PI / 2);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTex,
    roughness: 0.9,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.position.y = 0.022;
  pitchMesh.receiveShadow = true;
  group.add(pitchMesh);
  disposables.push(pitchTex, pitchGeo, pitchMat);

  // 2. Wooden Stumps & Bails Builder (Both Ends)
  const stumpGeo = new THREE.CylinderGeometry(0.021, 0.023, 0.72, 12);
  stumpGeo.translate(0, 0.36, 0); // pivot at ground base
  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0xe6c280,
    roughness: 0.42,
    metalness: 0.05,
  });
  const bailGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.105, 10);
  bailGeo.rotateZ(Math.PI / 2);
  const bailMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.35,
    metalness: 0.08,
  });
  disposables.push(stumpGeo, stumpMat, bailGeo, bailMat);

  const createStumps = (zPos: number): StumpRig => {
    const sg = new THREE.Group();
    sg.position.set(0, 0.022, zPos);

    const stumpXs = [-0.115, 0, 0.115];
    const stumps: THREE.Mesh[] = [];
    const stumpBasePositions: THREE.Vector3[] = [];

    for (const sx of stumpXs) {
      const m = new THREE.Mesh(stumpGeo, stumpMat);
      m.position.set(sx, 0, 0);
      m.castShadow = !isSoftwareGl;
      sg.add(m);
      stumps.push(m);
      stumpBasePositions.push(new THREE.Vector3(sx, 0, 0));
    }

    const bailXs = [-0.0575, 0.0575];
    const bails: THREE.Mesh[] = [];
    const bailBasePositions: THREE.Vector3[] = [];
    for (const bx of bailXs) {
      const b = new THREE.Mesh(bailGeo, bailMat);
      b.position.set(bx, 0.73, 0);
      b.castShadow = !isSoftwareGl;
      sg.add(b);
      bails.push(b);
      bailBasePositions.push(new THREE.Vector3(bx, 0.73, 0));
    }

    group.add(sg);
    return {
      group: sg,
      stumps,
      bails,
      stumpBasePositions,
      bailBasePositions,
    };
  };

  const strikerStumps = createStumps(10.06);
  const bowlerStumps = createStumps(-10.06);

  // 3. Instant Procedural Fallback Characters while Xbot.glb loads asynchronously
  const roster = buildAllCricketCharacters(anisotropy, isSoftwareGl);
  const fallbackGroup = new THREE.Group();
  fallbackGroup.add(roster.batter.root, roster.bowler.root, roster.keeper.root);
  group.add(fallbackGroup);
  let fallbackDisposed = false;
  const disposeFallbackActors = () => {
    if (fallbackDisposed) return;
    fallbackDisposed = true;
    group.remove(fallbackGroup);
    roster.dispose();
  };

  // Load official rigged Xbot.glb humanoid character cloned via SkeletonUtils
  const xbotPromise = loadXbotRoster(anisotropy, isSoftwareGl);

  // 4. 3D Red Leather Cricket Ball + Contact Shadow + Pitch Bounce Target Reticle
  const ballTex = createCricketBallTexture(anisotropy);
  const ballGeo = new THREE.SphereGeometry(0.062, 24, 24);
  const ballMat = new THREE.MeshPhysicalMaterial({
    map: ballTex,
    roughness: 0.26,
    metalness: 0.06,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.castShadow = !isSoftwareGl;
  group.add(ball);

  const shadowGeo = new THREE.CircleGeometry(0.11, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x050a08,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
  ballShadow.position.y = 0.032;
  group.add(ballShadow);

  // Upgraded Glowing 3D Pitch Target Reticle (concentric neon-yellow / neon-red rings + crosshair)
  const pitchMarker = new THREE.Group();
  pitchMarker.position.y = 0.036;

  const outerRingGeo = new THREE.RingGeometry(0.18, 0.245, 32);
  outerRingGeo.rotateX(-Math.PI / 2);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);

  const innerRingGeo = new THREE.RingGeometry(0.085, 0.132, 28);
  innerRingGeo.rotateX(-Math.PI / 2);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.position.y = 0.001;

  const innerDiscGeo = new THREE.CircleGeometry(0.044, 20);
  innerDiscGeo.rotateX(-Math.PI / 2);
  const innerDiscMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
  innerDisc.position.y = 0.002;

  const crossTickGeo = new THREE.PlaneGeometry(0.032, 0.16);
  crossTickGeo.rotateX(-Math.PI / 2);
  const crossTickMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const tickN = new THREE.Mesh(crossTickGeo, crossTickMat);
  tickN.position.set(0, 0.002, -0.22);
  const tickS = new THREE.Mesh(crossTickGeo, crossTickMat);
  tickS.position.set(0, 0.002, 0.22);
  const tickE = new THREE.Mesh(crossTickGeo, crossTickMat);
  tickE.rotation.y = Math.PI / 2;
  tickE.position.set(0.22, 0.002, 0);
  const tickW = new THREE.Mesh(crossTickGeo, crossTickMat);
  tickW.rotation.y = Math.PI / 2;
  tickW.position.set(-0.22, 0.002, 0);

  pitchMarker.add(outerRing, innerRing, innerDisc, tickN, tickS, tickE, tickW);
  group.add(pitchMarker);

  const setPitchMarker = (
    x: number,
    z: number,
    opacity: number,
    isAiming = false,
    pulse = 1,
  ) => {
    pitchMarker.position.set(x, 0.036, z);
    outerRingMat.color.setHex(isAiming ? 0xfacc15 : 0xfbbf24);
    outerRingMat.opacity = opacity;
    outerRing.scale.setScalar(isAiming ? 1.0 + (pulse - 1) * 0.42 : 0.85);

    innerRingMat.color.setHex(0xef4444);
    innerRingMat.opacity = isAiming ? opacity * 0.95 : opacity * 0.35;
    innerRing.scale.setScalar(isAiming ? 1.0 - (pulse - 1) * 0.25 : 0.85);

    innerDiscMat.color.setHex(isAiming ? 0xfef08a : 0xfbbf24);
    innerDiscMat.opacity = isAiming ? opacity * 0.78 : opacity * 0.22;

    crossTickMat.color.setHex(isAiming ? 0xfacc15 : 0xfbbf24);
    crossTickMat.opacity = isAiming ? opacity * 0.95 : 0;
    pitchMarker.rotation.y = isAiming ? (pulse - 1) * 1.4 : 0;
  };

  disposables.push(
    ballTex,
    ballGeo,
    ballMat,
    shadowGeo,
    shadowMat,
    outerRingGeo,
    outerRingMat,
    innerRingGeo,
    innerRingMat,
    innerDiscGeo,
    innerDiscMat,
    crossTickGeo,
    crossTickMat,
  );

  // 4b. Pre-allocated 3D Hawk-Eye DRS Ball-Tracking Projection Group
  const drsGroup = new THREE.Group();
  drsGroup.visible = false;
  group.add(drsGroup);

  const unitCylGeo = new THREE.CylinderGeometry(0.034, 0.034, 1, 14);
  const actualBeamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8, // Hawk-Eye Cyan
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const projectedBeamMat = new THREE.MeshBasicMaterial({
    color: 0xef4444, // Red when hitting stumps, emerald when missing
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const drsRingGeo = new THREE.RingGeometry(0.08, 0.16, 24);
  drsRingGeo.rotateX(-Math.PI / 2);
  const drsBounceMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const drsImpactGeo = new THREE.SphereGeometry(0.075, 16, 16);
  const drsImpactMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.92,
  });
  const drsStumpRingGeo = new THREE.RingGeometry(0.09, 0.165, 24);
  const drsStumpRingMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const preBounceBeam = new THREE.Mesh(unitCylGeo, actualBeamMat);
  const postBounceBeam = new THREE.Mesh(unitCylGeo, actualBeamMat);
  const projectedBeam = new THREE.Mesh(unitCylGeo, projectedBeamMat);
  const drsBounceRing = new THREE.Mesh(drsRingGeo, drsBounceMat);
  const drsImpactOrb = new THREE.Mesh(drsImpactGeo, drsImpactMat);
  const drsStumpRing = new THREE.Mesh(drsStumpRingGeo, drsStumpRingMat);

  drsGroup.add(
    preBounceBeam,
    postBounceBeam,
    projectedBeam,
    drsBounceRing,
    drsImpactOrb,
    drsStumpRing,
  );
  disposables.push(
    unitCylGeo,
    actualBeamMat,
    projectedBeamMat,
    drsRingGeo,
    drsBounceMat,
    drsImpactGeo,
    drsImpactMat,
    drsStumpRingGeo,
    drsStumpRingMat,
  );

  const showDrsBallTracking = (params: DrsProjectionParams) => {
    drsGroup.visible = true;
    alignBeamMesh(preBounceBeam, params.releasePos, params.bouncePos);
    alignBeamMesh(postBounceBeam, params.bouncePos, params.impactPos);
    alignBeamMesh(projectedBeam, params.impactPos, params.projectedStumpsPos);

    projectedBeamMat.color.setHex(params.hittingStumps ? 0xef4444 : 0x22c55e);
    drsStumpRingMat.color.setHex(params.hittingStumps ? 0xef4444 : 0x22c55e);

    drsBounceRing.position.set(params.bouncePos.x, 0.042, params.bouncePos.z);
    drsImpactOrb.position.copy(params.impactPos);
    drsStumpRing.position.copy(params.projectedStumpsPos);
  };

  const hideDrsBallTracking = () => {
    drsGroup.visible = false;
  };

  // 5. Glowing Ball Trail (for 6s & 4s) via InstancedMesh
  const maxTrail = 28;
  const trailGeo = new THREE.SphereGeometry(0.085, 10, 10);
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, maxTrail);
  trailMesh.frustumCulled = false;
  trailMesh.visible = false;
  group.add(trailMesh);
  disposables.push(trailGeo, trailMat);

  const points: THREE.Vector3[] = Array.from(
    { length: maxTrail },
    () => new THREE.Vector3(),
  );
  const dummy = new THREE.Object3D();
  let activeCount = 0;
  let isActive = false;

  const trail: BallTrail = {
    mesh: trailMesh,
    points,
    activeCount: 0,
    opacity: 0,
    setActive(active: boolean) {
      isActive = active;
      trailMesh.visible = active;
      if (!active) {
        activeCount = 0;
        this.activeCount = 0;
      }
    },
    pushPoint(p: THREE.Vector3) {
      if (!isActive) return;
      for (let i = maxTrail - 1; i > 0; i--) {
        points[i].copy(points[i - 1]);
      }
      points[0].copy(p);
      activeCount = Math.min(maxTrail, activeCount + 1);
      this.activeCount = activeCount;
    },
    updateVisuals(isSix: boolean) {
      if (!isActive || activeCount === 0) return;
      trailMat.color.setHex(isSix ? 0xfbbf24 : 0x34d399);
      for (let i = 0; i < maxTrail; i++) {
        if (i >= activeCount) {
          dummy.scale.setScalar(0.0001);
        } else {
          const t = 1 - i / maxTrail;
          dummy.position.copy(points[i]);
          dummy.scale.setScalar((isSix ? 1.15 : 0.78) * t);
        }
        dummy.updateMatrix();
        trailMesh.setMatrixAt(i, dummy.matrix);
      }
      trailMesh.instanceMatrix.needsUpdate = true;
    },
    clear() {
      this.setActive(false);
    },
  };

  return {
    group,
    pitchMesh,
    strikerStumps,
    bowlerStumps,
    batter: roster.batter,
    bowler: roster.bowler,
    keeper: roster.keeper,
    xbotPromise,
    disposeFallbackActors,
    ball,
    ballShadow,
    pitchMarker,
    setPitchMarker,
    showDrsBallTracking,
    hideDrsBallTracking,
    trail,
    dispose: () => {
      disposeFallbackActors();
      disposables.forEach((d) => d.dispose());
    },
  };
}
