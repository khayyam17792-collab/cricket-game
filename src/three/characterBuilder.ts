import * as THREE from 'three';
import { PlayerCustomization, TEAM_KITS } from '../types/game';
import {
  createJerseyTexture,
  createLegPadTexture,
  createWillowBatTexture,
  JerseyTextureConfig,
} from './textures';

export interface HumanArmPivots {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
}

export interface HumanLegPivots {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
}

export interface HumanBodyRig {
  root: THREE.Group;
  contactShadow: THREE.Mesh;
  hips: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  leftArm: HumanArmPivots;
  rightArm: HumanArmPivots;
  leftLeg: HumanLegPivots;
  rightLeg: HumanLegPivots;
}

export interface SculptedBatterRig extends HumanBodyRig {
  batControl: THREE.Group;
  batMeshGroup: THREE.Group;
  batCollider: THREE.Mesh;
  topGripAnchor: THREE.Object3D;
  bottomGripAnchor: THREE.Object3D;
  applyCustomization: (profile: PlayerCustomization) => void;
}

export interface SculptedBowlerRig extends HumanBodyRig {
  ballHandAnchor: THREE.Object3D;
}

export interface SculptedKeeperRig extends HumanBodyRig {
  leftGloveAnchor: THREE.Object3D;
  rightGloveAnchor: THREE.Object3D;
}

export const ARM_UPPER_LEN = 0.28;
export const ARM_LOWER_LEN = 0.26;
export const LEG_THIGH_LEN = 0.42;
export const LEG_SHIN_LEN = 0.395;

/**
 * Soft radial ground contact shadow texture (cached per builder call).
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    6,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, 'rgba(3, 8, 12, 0.62)');
  g.addColorStop(0.5, 'rgba(3, 8, 12, 0.28)');
  g.addColorStop(1, 'rgba(3, 8, 12, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Anatomically tapered athletic torso LatheGeometry.
 * Profile runs bottom (waist y=0) -> top (collar y=0.56) so CanvasTexture v=1 (top)
 * maps to collar/name/number and rotated +PI/2 puts Back at -Z and Chest at +Z.
 */
function createTorsoGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.142, 0.015),
    new THREE.Vector2(0.138, 0.09), // tapered athletic waist
    new THREE.Vector2(0.156, 0.21), // obliques
    new THREE.Vector2(0.188, 0.34), // ribcage / lats
    new THREE.Vector2(0.206, 0.44), // broad chest & deltoid shelf
    new THREE.Vector2(0.172, 0.5), // upper trapezius slope
    new THREE.Vector2(0.088, 0.545), // collar opening
    new THREE.Vector2(0.01, 0.555),
  ];
  const geo = new THREE.LatheGeometry(pts, 24);
  geo.rotateY(Math.PI / 2);
  geo.scale(1.18, 1.0, 0.74);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tapered pelvic/hip block matching athletic trousers.
 */
function createPelvisGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.01, -0.07),
    new THREE.Vector2(0.125, -0.05),
    new THREE.Vector2(0.162, 0.01),
    new THREE.Vector2(0.156, 0.08),
    new THREE.Vector2(0.01, 0.095),
  ];
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.scale(1.12, 1.0, 0.78);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted limb segment tapering from top (y=0) down to bottom (y=-length).
 */
