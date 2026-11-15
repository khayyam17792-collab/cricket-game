import * as THREE from 'three';
import {
  createBackNameplateTexture,
  createLegPadTexture,
  createWillowBatTexture,
} from './textures';

export interface XbotBoneMap {
  hips: THREE.Bone;
  spine: THREE.Bone;
  spine1: THREE.Bone;
  spine2: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  leftShoulder: THREE.Bone;
  leftArm: THREE.Bone;
  leftForeArm: THREE.Bone;
  leftHand: THREE.Bone;
  rightShoulder: THREE.Bone;
  rightArm: THREE.Bone;
  rightForeArm: THREE.Bone;
  rightHand: THREE.Bone;
  leftUpLeg: THREE.Bone;
  leftLeg: THREE.Bone;
  leftFoot: THREE.Bone;
  rightUpLeg: THREE.Bone;
  rightLeg: THREE.Bone;
  rightFoot: THREE.Bone;
}

export interface BatterGearHandles {
  batGroup: THREE.Group;
  batCollider: THREE.Mesh;
  badgeMesh: THREE.Mesh;
  helmetShellMat: THREE.MeshPhysicalMaterial;
  helmetStrapMat: THREE.MeshStandardMaterial;
  gloveTrimMat: THREE.MeshStandardMaterial;
  batGripMat: THREE.MeshStandardMaterial;
}

/**
 * Builds detailed cricket helmet (in meters) scaled 100x for Mixamo Head bone.
 */
function createHelmetMeshGroup(
  shellColor: number,
  accentColor: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): {
  helmet: THREE.Group;
  shellMat: THREE.MeshPhysicalMaterial;
  strapMat: THREE.MeshStandardMaterial;
} {
  const helmet = new THREE.Group();
  // Mixamo Armature uses 0.01 scale (1 unit = 1cm)
  helmet.scale.setScalar(100);
  helmet.position.set(0, 9.6, 1.8);

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: shellColor,
    roughness: 0.22,
    metalness: 0.24,
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
  disposables.push(shellMat, grilleMat, strapMat);

  const domeGeo = new THREE.SphereGeometry(
    0.132,
    20,
    14,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.62,
  );
  domeGeo.scale(0.95, 1.04, 1.05);
  const dome = new THREE.Mesh(domeGeo, shellMat);
  dome.position.set(0, 0.012, -0.004);
  dome.castShadow = castShadow;
  helmet.add(dome);

  const earGeo = new THREE.BoxGeometry(0.02, 0.095, 0.09);
  const earL = new THREE.Mesh(earGeo, shellMat);
  earL.position.set(-0.116, -0.036, 0.01);
  const earR = new THREE.Mesh(earGeo, shellMat);
  earR.position.set(0.116, -0.036, 0.01);
  helmet.add(earL, earR);

  const peakGeo = new THREE.CylinderGeometry(
    0.136,
    0.154,
    0.022,
    18,
    1,
    true,
    -Math.PI * 0.34,
    Math.PI * 0.68,
  );
  const peak = new THREE.Mesh(peakGeo, shellMat);
  peak.position.set(0, 0.036, 0.03);
  peak.rotation.x = 0.22;
  helmet.add(peak);

  const barCurves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.112, 0.012, 0.022),
      new THREE.Vector3(-0.07, 0.006, 0.142),
      new THREE.Vector3(0, 0.004, 0.16),
      new THREE.Vector3(0.07, 0.006, 0.142),
      new THREE.Vector3(0.112, 0.012, 0.022),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.108, -0.034, 0.022),
      new THREE.Vector3(-0.068, -0.038, 0.14),
      new THREE.Vector3(0, -0.04, 0.158),
      new THREE.Vector3(0.068, -0.038, 0.14),
      new THREE.Vector3(0.108, -0.034, 0.022),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.1, -0.08, 0.024),
      new THREE.Vector3(0, -0.086, 0.148),
      new THREE.Vector3(0.1, -0.08, 0.024),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.046, 0.032, 0.136),
      new THREE.Vector3(-0.046, -0.08, 0.138),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.046, 0.032, 0.136),
      new THREE.Vector3(0.046, -0.08, 0.138),
    ]),
  ];

  for (const curve of barCurves) {
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.0045, 6, false);
    const bar = new THREE.Mesh(tubeGeo, grilleMat);
    helmet.add(bar);
    disposables.push(tubeGeo);
  }

  const strapGeo = new THREE.TorusGeometry(0.108, 0.007, 6, 16, Math.PI * 0.92);
  const strap = new THREE.Mesh(strapGeo, strapMat);
  strap.position.set(0, -0.032, 0.018);
  strap.rotation.x = Math.PI * 0.58;
  strap.rotation.z = Math.PI * 0.04;
  helmet.add(strap);

  disposables.push(domeGeo, earGeo, peakGeo, strapGeo);
  return { helmet, shellMat, strapMat };
}

