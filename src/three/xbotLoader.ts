import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  attachBatterGear,
  attachBowlerGear,
  attachFielderGear,
  attachKeeperGear,
  BatterGearHandles,
  updateBackNameplateOnMesh,
  XbotBoneMap,
} from './xbotGear';
import { PlayerCustomization, TEAM_KITS } from '../types/game';

export const XBOT_MODEL_URL = 'https://threejs.org/examples/models/gltf/Xbot.glb';

export interface XbotCharacterInstance {
  root: THREE.Group;
  model: THREE.Object3D;
  bones: XbotBoneMap;
  contactShadow: THREE.Mesh;
}

export interface XbotFielderInstance extends XbotCharacterInstance {
  name: string;
  homePos: THREE.Vector3;
  walkInPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  catchTargetPos: THREE.Vector3;
  catchHandAnchor: THREE.Object3D;
  facingYaw: number;
  diveDirSign: number;
  speed: number;
  state:
    | 'idle'
    | 'walkin'
    | 'chase'
    | 'catchOverhead'
    | 'catchDive'
    | 'celebrate'
    | 'pickup'
    | 'throw'
    | 'return';
  stateTimer: number;
  hasBall: boolean;
}

export interface XbotRosterResult {
  group: THREE.Group;
  batter: XbotCharacterInstance & {
    batGroup: THREE.Group;
    batCollider: THREE.Mesh;
    gear: BatterGearHandles;
  };
  nonStriker: XbotCharacterInstance & {
    batGroup: THREE.Group;
    gear: BatterGearHandles;
  };
  bowler: XbotCharacterInstance & { ballHandAnchor: THREE.Object3D };
  keeper: XbotCharacterInstance;
  fielders: XbotFielderInstance[];
  applyBatterCustomization: (profile: PlayerCustomization) => void;
  dispose: () => void;
}

interface KitPalette {
  jerseyMain: THREE.Color;
  jerseyAccent: THREE.Color;
  trouserMain: THREE.Color;
  trouserStripe: THREE.Color;
  skin: THREE.Color;
  skinShadow: THREE.Color;
  shoeUpper: THREE.Color;
  shoeSole: THREE.Color;
}

const BATTING_KIT: KitPalette = {
  jerseyMain: new THREE.Color('#059669'), // Vibrant Emerald Green
  jerseyAccent: new THREE.Color('#fbbf24'), // Championship Gold
  trouserMain: new THREE.Color('#064e3b'), // Deep Forest Green
  trouserStripe: new THREE.Color('#fbbf24'),
  skin: new THREE.Color('#cc8c66'),
  skinShadow: new THREE.Color('#b87954'),
  shoeUpper: new THREE.Color('#f8fafc'),
  shoeSole: new THREE.Color('#1e293b'),
};

const FIELDING_KIT: KitPalette = {
  jerseyMain: new THREE.Color('#0f2c59'), // Deep Navy Blue
  jerseyAccent: new THREE.Color('#f8fafc'), // Crisp White
  trouserMain: new THREE.Color('#0b2244'), // Navy Trousers
  trouserStripe: new THREE.Color('#f8fafc'), // Crisp White Piping
  skin: new THREE.Color('#cc8c66'),
  skinShadow: new THREE.Color('#b87954'),
  shoeUpper: new THREE.Color('#f8fafc'),
  shoeSole: new THREE.Color('#0f172a'),
};

export const FIELDER_POSITIONS: Array<{ name: string; x: number; z: number }> = [
  { name: 'First Slip', x: 1.95, z: 12.65 },
  { name: 'Backward Point', x: 19.5, z: 13.5 },
  { name: 'Extra Cover', x: 22.0, z: -4.8 },
  { name: 'Mid-Off', x: 10.8, z: -17.2 },
  { name: 'Mid-On', x: -11.0, z: -17.0 },
  { name: 'Deep Mid-Wicket', x: -37.5, z: -17.5 },
  { name: 'Square Leg', x: -23.0, z: 9.2 },
  { name: 'Fine Leg', x: -21.0, z: 33.0 },
  { name: 'Long-Off', x: 16.5, z: -43.5 },
];

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
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

const _paintTmpColor = new THREE.Color();