function createLimbLathe(
  length: number,
  radii: Array<[number, number]>,
  segments = 14,
): THREE.BufferGeometry {
  const pts = radii.map(
    ([t, r]) => new THREE.Vector2(r, -t * length),
  );
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted cricket bat blade with curved edges, spine ridge, and UV-mapped willow face.
 */
function createCricketBatBladeGeometry(): THREE.BufferGeometry {
  const bladeH = 0.56;
  const halfW = 0.055;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW * 0.72, 0);
  shape.lineTo(halfW * 0.72, 0);
  shape.quadraticCurveTo(halfW, -0.04, halfW, -0.09);
  shape.lineTo(halfW, -bladeH + 0.06);
  shape.quadraticCurveTo(halfW * 0.85, -bladeH - 0.01, 0, -bladeH - 0.018);
  shape.quadraticCurveTo(-halfW * 0.85, -bladeH - 0.01, -halfW, -bladeH + 0.06);
  shape.lineTo(-halfW, -0.09);
  shape.quadraticCurveTo(-halfW, -0.04, -halfW * 0.72, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 10,
  });
  // Center depth around Z=0
  geo.translate(0, 0, -0.016);

  // Sculpt sweet-spot ridge swell along the back (-Z) & planarize UVs into [0..1]
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z < 0) {
      const xRatio = Math.max(0, 1 - Math.abs(x) / (halfW + 0.01));
      const yRatio = Math.sin(THREE.MathUtils.clamp(-y / bladeH, 0, 1) * Math.PI);
      pos.setZ(i, z - 0.018 * xRatio * yRatio);
    }
    if (uv) {
      const u = THREE.MathUtils.clamp((x + halfW + 0.008) / ((halfW + 0.008) * 2), 0, 1);
      const v = THREE.MathUtils.clamp(1 + y / (bladeH + 0.025), 0, 1);
      uv.setXY(i, u, v);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved half-cylinder leg pad wrapping the front (+Z) of the shin.
 */
function createLegPadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(
    0.088,
    0.072,
    0.48,
    14,
    4,
    false,
    -Math.PI * 0.68,
    Math.PI * 1.36,
  );
  // Slight knee-roll flare near top
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > 0.14 && z > 0) {
      pos.setZ(i, z * 1.18);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

interface SharedCharacterAssets {
  torsoGeo: THREE.BufferGeometry;
  pelvisGeo: THREE.BufferGeometry;
  thighGeo: THREE.BufferGeometry;
  shinGeo: THREE.BufferGeometry;
  upperArmGeo: THREE.BufferGeometry;
  forearmGeo: THREE.BufferGeometry;
  sleeveGeo: THREE.BufferGeometry;
  jointSphereGeo: THREE.BufferGeometry;
  neckGeo: THREE.BufferGeometry;
  headGeo: THREE.BufferGeometry;
  jawGeo: THREE.BufferGeometry;
  shoeUpperGeo: THREE.BufferGeometry;
  shoeSoleGeo: THREE.BufferGeometry;
  cleatStudGeo: THREE.BufferGeometry;
  shadowPlaneGeo: THREE.BufferGeometry;
  shadowMat: THREE.MeshBasicMaterial;
  trouserWhiteMat: THREE.MeshStandardMaterial;
  trouserNavyMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  shoeAccentMat: THREE.MeshStandardMaterial;
  soleMat: THREE.MeshStandardMaterial;
  sunglassLensMat: THREE.MeshStandardMaterial;
  sunglassFrameMat: THREE.MeshStandardMaterial;
  disposeList: Array<{ dispose: () => void }>;
}

function createSharedCharacterAssets(): SharedCharacterAssets {
  const disposeList: Array<{ dispose: () => void }> = [];

  const torsoGeo = createTorsoGeometry();
  const pelvisGeo = createPelvisGeometry();
  const thighGeo = createLimbLathe(
    LEG_THIGH_LEN,
    [
      [0.0, 0.086],
      [0.25, 0.092],
      [0.65, 0.078],
      [0.95, 0.062],
      [1.0, 0.056],
    ],
    14,
  );
  const shinGeo = createLimbLathe(
    LEG_SHIN_LEN,
    [
      [0.0, 0.062],
      [0.28, 0.069], // calf muscle belly
      [0.62, 0.053],
      [0.95, 0.042], // ankle
      [1.0, 0.04],
    ],
    14,
  );
  const upperArmGeo = createLimbLathe(
    ARM_UPPER_LEN,
    [
      [0.0, 0.058], // deltoid cap
      [0.32, 0.055], // bicep
      [0.78, 0.046],
      [1.0, 0.042], // elbow
    ],
    12,
  );
  const forearmGeo = createLimbLathe(
    ARM_LOWER_LEN,
    [
      [0.0, 0.045],
      [0.25, 0.047], // brachioradialis
      [0.75, 0.036],
      [1.0, 0.031], // wrist
    ],
    12,
  );
  const sleeveGeo = new THREE.CylinderGeometry(0.066, 0.061, 0.16, 14);
  sleeveGeo.translate(0, -0.075, 0);

  const jointSphereGeo = new THREE.SphereGeometry(0.054, 12, 10);
  const neckGeo = new THREE.CylinderGeometry(0.046, 0.055, 0.11, 12);
  neckGeo.translate(0, 0.04, 0);

  const headGeo = new THREE.SphereGeometry(0.108, 18, 16);
  headGeo.scale(0.9, 1.08, 0.98);
  const jawGeo = new THREE.CapsuleGeometry(0.058, 0.05, 4, 10);
  jawGeo.scale(1.02, 0.9, 1.15);

  const shoeUpperGeo = new THREE.CapsuleGeometry(0.048, 0.145, 5, 10);
  shoeUpperGeo.rotateX(Math.PI / 2);
  shoeUpperGeo.scale(1.06, 0.78, 1.0);
  const shoeSoleGeo = new THREE.BoxGeometry(0.105, 0.022, 0.245);
  const cleatStudGeo = new THREE.ConeGeometry(0.008, 0.014, 6);
  cleatStudGeo.rotateX(Math.PI);

  const shadowTex = createContactShadowTexture();
  const shadowPlaneGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  const trouserWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xeff3f8,
    roughness: 0.74,
    metalness: 0.02,
  });
  const trouserNavyMat = new THREE.MeshStandardMaterial({
    color: 0x0b2545,
    roughness: 0.72,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc98a63,
    roughness: 0.58,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x16161a,
    roughness: 0.84,
    metalness: 0.04,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.42,
    metalness: 0.08,
  });
  const shoeAccentMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.38,
    metalness: 0.16,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.78,
    metalness: 0.08,
  });
  const sunglassLensMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
  });
  const sunglassFrameMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.28,
    metalness: 0.75,
  });

  disposeList.push(
    torsoGeo,
    pelvisGeo,
    thighGeo,
    shinGeo,
    upperArmGeo,
    forearmGeo,
    sleeveGeo,
    jointSphereGeo,
    neckGeo,
    headGeo,
    jawGeo,
    shoeUpperGeo,
    shoeSoleGeo,
    cleatStudGeo,
    shadowTex,
    shadowPlaneGeo,
    shadowMat,
    trouserWhiteMat,
    trouserNavyMat,
    skinMat,
    hairMat,
    shoeMat,
    shoeAccentMat,
    soleMat,
    sunglassLensMat,
    sunglassFrameMat,
  );

  return {
    torsoGeo,
    pelvisGeo,
    thighGeo,
    shinGeo,
    upperArmGeo,
    forearmGeo,
    sleeveGeo,
    jointSphereGeo,
    neckGeo,
    headGeo,
    jawGeo,
    shoeUpperGeo,
    shoeSoleGeo,
    cleatStudGeo,
    shadowPlaneGeo,
    shadowMat,
    trouserWhiteMat,
    trouserNavyMat,
    skinMat,
    hairMat,
    shoeMat,
    shoeAccentMat,
    soleMat,
    sunglassLensMat,
    sunglassFrameMat,
    disposeList,
  };
}