/**
 * Builds sculpted English-willow cricket bat (in meters) with curved blade & rubber grip.
 */
function createWillowBatGroup(
  anisotropy: number,
  gripColor: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): {
  batGroup: THREE.Group;
  batCollider: THREE.Mesh;
  gripMat: THREE.MeshStandardMaterial;
} {
  const bat = new THREE.Group();
  const bladeH = 0.56;
  const halfW = 0.056;

  const shape = new THREE.Shape();
  shape.moveTo(-halfW * 0.72, 0);
  shape.lineTo(halfW * 0.72, 0);
  shape.quadraticCurveTo(halfW, -0.04, halfW, -0.09);
  shape.lineTo(halfW, -bladeH + 0.06);
  shape.quadraticCurveTo(halfW * 0.85, -bladeH - 0.01, 0, -bladeH - 0.018);
  shape.quadraticCurveTo(-halfW * 0.85, -bladeH - 0.01, -halfW, -bladeH + 0.06);
  shape.lineTo(-halfW, -0.09);
  shape.quadraticCurveTo(-halfW, -0.04, -halfW * 0.72, 0);

  const bladeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.034,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 10,
  });
  bladeGeo.translate(0, 0, -0.017);

  const pos = bladeGeo.attributes.position;
  const uv = bladeGeo.attributes.uv;
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
  bladeGeo.computeVertexNormals();

  const willowTex = createWillowBatTexture(anisotropy);
  const willowMat = new THREE.MeshStandardMaterial({
    map: willowTex,
    roughness: 0.36,
    metalness: 0.04,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: gripColor,
    roughness: 0.82,
    metalness: 0.02,
  });
  const handleGeo = new THREE.CylinderGeometry(0.017, 0.02, 0.28, 12);
  handleGeo.translate(0, 0.14, 0);
  const ringGeo = new THREE.TorusGeometry(0.0195, 0.003, 6, 12);
  ringGeo.rotateX(Math.PI / 2);

  const bladeMesh = new THREE.Mesh(bladeGeo, willowMat);
  bladeMesh.castShadow = castShadow;
  const handleMesh = new THREE.Mesh(handleGeo, gripMat);
  bat.add(bladeMesh, handleMesh);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(ringGeo, gripMat);
    ring.position.y = 0.06 + i * 0.036;
    bat.add(ring);
  }

  // Explicit 3D willow blade hitbox collider (covers blade only, strictly below hands/handle)
  const colliderGeo = new THREE.BoxGeometry(0.13, 0.58, 0.06);
  const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
  const batCollider = new THREE.Mesh(colliderGeo, colliderMat);
  batCollider.name = 'BatBladeCollider';
  batCollider.position.set(0, -0.30, 0);
  batCollider.visible = false;
  bat.add(batCollider);

  disposables.push(
    bladeGeo,
    willowTex,
    willowMat,
    gripMat,
    handleGeo,
    ringGeo,
    colliderGeo,
    colliderMat,
  );
  return { batGroup: bat, batCollider, gripMat };
}

function attachBackNameplate(
  spine2Bone: THREE.Bone,
  anisotropy: number,
  playerName: string,
  playerNumber: string,
  jerseyHex: string,
  accentHex: string,
  disposables: Array<{ dispose: () => void }>,
): THREE.Mesh {
  const tex = createBackNameplateTexture(
    anisotropy,
    playerName,
    playerNumber,
    jerseyHex,
    accentHex,
  );
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    metalness: 0.04,
  });
  const geo = new THREE.PlaneGeometry(0.24, 0.30);
  const badge = new THREE.Mesh(geo, mat);
  badge.scale.setScalar(100);
  badge.position.set(0, 6.5, -13.6);
  badge.rotation.y = Math.PI;
  spine2Bone.add(badge);
  disposables.push(tex, mat, geo);
  return badge;
}

export function updateBackNameplateOnMesh(
  badgeMesh: THREE.Mesh,
  anisotropy: number,
  playerName: string,
  playerNumber: string,
  jerseyHex: string,
  accentHex: string,
): void {
  const mat = badgeMesh.material as THREE.MeshStandardMaterial;
  const oldMap = mat.map;
  const newTex = createBackNameplateTexture(
    anisotropy,
    playerName,
    playerNumber,
    jerseyHex,
    accentHex,
  );
  mat.map = newTex;
  mat.needsUpdate = true;
  if (oldMap && oldMap !== newTex) {
    oldMap.dispose();
  }
}