function paintSkinnedMeshColors(
  mesh: THREE.SkinnedMesh,
  geo: THREE.BufferGeometry,
  palette: KitPalette,
): void {
  const pos = geo.attributes.position;
  const count = pos.count;
  const existingAttr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  const colors = existingAttr
    ? (existingAttr.array as Float32Array)
    : new Float32Array(count * 3);
  const isJointMesh = mesh.name.toLowerCase().includes('joint');

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(x);

    if (y < 0.095) {
      // Cricket cleats
      _paintTmpColor.copy(y < 0.025 ? palette.shoeSole : palette.shoeUpper);
      if (y >= 0.035 && y <= 0.06 && ax > 0.04) {
        _paintTmpColor.copy(palette.jerseyAccent);
      }
    } else if (y < 0.97) {
      // Cricket trousers with outer seam piping
      if (ax > 0.14 && Math.abs(z) < 0.028 && !isJointMesh) {
        _paintTmpColor.copy(palette.trouserStripe);
      } else {
        _paintTmpColor.copy(palette.trouserMain);
      }
    } else if (y < 1.47 && ax < 0.34) {
      // Short-sleeve cricket jersey
      if (isJointMesh) {
        _paintTmpColor.copy(palette.jerseyMain).multiplyScalar(0.82);
      } else if (
        y >= 1.425 ||
        (y >= 1.21 && y <= 1.29) ||
        (y >= 0.97 && y <= 1.005)
      ) {
        _paintTmpColor.copy(palette.jerseyAccent);
      } else if (ax >= 0.31) {
        _paintTmpColor.copy(palette.jerseyAccent);
      } else {
        _paintTmpColor.copy(palette.jerseyMain);
      }
    } else {
      // Exposed forearms, hands, neck, and face
      _paintTmpColor.copy(isJointMesh ? palette.skinShadow : palette.skin);
    }

    colors[i * 3] = _paintTmpColor.r;
    colors[i * 3 + 1] = _paintTmpColor.g;
    colors[i * 3 + 2] = _paintTmpColor.b;
  }

  if (existingAttr) {
    existingAttr.needsUpdate = true;
  } else {
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
}

/**
 * Applies anatomically mapped cricket kit vertex colors onto cloned Xbot geometry (bind pose in meters).
 */
function applyKitColorsToTemplate(
  template: THREE.Object3D,
  palette: KitPalette,
  castShadow: boolean,
  disposables: Array<{ dispose: () => void }>,
): void {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.05,
  });
  disposables.push(mat);

  template.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = obj as THREE.SkinnedMesh;
      const geo = mesh.geometry.clone();
      disposables.push(geo);

      paintSkinnedMeshColors(mesh, geo, palette);

      mesh.geometry = geo;
      mesh.material = mat;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
}

function extractBoneMap(model: THREE.Object3D): XbotBoneMap {
  const byName = new Map<string, THREE.Bone>();
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      byName.set(obj.name, obj as THREE.Bone);
    }
  });

  const find = (name: string): THREE.Bone => {
    const exact = byName.get(`mixamorig:${name}`) ?? byName.get(name);
    if (exact) return exact;
    for (const [k, b] of byName.entries()) {
      if (k.endsWith(name)) return b;
    }
    return new THREE.Bone();
  };

  return {
    hips: find('Hips'),
    spine: find('Spine'),
    spine1: find('Spine1'),
    spine2: find('Spine2'),
    neck: find('Neck'),
    head: find('Head'),
    leftShoulder: find('LeftShoulder'),
    leftArm: find('LeftArm'),
    leftForeArm: find('LeftForeArm'),
    leftHand: find('LeftHand'),
    rightShoulder: find('RightShoulder'),
    rightArm: find('RightArm'),
    rightForeArm: find('RightForeArm'),
    rightHand: find('RightHand'),
    leftUpLeg: find('LeftUpLeg'),
    leftLeg: find('LeftLeg'),
    leftFoot: find('LeftFoot'),
    rightUpLeg: find('RightUpLeg'),
    rightLeg: find('RightLeg'),
    rightFoot: find('RightFoot'),
  };
}