function buildCricketCleat(
  assets: SharedCharacterAssets,
  accentMat: THREE.Material,
  castShadow: boolean,
): THREE.Group {
  const shoe = new THREE.Group();
  const upper = new THREE.Mesh(assets.shoeUpperGeo, assets.shoeMat);
  upper.position.set(0, -0.042, 0.042);
  upper.castShadow = castShadow;

  const sole = new THREE.Mesh(assets.shoeSoleGeo, assets.soleMat);
  sole.position.set(0, -0.074, 0.045);

  const stripe = new THREE.Mesh(assets.shoeSoleGeo, accentMat);
  stripe.scale.set(1.03, 0.55, 0.78);
  stripe.position.set(0, -0.062, 0.036);

  // Front & heel spikes
  const studPositions: Array<[number, number]> = [
    [-0.03, 0.12],
    [0.03, 0.12],
    [-0.03, -0.04],
    [0.03, -0.04],
  ];
  for (const [sx, sz] of studPositions) {
    const stud = new THREE.Mesh(assets.cleatStudGeo, assets.soleMat);
    stud.position.set(sx, -0.088, sz);
    shoe.add(stud);
  }

  shoe.add(upper, sole, stripe);
  return shoe;
}

interface BaseRigMaterials {
  jerseyMat: THREE.MeshStandardMaterial;
  sleeveMat: THREE.MeshStandardMaterial;
  sleeveTrimMat: THREE.MeshStandardMaterial;
}