/**
 * Builds padded batting/keeping glove mounted on Mixamo Hand bone (fingers extend along +/-X).
 */
function createHandGloveGroup(
  side: 'left' | 'right',
  primaryColor: number,
  trimMat: THREE.MeshStandardMaterial,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  const sign = side === 'left' ? 1 : -1;
  g.scale.setScalar(100);
  g.position.set(sign * 4.5, 0, 0);

  const mainMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.48,
    metalness: 0.05,
  });
  disposables.push(mainMat);

  const cuffGeo = new THREE.CylinderGeometry(0.036, 0.038, 0.052, 10);
  cuffGeo.rotateZ(Math.PI / 2);
  const palmGeo = new THREE.BoxGeometry(0.095, 0.054, 0.082);
  const fingerRollGeo = new THREE.CapsuleGeometry(0.014, 0.042, 4, 8);
  fingerRollGeo.rotateZ(Math.PI / 2);
  disposables.push(cuffGeo, palmGeo, fingerRollGeo);

  const cuff = new THREE.Mesh(cuffGeo, trimMat);
  cuff.position.set(-sign * 0.04, 0, 0);
  const palm = new THREE.Mesh(palmGeo, mainMat);
  palm.position.set(sign * 0.025, 0, 0);
  g.add(cuff, palm);

  for (let i = 0; i < 4; i++) {
    const roll = new THREE.Mesh(fingerRollGeo, i % 2 === 0 ? mainMat : trimMat);
    roll.position.set(sign * 0.045, 0.024, -0.026 + i * 0.018);
    g.add(roll);
  }

  return g;
}

/**
 * Builds ribbed white batting leg pad attached to Mixamo LeftLeg / RightLeg shin bone.
 */
function createShinPadMesh(
  anisotropy: number,
  scaleFactor: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): THREE.Mesh {
  const padTex = createLegPadTexture(anisotropy);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    roughness: 0.44,
    metalness: 0.04,
  });
  const padGeo = new THREE.CylinderGeometry(
    0.088,
    0.072,
    0.47,
    14,
    4,
    false,
    -Math.PI * 0.68,
    Math.PI * 1.36,
  );
  const pos = padGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y > 0.13 && z > 0) {
      pos.setZ(i, z * 1.16);
    }
  }
  padGeo.computeVertexNormals();
  disposables.push(padTex, padMat, padGeo);

  const pad = new THREE.Mesh(padGeo, padMat);
  pad.scale.setScalar(100 * scaleFactor);
  pad.position.set(0, -21, 1.2);
  pad.castShadow = castShadow;
  return pad;
}

/**
 * Builds athletic cap + sunglasses (in meters, scaled 100x) for Mixamo Head bone.
 */
function createCapAndShadesGroup(
  capColor: number,
  withShades: boolean,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  g.scale.setScalar(100);
  g.position.set(0, 9.6, 1.6);

  const capMat = new THREE.MeshStandardMaterial({
    color: capColor,
    roughness: 0.66,
    metalness: 0.05,
  });
  const domeGeo = new THREE.SphereGeometry(
    0.118,
    16,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.56,
  );
  domeGeo.scale(0.95, 1.04, 1.04);
  const dome = new THREE.Mesh(domeGeo, capMat);
  dome.position.set(0, 0.018, -0.005);
  dome.castShadow = castShadow;

  const peakGeo = new THREE.CylinderGeometry(
    0.125,
    0.145,
    0.016,
    14,
    1,
    true,
    -Math.PI * 0.3,
    Math.PI * 0.6,
  );
  const peak = new THREE.Mesh(peakGeo, capMat);
  peak.position.set(0, 0.032, 0.038);
  peak.rotation.x = 0.16;
  g.add(dome, peak);
  disposables.push(capMat, domeGeo, peakGeo);

  if (withShades) {
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.12,
      metalness: 0.85,
    });
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
    const lenses = new THREE.Mesh(lensGeo, lensMat);
    lenses.position.set(0, 0.005, 0.016);
    g.add(lenses);
    disposables.push(lensMat, lensGeo);
  }

  return g;
}