export async function loadXbotRoster(
  anisotropy: number,
  isSoftwareGl: boolean,
  initialProfile?: PlayerCustomization,
): Promise<XbotRosterResult> {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const gltf = await loader.loadAsync(XBOT_MODEL_URL);

  const castShadow = !isSoftwareGl;
  const disposables: Array<{ dispose: () => void }> = [];

  // Shared contact shadow resources for all 12 Xbot athletes
  const shadowTex = createContactShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  disposables.push(shadowTex, shadowGeo, shadowMat);

  // Build 2 shared team templates (Batting: Customizable Kit, Fielding: Navy/White)
  const battingTemplate = SkeletonUtils.clone(gltf.scene);
  applyKitColorsToTemplate(battingTemplate, BATTING_KIT, castShadow, disposables);

  const fieldingTemplate = SkeletonUtils.clone(gltf.scene);
  applyKitColorsToTemplate(fieldingTemplate, FIELDING_KIT, castShadow, disposables);

  const spawnActor = (template: THREE.Object3D): XbotCharacterInstance => {
    const root = new THREE.Group();
    const model = SkeletonUtils.clone(template);
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = 0.012;
    root.add(contactShadow, model);
    const bones = extractBoneMap(model);
    return { root, model, bones, contactShadow };
  };

  const group = new THREE.Group();

  // 1. Opening Batter (Striker) at striker's crease (customized kit + nameplate)
  const batterBase = spawnActor(battingTemplate);
  batterBase.root.position.set(-0.52, 0.022, 8.84);
  const gear = attachBatterGear(
    batterBase.bones,
    anisotropy,
    castShadow,
    disposables,
  );
  const batter = {
    ...batterBase,
    batGroup: gear.batGroup,
    batCollider: gear.batCollider,
    gear,
  };
  group.add(batter.root);

  // 1b. Non-Striker Opening Batter (walks out alongside striker, stands at bowler's end)
  const nonStrikerBase = spawnActor(battingTemplate);
  nonStrikerBase.root.position.set(-1.05, 0.022, -8.84);
  const nonStrikerGear = attachBatterGear(
    nonStrikerBase.bones,
    anisotropy,
    castShadow,
    disposables,
  );
  const nonStriker = {
    ...nonStrikerBase,
    batGroup: nonStrikerGear.batGroup,
    gear: nonStrikerGear,
  };
  group.add(nonStriker.root);

  const applyBatterCustomization = (profile: PlayerCustomization) => {
    const kit = TEAM_KITS[profile.kitId] ?? TEAM_KITS['green-gold'];
    const palette: KitPalette = {
      ...BATTING_KIT,
      jerseyMain: new THREE.Color(kit.jerseyMain),
      jerseyAccent: new THREE.Color(kit.jerseyAccent),
      trouserMain: new THREE.Color(kit.trouserMain),
      trouserStripe: new THREE.Color(kit.jerseyAccent),
    };

    const tintActor = (
      actor: XbotCharacterInstance,
      actorGear: BatterGearHandles,
      name: string,
      number: string,
    ) => {
      actor.model.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
          const mesh = obj as THREE.SkinnedMesh;
          paintSkinnedMeshColors(mesh, mesh.geometry, palette);
        }
      });

      actorGear.helmetShellMat.color.setHex(kit.helmetHex);
      actorGear.helmetStrapMat.color.setHex(kit.accentHex);
      actorGear.gloveTrimMat.color.setHex(kit.accentHex);
      actorGear.batGripMat.color.setHex(kit.accentHex);

      updateBackNameplateOnMesh(
        actorGear.badgeMesh,
        anisotropy,
        name,
        number,
        kit.jerseyMain,
        kit.jerseyAccent,
      );
    };

    const safeName = (profile.playerName || 'STRIKER').trim().slice(0, 12) || 'STRIKER';
    const safeNumber = (profile.jerseyNumber || '56').trim().slice(0, 3) || '56';
    tintActor(batter, gear, safeName, safeNumber);
    tintActor(nonStriker, nonStrikerGear, 'PARTNER', '18');
  };

  if (initialProfile) {
    applyBatterCustomization(initialProfile);
  } else {
    applyBatterCustomization({
      playerName: 'STRIKER',
      jerseyNumber: '56',
      kitId: 'green-gold',
    });
  }

  // 2. Bowler (Navy/White) at top of run-up mark
  const bowlerBase = spawnActor(fieldingTemplate);
  bowlerBase.root.position.set(0.42, 0.022, -22.2);
  const ballHandAnchor = attachBowlerGear(
    bowlerBase.bones,
    anisotropy,
    castShadow,
    disposables,
  );
  const bowler = { ...bowlerBase, ballHandAnchor };
  group.add(bowler.root);

  // 3. Wicketkeeper (Navy/White) 2 meters behind striker's stumps (10.06 + 2.0 = 12.06)
  const keeper = spawnActor(fieldingTemplate);
  keeper.root.position.set(-0.14, 0.022, 12.06);
  keeper.root.rotation.y = Math.PI; // Facing -Z toward stumps
  attachKeeperGear(keeper.bones, anisotropy, castShadow, disposables);
  group.add(keeper.root);

  // 4. 9 Active Fielders (Navy/White) placed at authentic fielding positions
  const fielders: XbotFielderInstance[] = FIELDER_POSITIONS.map((pos, idx) => {
    const actor = spawnActor(fieldingTemplate);
    attachFielderGear(actor.bones, idx % 2 === 0, castShadow, disposables);

    const catchHandAnchor = new THREE.Object3D();
    catchHandAnchor.position.set(-6.5, -2.5, 1.8);
    actor.bones.rightHand.add(catchHandAnchor);

    const homePos = new THREE.Vector3(pos.x, 0.022, pos.z);
    // Compute 1.35m walk-in target toward striker's crease (0, 0.022, 8.84)
    const toCrease = new THREE.Vector3(-pos.x, 0, 8.84 - pos.z).normalize();
    const walkInDist = pos.name === 'First Slip' ? 0.45 : 1.45;
    const walkInPos = homePos.clone().addScaledVector(toCrease, walkInDist);
    const yaw = Math.atan2(-pos.x, 8.84 - pos.z);

    actor.root.position.copy(homePos);
    actor.root.rotation.y = yaw;
    group.add(actor.root);

    return {
      ...actor,
      name: pos.name,
      homePos,
      walkInPos,
      currentPos: homePos.clone(),
      catchTargetPos: homePos.clone(),
      catchHandAnchor,
      facingYaw: yaw,
      diveDirSign: 1,
      speed: 0,
      state: 'idle',
      stateTimer: 0,
      hasBall: false,
    };
  });

  // Dispose original template geometries & materials from gltf load
  gltf.scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose());
      else m.material.dispose();
    }
  });

  return {
    group,
    batter,
    nonStriker,
    bowler,
    keeper,
    fielders,
    applyBatterCustomization,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