function buildHumanBaseRig(
  assets: SharedCharacterAssets,
  anisotropy: number,
  jerseyCfg: JerseyTextureConfig,
  trouserMat: THREE.Material,
  shoeAccentMat: THREE.Material,
  castShadow: boolean,
  disposeList: Array<{ dispose: () => void }>,
): HumanBodyRig & { materials: BaseRigMaterials } {
  const root = new THREE.Group();

  const contactShadow = new THREE.Mesh(assets.shadowPlaneGeo, assets.shadowMat);
  contactShadow.position.set(0, 0.012, 0);
  root.add(contactShadow);

  const jerseyTex = createJerseyTexture(anisotropy, jerseyCfg);
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.68,
    metalness: 0.04,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: jerseyCfg.primaryColor,
    roughness: 0.68,
    metalness: 0.04,
  });
  const sleeveTrimMat = new THREE.MeshStandardMaterial({
    color: jerseyCfg.accentColor,
    roughness: 0.52,
    metalness: 0.08,
  });
  disposeList.push(jerseyTex, jerseyMat, sleeveMat, sleeveTrimMat);

  // Hips root (y = 0.90 in upright athletic posture)
  const hips = new THREE.Group();
  hips.position.set(0, 0.9, 0);
  root.add(hips);

  const pelvisMesh = new THREE.Mesh(assets.pelvisGeo, trouserMat);
  pelvisMesh.castShadow = castShadow;
  hips.add(pelvisMesh);

  // Spine & Torso
  const spine = new THREE.Group();
  spine.position.set(0, 0.03, 0);
  hips.add(spine);

  const torsoMesh = new THREE.Mesh(assets.torsoGeo, jerseyMat);
  torsoMesh.castShadow = castShadow;
  spine.add(torsoMesh);

  // Neck & Head
  const neck = new THREE.Group();
  neck.position.set(0, 0.535, 0.01);
  spine.add(neck);

  const neckMesh = new THREE.Mesh(assets.neckGeo, assets.skinMat);
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.115, 0.012);
  neck.add(head);

  const cranium = new THREE.Mesh(assets.headGeo, assets.skinMat);
  cranium.castShadow = castShadow;
  const jaw = new THREE.Mesh(assets.jawGeo, assets.skinMat);
  jaw.position.set(0, -0.042, 0.024);
  jaw.rotation.x = 0.25;
  head.add(cranium, jaw);

  // Helper to build Left / Right Arms
  const buildArm = (side: -1 | 1): HumanArmPivots => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.232, 0.455, -0.005);
    spine.add(shoulder);

    const shoulderCap = new THREE.Mesh(assets.jointSphereGeo, sleeveMat);
    shoulderCap.scale.setScalar(1.06);
    const sleeve = new THREE.Mesh(assets.sleeveGeo, sleeveMat);
    sleeve.castShadow = castShadow;
    const cuff = new THREE.Mesh(assets.sleeveGeo, sleeveTrimMat);
    cuff.scale.set(1.04, 0.16, 1.04);
    cuff.position.y = -0.14;

    const upperArm = new THREE.Mesh(assets.upperArmGeo, assets.skinMat);
    upperArm.castShadow = castShadow;
    shoulder.add(shoulderCap, sleeve, cuff, upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -ARM_UPPER_LEN, 0);
    shoulder.add(elbow);

    const elbowCap = new THREE.Mesh(assets.jointSphereGeo, assets.skinMat);
    elbowCap.scale.setScalar(0.76);
    const forearm = new THREE.Mesh(assets.forearmGeo, assets.skinMat);
    forearm.castShadow = castShadow;
    elbow.add(elbowCap, forearm);

    const wrist = new THREE.Group();
    wrist.position.set(0, -ARM_LOWER_LEN, 0);
    elbow.add(wrist);

    return { shoulder, elbow, wrist };
  };

  // Helper to build Left / Right Legs
  const buildLeg = (side: -1 | 1): HumanLegPivots => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.108, -0.015, 0);
    hips.add(hip);

    const hipCap = new THREE.Mesh(assets.jointSphereGeo, trouserMat);
    hipCap.scale.setScalar(1.45);
    const thigh = new THREE.Mesh(assets.thighGeo, trouserMat);
    thigh.castShadow = castShadow;
    hip.add(hipCap, thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -LEG_THIGH_LEN, 0);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(assets.jointSphereGeo, trouserMat);
    kneeCap.scale.setScalar(1.1);
    const shin = new THREE.Mesh(assets.shinGeo, trouserMat);
    shin.castShadow = castShadow;
    knee.add(kneeCap, shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -LEG_SHIN_LEN, 0);
    knee.add(ankle);

    const cleat = buildCricketCleat(assets, shoeAccentMat, castShadow);
    ankle.add(cleat);

    return { hip, knee, ankle };
  };

  const leftArm = buildArm(1);
  const rightArm = buildArm(-1);
  const leftLeg = buildLeg(1);
  const rightLeg = buildLeg(-1);

  return {
    root,
    contactShadow,
    hips,
    spine,
    neck,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    materials: { jerseyMat, sleeveMat, sleeveTrimMat },
  };
}

/**
 * Builds sculpted segmented batting/keeping glove mesh for a hand wrist.
 */