export function attachBatterGear(
  bones: XbotBoneMap,
  anisotropy: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): BatterGearHandles {
  const { helmet, shellMat: helmetShellMat, strapMat: helmetStrapMat } =
    createHelmetMeshGroup(0x064e3b, 0xfbbf24, castShadow, disposables);
  bones.head.add(helmet);

  const badgeMesh = attachBackNameplate(
    bones.spine2,
    anisotropy,
    'STRIKER',
    '56',
    '#059669',
    '#fbbf24',
    disposables,
  );

  const lPad = createShinPadMesh(anisotropy, 1.0, castShadow, disposables);
  const rPad = createShinPadMesh(anisotropy, 1.0, castShadow, disposables);
  bones.leftLeg.add(lPad);
  bones.rightLeg.add(rPad);

  const gloveTrimMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.42,
    metalness: 0.12,
  });
  disposables.push(gloveTrimMat);

  const lGlove = createHandGloveGroup('left', 0xf8fafc, gloveTrimMat, disposables);
  const rGlove = createHandGloveGroup('right', 0xf8fafc, gloveTrimMat, disposables);
  bones.leftHand.add(lGlove);
  bones.rightHand.add(rGlove);

  // Mount cricket bat cleanly inside RightHand palm (handle points along +Z thumb axis, blade along -Z pinky axis)
  const { batGroup, batCollider, gripMat: batGripMat } = createWillowBatGroup(
    anisotropy,
    0xfbbf24,
    castShadow,
    disposables,
  );
  batGroup.scale.setScalar(100);
  batGroup.position.set(-5.8, -1.8, 0.5);
  batGroup.rotation.set(Math.PI * 0.5, 0.12, 0);
  bones.rightHand.add(batGroup);

  return {
    batGroup,
    batCollider,
    badgeMesh,
    helmetShellMat,
    helmetStrapMat,
    gloveTrimMat,
    batGripMat,
  };
}

export function attachBowlerGear(
  bones: XbotBoneMap,
  anisotropy: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): THREE.Object3D {
  attachBackNameplate(
    bones.spine2,
    anisotropy,
    'PACE',
    '10',
    '#0f2c59',
    '#f8fafc',
    disposables,
  );
  // Athletic hair + team headband + sunglasses on Head bone
  const headGear = new THREE.Group();
  headGear.scale.setScalar(100);
  headGear.position.set(0, 9.6, 1.6);

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.85,
    metalness: 0.02,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.04,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.86,
  });

  const hairGeo = new THREE.SphereGeometry(
    0.118,
    16,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.56,
  );
  hairGeo.scale(0.94, 1.06, 1.02);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.018, -0.008);
  hair.castShadow = castShadow;

  const bandGeo = new THREE.TorusGeometry(0.11, 0.014, 8, 20);
  bandGeo.rotateX(Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.set(0, 0.04, 0.004);

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
  const lenses = new THREE.Mesh(lensGeo, lensMat);
  lenses.position.set(0, 0.005, 0.016);

  headGear.add(hair, band, lenses);
  bones.head.add(headGear);

  // Wrist sweatband
  const wristGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.052, 10);
  wristGeo.rotateZ(Math.PI / 2);
  const wristBand = new THREE.Mesh(wristGeo, bandMat);
  wristBand.scale.setScalar(100);
  wristBand.position.set(2.0, 0, 0);
  bones.rightHand.add(wristBand);

  // Ball grip anchor inside bowler's RightHand fingers
  const ballHandAnchor = new THREE.Object3D();
  ballHandAnchor.position.set(-7.2, -3.2, 1.5);
  bones.rightHand.add(ballHandAnchor);

  disposables.push(hairMat, bandMat, lensMat, hairGeo, bandGeo, lensGeo, wristGeo);
  return ballHandAnchor;
}

export function attachKeeperGear(
  bones: XbotBoneMap,
  anisotropy: number,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): void {
  attachBackNameplate(
    bones.spine2,
    anisotropy,
    'KEEPER',
    '07',
    '#0f2c59',
    '#f8fafc',
    disposables,
  );
  const cap = createCapAndShadesGroup(0x0f2c59, true, castShadow, disposables);
  bones.head.add(cap);

  const lPad = createShinPadMesh(anisotropy, 0.88, castShadow, disposables);
  const rPad = createShinPadMesh(anisotropy, 0.88, castShadow, disposables);
  bones.leftLeg.add(lPad);
  bones.rightLeg.add(rPad);

  const kGloveTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f2c59,
    roughness: 0.42,
    metalness: 0.12,
  });
  disposables.push(kGloveTrimMat);

  const lGlove = createHandGloveGroup('left', 0xf8fafc, kGloveTrimMat, disposables);
  lGlove.scale.multiplyScalar(1.15);
  const rGlove = createHandGloveGroup('right', 0xf8fafc, kGloveTrimMat, disposables);
  rGlove.scale.multiplyScalar(1.15);
  bones.leftHand.add(lGlove);
  bones.rightHand.add(rGlove);
}

export function attachFielderGear(
  bones: XbotBoneMap,
  withShades: boolean,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): void {
  const cap = createCapAndShadesGroup(0x0f2c59, withShades, castShadow, disposables);
  bones.head.add(cap);
}