function buildBattingGlove(
  primaryColor: number,
  accentColor: number,
  side: -1 | 1,
  disposeList: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();

  const whiteMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.48,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.42,
    metalness: 0.12,
  });
  const palmMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
    metalness: 0.02,
  });
  disposeList.push(whiteMat, trimMat, palmMat);

  const cuffGeo = new THREE.CylinderGeometry(0.036, 0.038, 0.055, 10);
  const palmGeo = new THREE.BoxGeometry(0.052, 0.072, 0.074);
  const fingerGeo = new THREE.CapsuleGeometry(0.013, 0.038, 4, 8);
  const thumbGeo = new THREE.CapsuleGeometry(0.013, 0.032, 4, 8);
  disposeList.push(cuffGeo, palmGeo, fingerGeo, thumbGeo);

  const cuff = new THREE.Mesh(cuffGeo, trimMat);
  cuff.position.set(0, 0.015, 0);
  const palm = new THREE.Mesh(palmGeo, palmMat);
  palm.position.set(0, -0.045, 0.008);
  g.add(cuff, palm);

  // 4 segmented padded dorsal finger rolls
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fingerGeo, i % 2 === 0 ? whiteMat : trimMat);
    f.position.set(
      side * 0.022,
      -0.058 - i * 0.004,
      -0.022 + i * 0.021,
    );
    f.rotation.z = side * 0.25;
    g.add(f);
  }

  const thumb = new THREE.Mesh(thumbGeo, whiteMat);
  thumb.position.set(-side * 0.025, -0.048, 0.038);
  thumb.rotation.x = 0.55;
  g.add(thumb);

  return g;
}

/**
 * Builds detailed cricket helmet with curved peak, chin strap, and metallic TubeGeometry grille.
 */
function buildCricketHelmet(
  shellColor: number,
  accentColor: number,
  disposeList: Array<{ dispose: () => void }>,
): {
  helmet: THREE.Group;
  shellMat: THREE.MeshPhysicalMaterial;
  strapMat: THREE.MeshStandardMaterial;
} {
  const helmet = new THREE.Group();

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: shellColor,
    roughness: 0.22,
    metalness: 0.25,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
  });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.88,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.65,
    metalness: 0.05,
  });
  disposeList.push(shellMat, grilleMat, strapMat);

  // Outer helmet shell dome
  const domeGeo = new THREE.SphereGeometry(
    0.128,
    20,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.62,
  );
  domeGeo.scale(0.95, 1.04, 1.04);
  const dome = new THREE.Mesh(domeGeo, shellMat);
  dome.position.set(0, 0.015, -0.004);
  helmet.add(dome);

  // Ear guards wrapping left/right cheek
  const earGeo = new THREE.BoxGeometry(0.02, 0.095, 0.09);
  const earL = new THREE.Mesh(earGeo, shellMat);
  earL.position.set(-0.114, -0.035, 0.01);
  const earR = new THREE.Mesh(earGeo, shellMat);
  earR.position.set(0.114, -0.035, 0.01);
  helmet.add(earL, earR);

  // Curved front visor peak
  const peakGeo = new THREE.CylinderGeometry(
    0.132,
    0.148,
    0.022,
    18,
    1,
    true,
    -Math.PI * 0.34,
    Math.PI * 0.68,
  );
  const peak = new THREE.Mesh(peakGeo, shellMat);
  peak.position.set(0, 0.038, 0.028);
  peak.rotation.x = 0.22;
  helmet.add(peak);

  // Metallic TubeGeometry face grille bars (upper horizontal, lower horizontal, chin bar, center struts)
  const barCurves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.11, 0.015, 0.02),
      new THREE.Vector3(-0.07, 0.008, 0.138),
      new THREE.Vector3(0, 0.005, 0.156),
      new THREE.Vector3(0.07, 0.008, 0.138),
      new THREE.Vector3(0.11, 0.015, 0.02),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.105, -0.032, 0.02),
      new THREE.Vector3(-0.068, -0.036, 0.136),
      new THREE.Vector3(0, -0.038, 0.154),
      new THREE.Vector3(0.068, -0.036, 0.136),
      new THREE.Vector3(0.105, -0.032, 0.02),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.098, -0.078, 0.022),
      new THREE.Vector3(0, -0.084, 0.145),
      new THREE.Vector3(0.098, -0.078, 0.022),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.045, 0.035, 0.132),
      new THREE.Vector3(-0.045, -0.078, 0.134),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.045, 0.035, 0.132),
      new THREE.Vector3(0.045, -0.078, 0.134),
    ]),
  ];

  for (const curve of barCurves) {
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.0045, 6, false);
    const bar = new THREE.Mesh(tubeGeo, grilleMat);
    helmet.add(bar);
    disposeList.push(tubeGeo);
  }

  // Chin strap & cup
  const strapGeo = new THREE.TorusGeometry(0.105, 0.007, 6, 16, Math.PI * 0.92);
  const strap = new THREE.Mesh(strapGeo, strapMat);
  strap.position.set(0, -0.032, 0.018);
  strap.rotation.x = Math.PI * 0.58;
  strap.rotation.z = Math.PI * 0.04;
  helmet.add(strap);

  disposeList.push(domeGeo, earGeo, peakGeo, strapGeo);
  return { helmet, shellMat, strapMat };
}

export interface CharacterRosterResult {
  batter: SculptedBatterRig;
  bowler: SculptedBowlerRig;
  keeper: SculptedKeeperRig;
  dispose: () => void;
}

export function buildAllCricketCharacters(
  anisotropy: number,
  isSoftwareGl: boolean,
): CharacterRosterResult {
  const castShadow = !isSoftwareGl;
  const assets = createSharedCharacterAssets();
  const disposeList = assets.disposeList;

  // =========================================================
  // 1. BATTER (#56 STRIKER) — Navy/Emerald Kit + Full Batting Gear
  // =========================================================
  const batterBody = buildHumanBaseRig(
    assets,
    anisotropy,
    {
      primaryColor: '#0f4c81',
      secondaryColor: '#082f52',
      accentColor: '#10b981',
      collarColor: '#10b981',
      playerName: 'STRIKER',
      playerNumber: '56',
      sponsorText: 'APEX T20',
    },
    assets.trouserNavyMat,
    assets.shoeAccentMat,
    castShadow,
    disposeList,
  );
  batterBody.root.position.set(-0.52, 0.022, 8.84);

  // Batting Helmet
  const { helmet, shellMat: helmetShellMat, strapMat: helmetStrapMat } =
    buildCricketHelmet(0x064e3b, 0xfbbf24, disposeList);
  batterBody.head.add(helmet);

  // Ribbed White Leg Pads + Thigh Guard
  const padTex = createLegPadTexture(anisotropy);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.44,
    metalness: 0.04,
  });
  const padGeo = createLegPadGeometry();
  const thighGuardGeo = new THREE.CapsuleGeometry(0.068, 0.16, 4, 8);
  thighGuardGeo.scale(1.1, 1, 0.45);
  disposeList.push(padTex, padMat, padGeo, thighGuardGeo);

  const leftPad = new THREE.Mesh(padGeo, padMat);
  leftPad.position.set(0, -0.175, 0.018);
  leftPad.castShadow = castShadow;
  batterBody.leftLeg.knee.add(leftPad);

  const rightPad = new THREE.Mesh(padGeo, padMat);
  rightPad.position.set(0, -0.175, 0.018);
  rightPad.castShadow = castShadow;
  batterBody.rightLeg.knee.add(rightPad);

  // Molded thigh guard on front (left) thigh
  const thighGuard = new THREE.Mesh(thighGuardGeo, padMat);
  thighGuard.position.set(-0.035, -0.2, 0.07);
  batterBody.leftLeg.hip.add(thighGuard);

  // Segmented Padded Batting Gloves
  const lGlove = buildBattingGlove(0xf8fafc, 0x10b981, 1, disposeList);
  const rGlove = buildBattingGlove(0xf8fafc, 0x10b981, -1, disposeList);
  batterBody.leftArm.wrist.add(lGlove);
  batterBody.rightArm.wrist.add(rGlove);

  // Sculpted English-Willow Cricket Bat mounted on batControl inside spine
  const batControl = new THREE.Group();
  batControl.position.set(0.16, 0.18, 0.24);
  batterBody.spine.add(batControl);

  const batMeshGroup = new THREE.Group();
  batControl.add(batMeshGroup);

  const willowTex = createWillowBatTexture(anisotropy);
  const willowMat = new THREE.MeshStandardMaterial({
    map: willowTex,
    roughness: 0.36,
    metalness: 0.04,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.82,
    metalness: 0.02,
  });
  const gripRingMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.88,
    metalness: 0.02,
  });
  const batBladeGeo = createCricketBatBladeGeometry();
  const batHandleGeo = new THREE.CylinderGeometry(0.016, 0.019, 0.27, 12);
  batHandleGeo.translate(0, 0.135, 0);
  const gripRingGeo = new THREE.TorusGeometry(0.0185, 0.0028, 6, 12);
  gripRingGeo.rotateX(Math.PI / 2);

  const batBlade = new THREE.Mesh(batBladeGeo, willowMat);
  batBlade.castShadow = castShadow;
  const batHandle = new THREE.Mesh(batHandleGeo, handleMat);

  const batColliderGeo = new THREE.BoxGeometry(0.13, 0.58, 0.06);
  const batColliderMat = new THREE.MeshBasicMaterial({ visible: false });
  const batCollider = new THREE.Mesh(batColliderGeo, batColliderMat);
  batCollider.position.set(0, -0.30, 0);
  batCollider.visible = false;

  batMeshGroup.add(batBlade, batHandle, batCollider);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(gripRingGeo, gripRingMat);
    ring.position.y = 0.06 + i * 0.036;
    batMeshGroup.add(ring);
  }

  // Exact handle grip anchors for 2-bone analytical arm IK
  const topGripAnchor = new THREE.Object3D();
  topGripAnchor.position.set(0, 0.22, 0.005);
  const bottomGripAnchor = new THREE.Object3D();
  bottomGripAnchor.position.set(0, 0.115, 0.005);
  batMeshGroup.add(topGripAnchor, bottomGripAnchor);

  disposeList.push(
    willowTex,
    willowMat,
    handleMat,
    gripRingMat,
    batBladeGeo,
    batHandleGeo,
    gripRingGeo,
    batColliderGeo,
    batColliderMat,
  );

  const applyCustomization = (profile: PlayerCustomization) => {
    const kit = TEAM_KITS[profile.kitId] ?? TEAM_KITS['green-gold'];
    const safeName = (profile.playerName || 'STRIKER').trim().slice(0, 12) || 'STRIKER';
    const safeNumber = (profile.jerseyNumber || '56').trim().slice(0, 3) || '56';

    const oldMap = batterBody.materials.jerseyMat.map;
    const newTex = createJerseyTexture(anisotropy, {
      primaryColor: kit.jerseyMain,
      secondaryColor: kit.trouserMain,
      accentColor: kit.jerseyAccent,
      collarColor: kit.jerseyAccent,
      playerName: safeName,
      playerNumber: safeNumber,
      sponsorText: 'DEVFEST T20',
    });
    batterBody.materials.jerseyMat.map = newTex;
    batterBody.materials.jerseyMat.needsUpdate = true;
    if (oldMap && oldMap !== newTex) {
      oldMap.dispose();
    }
    batterBody.materials.sleeveMat.color.set(kit.jerseyMain);
    batterBody.materials.sleeveTrimMat.color.set(kit.jerseyAccent);
    helmetShellMat.color.setHex(kit.helmetHex);
    helmetStrapMat.color.setHex(kit.accentHex);
    handleMat.color.setHex(kit.accentHex);
  };

  const batter: SculptedBatterRig = {
    ...batterBody,
    batControl,
    batMeshGroup,
    batCollider,
    topGripAnchor,
    bottomGripAnchor,
    applyCustomization,
  };

  // =========================================================
  // 2. BOWLER (#10 PACE) — Crimson/Gold Kit + Headband + Sunglasses + Sweatband
  // =========================================================
  const bowlerBody = buildHumanBaseRig(
    assets,
    anisotropy,
    {
      primaryColor: '#b91c1c',
      secondaryColor: '#7f1d1d',
      accentColor: '#fbbf24',
      collarColor: '#fbbf24',
      playerName: 'PACE',
      playerNumber: '10',
      sponsorText: 'NOVA AIR',
    },
    assets.trouserWhiteMat,
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.12,
    }),
    castShadow,
    disposeList,
  );
  bowlerBody.root.position.set(0.42, 0.022, -22.2);

  // Sculpted athletic hair + headband + wraparound sports sunglasses
  const hairCrownGeo = new THREE.SphereGeometry(
    0.116,
    16,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.56,
  );
  hairCrownGeo.scale(0.94, 1.08, 1.02);
  const hairCrown = new THREE.Mesh(hairCrownGeo, assets.hairMat);
  hairCrown.position.set(0, 0.018, -0.008);

  const headbandGeo = new THREE.TorusGeometry(0.108, 0.014, 8, 20);
  headbandGeo.rotateX(Math.PI / 2);
  headbandGeo.scale(0.95, 1.02, 1.0);
  const headbandMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.65,
    metalness: 0.05,
  });
  const headband = new THREE.Mesh(headbandGeo, headbandMat);
  headband.position.set(0, 0.042, 0.004);

  // Wraparound sports sunglasses
  const lensGeo = new THREE.CylinderGeometry(
    0.106,
    0.106,
    0.032,
    14,
    1,
    true,
    -Math.PI * 0.28,
    Math.PI * 0.56,
  );
  const lenses = new THREE.Mesh(lensGeo, assets.sunglassLensMat);
  lenses.position.set(0, 0.008, 0.012);
  const frameBarGeo = new THREE.TorusGeometry(0.107, 0.004, 6, 14, Math.PI * 0.62);
  const frameBar = new THREE.Mesh(frameBarGeo, assets.sunglassFrameMat);
  frameBar.position.set(0, 0.024, 0.012);
  frameBar.rotation.x = Math.PI / 2;
  frameBar.rotation.z = -Math.PI * 0.81;

  bowlerBody.head.add(hairCrown, headband, lenses, frameBar);

  // Wrist sweatband & bare hands
  const wristBandGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.052, 10);
  const wristBand = new THREE.Mesh(wristBandGeo, headbandMat);
  wristBand.position.y = 0.018;
  bowlerBody.rightArm.wrist.add(wristBand);

  const handGeo = new THREE.CapsuleGeometry(0.028, 0.048, 4, 8);
  handGeo.scale(0.9, 1, 1.25);
  const bwHandL = new THREE.Mesh(handGeo, assets.skinMat);
  bwHandL.position.set(0, -0.045, 0.006);
  const bwHandR = new THREE.Mesh(handGeo, assets.skinMat);
  bwHandR.position.set(0, -0.045, 0.006);
  bowlerBody.leftArm.wrist.add(bwHandL);
  bowlerBody.rightArm.wrist.add(bwHandR);

  const ballHandAnchor = new THREE.Object3D();
  ballHandAnchor.position.set(0, -0.068, 0.026);
  bowlerBody.rightArm.wrist.add(ballHandAnchor);

  disposeList.push(
    hairCrownGeo,
    headbandGeo,
    headbandMat,
    lensGeo,
    frameBarGeo,
    wristBandGeo,
    handGeo,
  );

  const bowler: SculptedBowlerRig = {
    ...bowlerBody,
    ballHandAnchor,
  };

  // =========================================================
  // 3. WICKETKEEPER (#07 KEEPER) — Crimson/Gold Kit + Cap + Keeping Pads & Gloves
  // =========================================================
  const keeperBody = buildHumanBaseRig(
    assets,
    anisotropy,
    {
      primaryColor: '#991b1b',
      secondaryColor: '#450a0a',
      accentColor: '#fbbf24',
      collarColor: '#fbbf24',
      playerName: 'KEEPER',
      playerNumber: '07',
      sponsorText: 'NOVA AIR',
    },
    assets.trouserWhiteMat,
    headbandMat,
    castShadow,
    disposeList,
  );
  keeperBody.root.position.set(-0.14, 0.022, 12.18);
  keeperBody.root.rotation.y = Math.PI; // Facing -Z toward stumps & bowler

  // Keeping Cap with curved peak + sunglasses
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.65,
    metalness: 0.05,
  });
  const capDome = new THREE.Mesh(hairCrownGeo, capMat);
  capDome.scale.set(1.03, 1.02, 1.03);
  capDome.position.set(0, 0.022, -0.004);
  const capPeakGeo = new THREE.CylinderGeometry(
    0.125,
    0.142,
    0.016,
    14,
    1,
    true,
    -Math.PI * 0.3,
    Math.PI * 0.6,
  );
  const capPeak = new THREE.Mesh(capPeakGeo, capMat);
  capPeak.position.set(0, 0.032, 0.036);
  capPeak.rotation.x = 0.16;
  const kLenses = new THREE.Mesh(lensGeo, assets.sunglassLensMat);
  kLenses.position.set(0, 0.008, 0.012);
  keeperBody.head.add(capDome, capPeak, kLenses);

  // Slim keeping leg pads
  const kPadL = new THREE.Mesh(padGeo, padMat);
  kPadL.scale.set(0.86, 0.94, 0.86);
  kPadL.position.set(0, -0.18, 0.015);
  const kPadR = new THREE.Mesh(padGeo, padMat);
  kPadR.scale.set(0.86, 0.94, 0.86);
  kPadR.position.set(0, -0.18, 0.015);
  keeperBody.leftLeg.knee.add(kPadL);
  keeperBody.rightLeg.knee.add(kPadR);

  // Webbed Wicketkeeping Gloves
  const kGloveL = buildBattingGlove(0xfbbf24, 0x991b1b, 1, disposeList);
  kGloveL.scale.setScalar(1.16);
  const kGloveR = buildBattingGlove(0xfbbf24, 0x991b1b, -1, disposeList);
  kGloveR.scale.setScalar(1.16);
  keeperBody.leftArm.wrist.add(kGloveL);
  keeperBody.rightArm.wrist.add(kGloveR);

  const leftGloveAnchor = new THREE.Object3D();
  leftGloveAnchor.position.set(0, -0.06, 0.02);
  const rightGloveAnchor = new THREE.Object3D();
  rightGloveAnchor.position.set(0, -0.06, 0.02);
  keeperBody.leftArm.wrist.add(leftGloveAnchor);
  keeperBody.rightArm.wrist.add(rightGloveAnchor);

  disposeList.push(capMat, capPeakGeo);

  const keeper: SculptedKeeperRig = {
    ...keeperBody,
    leftGloveAnchor,
    rightGloveAnchor,
  };

  return {
    batter,
    bowler,
    keeper,
    dispose: () => {
      disposeList.forEach((d) => d.dispose());
    },
  };
}
