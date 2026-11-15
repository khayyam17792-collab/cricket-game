import * as THREE from 'three';
import {
  createLedBoardTexture,
  createOutfieldTexture,
  createSightscreenTexture,
} from './textures';

export interface StadiumBuildResult {
  group: THREE.Group;
  crowdMesh: THREE.InstancedMesh;
  crowdBaseMatrices: Float32Array;
  crowdCount: number;
  boundaryRx: number;
  boundaryRz: number;
  dispose: () => void;
}

export function buildCricketStadium(
  anisotropy: number,
  isSoftwareGl: boolean,
): StadiumBuildResult {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const boundaryRx = 58;
  const boundaryRz = 64;
  const fieldRx = 68;
  const fieldRz = 74;

  // 1. Extended Night Ground Apron (prevents horizon void beyond stadium)
  const outerGroundGeo = new THREE.CircleGeometry(240, 64);
  outerGroundGeo.rotateX(-Math.PI / 2);
  const outerGroundMat = new THREE.MeshStandardMaterial({
    color: 0x09111d,
    roughness: 0.95,
    metalness: 0.0,
  });
  const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
  outerGround.position.y = -0.05;
  outerGround.receiveShadow = true;
  group.add(outerGround);
  disposables.push(outerGroundGeo, outerGroundMat);

  // 2. Lush Green Oval Cricket Field
  const outfieldTex = createOutfieldTexture(anisotropy);
  const outfieldGeo = new THREE.CircleGeometry(1, 72);
  outfieldGeo.rotateX(-Math.PI / 2);
  outfieldGeo.scale(fieldRx, 1, fieldRz);
  const outfieldMat = new THREE.MeshStandardMaterial({
    map: outfieldTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const outfield = new THREE.Mesh(outfieldGeo, outfieldMat);
  outfield.position.y = 0;
  outfield.receiveShadow = true;
  group.add(outfield);
  disposables.push(outfieldTex, outfieldGeo, outfieldMat);

  // 3. 3D Boundary Rope & Cushions (InstancedMesh around oval)
  const ropeSegments = 144;
  const cushionGeo = new THREE.BoxGeometry(1.7, 0.24, 0.34);
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.05,
  });
  const cushionMesh = new THREE.InstancedMesh(cushionGeo, cushionMat, ropeSegments);
  cushionMesh.receiveShadow = true;
  cushionMesh.castShadow = !isSoftwareGl;

  const dummy = new THREE.Object3D();
  const cGold = new THREE.Color(0xf59e0b);
  const cDark = new THREE.Color(0x0f172a);
  const cEmerald = new THREE.Color(0x10b981);

  for (let i = 0; i < ropeSegments; i++) {
    const theta = (i / ropeSegments) * Math.PI * 2;
    const x = Math.cos(theta) * boundaryRx;
    const z = Math.sin(theta) * boundaryRz;
    const nextTheta = ((i + 1) / ropeSegments) * Math.PI * 2;
    const nx = Math.cos(nextTheta) * boundaryRx;
    const nz = Math.sin(nextTheta) * boundaryRz;

    dummy.position.set(x, 0.12, z);
    dummy.lookAt(nx, 0.12, nz);
    dummy.rotateY(Math.PI / 2);
    dummy.updateMatrix();
    cushionMesh.setMatrixAt(i, dummy.matrix);

    const col = i % 3 === 0 ? cGold : i % 3 === 1 ? cDark : cEmerald;
    cushionMesh.setColorAt(i, col);
  }
  cushionMesh.instanceMatrix.needsUpdate = true;
  if (cushionMesh.instanceColor) cushionMesh.instanceColor.needsUpdate = true;
  cushionMesh.computeBoundingSphere();
  group.add(cushionMesh);
  disposables.push(cushionGeo, cushionMat);

  // Thin continuous white boundary rope line on top of cushions
  const ropePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    ropePoints.push(
      new THREE.Vector3(
        Math.cos(t) * (boundaryRx - 0.25),
        0.04,
        Math.sin(t) * (boundaryRz - 0.25),
      ),
    );
  }
  const ropeGeo = new THREE.BufferGeometry().setFromPoints(ropePoints);
  const ropeMat = new THREE.LineBasicMaterial({ color: 0xf8fafc });
  const ropeLine = new THREE.LineLoop(ropeGeo, ropeMat);
  group.add(ropeLine);
  disposables.push(ropeGeo, ropeMat);

  // 4. White Sightscreens at both ends (behind bowler & behind batter)
  const sightTex = createSightscreenTexture(anisotropy);
  const buildSightscreen = (zPos: number, facingSign: number) => {
    const sg = new THREE.Group();
    const screenGeo = new THREE.BoxGeometry(15.5, 5.4, 0.45);
    const screenMat = new THREE.MeshStandardMaterial({
      map: sightTex,
      color: 0xf8fafc,
      roughness: 0.72,
      metalness: 0.05,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.y = 3.1;
    screen.castShadow = !isSoftwareGl;
    screen.receiveShadow = true;
    sg.add(screen);

    const frameGeo = new THREE.BoxGeometry(16.0, 0.35, 0.65);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.6,
    });
    const topFrame = new THREE.Mesh(frameGeo, frameMat);
    topFrame.position.y = 5.9;
    const baseFrame = new THREE.Mesh(frameGeo, frameMat);
    baseFrame.position.y = 0.35;
    sg.add(topFrame, baseFrame);

    const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 6.0, 10);
    for (const px of [-7.75, 0, 7.75]) {
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(px, 3.0, -0.25 * facingSign);
      sg.add(post);
    }

    sg.position.set(0, 0, zPos);
    disposables.push(screenGeo, screenMat, frameGeo, frameMat, postGeo);
    return sg;
  };
  group.add(buildSightscreen(-69.5, 1));
  group.add(buildSightscreen(69.5, -1));
  disposables.push(sightTex);

  // 5. LED Perimeter Advertising Ring
  const ledTex = createLedBoardTexture(anisotropy);
  const ledGeo = new THREE.CylinderGeometry(1, 1, 1.35, 72, 1, true);
  ledGeo.scale(fieldRx + 0.5, 1, fieldRz + 0.5);
  const ledMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: ledTex,
    emissiveIntensity: 0.75,
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.BackSide,
  });
  const ledRing = new THREE.Mesh(ledGeo, ledMat);
  ledRing.position.y = 0.68;
  group.add(ledRing);
  disposables.push(ledTex, ledGeo, ledMat);

  // 6. Multi-Tier Stadium Seating Bowl & Canopy Roof
  const bowlGroup = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x1b2436,
    roughness: 0.88,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  // Lower tier sloped seating deck
  const lowerTierGeo = new THREE.CylinderGeometry(1.16, 1.01, 7.5, 64, 1, true);
  lowerTierGeo.scale(fieldRx, 1, fieldRz);
  const lowerTier = new THREE.Mesh(lowerTierGeo, concreteMat);
  lowerTier.position.y = 4.2;
  bowlGroup.add(lowerTier);

  // Mid concourse fascia
  const fasciaGeo = new THREE.CylinderGeometry(1.18, 1.16, 1.8, 64, 1, true);
  fasciaGeo.scale(fieldRx, 1, fieldRz);
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: new THREE.Color(0x0ea5e9),
    emissiveIntensity: 0.18,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const fascia = new THREE.Mesh(fasciaGeo, fasciaMat);
  fascia.position.y = 8.6;
  bowlGroup.add(fascia);

  // Upper tier sloped deck
  const upperTierGeo = new THREE.CylinderGeometry(1.34, 1.18, 8.2, 64, 1, true);
  upperTierGeo.scale(fieldRx, 1, fieldRz);
  const upperTier = new THREE.Mesh(upperTierGeo, concreteMat);
  upperTier.position.y = 13.4;
  bowlGroup.add(upperTier);

  // Stadium Roof Canopy Ring
  const roofGeo = new THREE.RingGeometry(1.06, 1.38, 64);
  roofGeo.rotateX(-Math.PI / 2);
  roofGeo.scale(fieldRx, 1, fieldRz);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x162033,
    roughness: 0.65,
    metalness: 0.45,
    side: THREE.DoubleSide,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 19.6;
  bowlGroup.add(roof);

  // Glowing inner canopy trim
  const canopyTrimGeo = new THREE.TorusGeometry(1.07, 0.012, 8, 96);
  canopyTrimGeo.rotateX(Math.PI / 2);
  canopyTrimGeo.scale(fieldRx, 1, fieldRz);
  const canopyTrimMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const canopyTrim = new THREE.Mesh(canopyTrimGeo, canopyTrimMat);
  canopyTrim.position.y = 19.45;
  bowlGroup.add(canopyTrim);

  group.add(bowlGroup);
  disposables.push(
    concreteMat,
    lowerTierGeo,
    fasciaGeo,
    fasciaMat,
    upperTierGeo,
    roofGeo,
    roofMat,
    canopyTrimGeo,
    canopyTrimMat,
  );

  // 7. Instanced Stadium Crowd (spectators filling lower & upper tiers)
  const crowdPerRing = 96;
  const rings = [
    { scale: 1.03, y: 1.6 },
    { scale: 1.065, y: 3.1 },
    { scale: 1.10, y: 4.6 },
    { scale: 1.135, y: 6.1 },
    { scale: 1.21, y: 10.6 },
    { scale: 1.255, y: 12.6 },
    { scale: 1.30, y: 14.6 },
  ];
  const crowdCount = crowdPerRing * rings.length;
  const specGeo = new THREE.CapsuleGeometry(0.28, 0.45, 3, 6);
  const specMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.05,
  });
  const crowdMesh = new THREE.InstancedMesh(specGeo, specMat, crowdCount);
  const crowdBaseMatrices = new Float32Array(crowdCount * 16);

  const jerseyPalette = [
    new THREE.Color(0x1d4ed8),
    new THREE.Color(0xf59e0b),
    new THREE.Color(0x10b981),
    new THREE.Color(0xef4444),
    new THREE.Color(0xe2e8f0),
    new THREE.Color(0x38bdf8),
  ];

  let idx = 0;
  for (const ring of rings) {
    for (let i = 0; i < crowdPerRing; i++) {
      const ang = (i / crowdPerRing) * Math.PI * 2 + (Math.random() - 0.5) * 0.03;
      const sx = Math.cos(ang) * fieldRx * ring.scale;
      const sz = Math.sin(ang) * fieldRz * ring.scale;
      // Leave small gap directly behind sightscreens
      if (Math.abs(sx) < 9.5 && Math.abs(sz) > fieldRz * 0.96 && ring.y < 8) {
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        const s = 0.85 + Math.random() * 0.3;
        dummy.scale.set(s, s, s);
      }
      dummy.position.set(sx, ring.y + (Math.random() - 0.5) * 0.2, sz);
      dummy.lookAt(0, ring.y, 0);
      dummy.updateMatrix();

      crowdMesh.setMatrixAt(idx, dummy.matrix);
      dummy.matrix.toArray(crowdBaseMatrices, idx * 16);
      crowdMesh.setColorAt(
        idx,
        jerseyPalette[Math.floor(Math.random() * jerseyPalette.length)],
      );
      idx++;
    }
  }
  crowdMesh.instanceMatrix.needsUpdate = true;
  if (crowdMesh.instanceColor) crowdMesh.instanceColor.needsUpdate = true;
  crowdMesh.computeBoundingSphere();
  group.add(crowdMesh);
  disposables.push(specGeo, specMat);

  // 8. Four Towering Stadium Floodlight Towers (Multi-Part Composite Groups)
  const towerPositions: Array<[number, number]> = [
    [-64, -66],
    [64, -66],
    [-64, 66],
    [64, 66],
  ];

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.42,
    metalness: 0.82,
  });
  const baseConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.1,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.75,
  });
  const bulbEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xfffbeb),
    emissiveIntensity: 3.4,
    roughness: 0.15,
  });
  const beamHaloMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const plinthGeo = new THREE.BoxGeometry(4.2, 2.5, 4.2);
  const pylonGeo = new THREE.CylinderGeometry(0.65, 1.35, 44, 8);
  const braceGeo = new THREE.BoxGeometry(0.35, 12, 0.35);
  const headFrameGeo = new THREE.BoxGeometry(11.5, 6.2, 1.1);
  const bulbPanelGeo = new THREE.PlaneGeometry(10.6, 5.4);
  const haloConeGeo = new THREE.ConeGeometry(28, 72, 24, 1, true);
  haloConeGeo.translate(0, -36, 0);
  haloConeGeo.rotateX(-Math.PI / 2);

  for (const [tx, tz] of towerPositions) {
    const tower = new THREE.Group();
    tower.position.set(tx, 0, tz);

    const plinth = new THREE.Mesh(plinthGeo, baseConcreteMat);
    plinth.position.y = 1.25;
    tower.add(plinth);

    const pylon = new THREE.Mesh(pylonGeo, steelMat);
    pylon.position.y = 23.0;
    tower.add(pylon);

    const braceL = new THREE.Mesh(braceGeo, steelMat);
    braceL.position.set(-1.3, 41.0, 0);
    braceL.rotation.z = 0.25;
    const braceR = new THREE.Mesh(braceGeo, steelMat);
    braceR.position.set(1.3, 41.0, 0);
    braceR.rotation.z = -0.25;
    tower.add(braceL, braceR);

    // Angled Floodlight Bank aimed at center pitch
    const bank = new THREE.Group();
    bank.position.set(0, 45.5, 0);
    bank.lookAt(-tx, 2, -tz); // local +Z points at pitch center

    const housing = new THREE.Mesh(headFrameGeo, housingMat);
    bank.add(housing);

    const bulbPanel = new THREE.Mesh(bulbPanelGeo, bulbEmissiveMat);
    bulbPanel.position.z = 0.58;
    bank.add(bulbPanel);

    const halo = new THREE.Mesh(haloConeGeo, beamHaloMat);
    halo.position.z = 0.65;
    bank.add(halo);

    tower.add(bank);
    group.add(tower);
  }
  disposables.push(
    steelMat,
    baseConcreteMat,
    housingMat,
    bulbEmissiveMat,
    beamHaloMat,
    plinthGeo,
    pylonGeo,
    braceGeo,
    headFrameGeo,
    bulbPanelGeo,
    haloConeGeo,
  );

  // 9. Night Sky Stars
  const starCount = 450;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const r = 175 + Math.random() * 25;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.max(25, r * Math.cos(phi));
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xe2e8f0,
    size: 0.75,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.65,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);
  disposables.push(starGeo, starMat);

  // 10. Players' Tunnel & Pavilion Gate (South / +Z End for Walk-In Intro)
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.set(14.5, 0, 68.5);
  tunnelGroup.rotation.y = -0.2;

  const tunnelArchMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.35,
  });
  const tunnelInnerGlowMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    emissive: new THREE.Color(0x10b981),
    emissiveIntensity: 1.45,
    roughness: 0.3,
  });
  const tunnelGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 0.7,
    roughness: 0.35,
  });
  const carpetMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    roughness: 0.88,
    metalness: 0.02,
  });

  const pillarGeo = new THREE.BoxGeometry(1.1, 4.6, 5.2);
  const lintelGeo = new THREE.BoxGeometry(6.8, 1.2, 5.4);
  const backdropGeo = new THREE.PlaneGeometry(4.4, 4.2);
  const trimBarGeo = new THREE.BoxGeometry(6.9, 0.22, 0.3);
  const carpetGeo = new THREE.PlaneGeometry(3.4, 18.0);
  carpetGeo.rotateX(-Math.PI / 2);

  const pillarL = new THREE.Mesh(pillarGeo, tunnelArchMat);
  pillarL.position.set(-2.75, 2.3, 0);
  const pillarR = new THREE.Mesh(pillarGeo, tunnelArchMat);
  pillarR.position.set(2.75, 2.3, 0);
  const lintel = new THREE.Mesh(lintelGeo, tunnelArchMat);
  lintel.position.set(0, 5.0, 0);

  const tunnelGlow = new THREE.Mesh(backdropGeo, tunnelInnerGlowMat);
  tunnelGlow.position.set(0, 2.1, 2.1);
  tunnelGlow.rotation.y = Math.PI;

  const topSignTrim = new THREE.Mesh(trimBarGeo, tunnelGoldMat);
  topSignTrim.position.set(0, 4.5, -2.7);

  const carpet = new THREE.Mesh(carpetGeo, carpetMat);
  carpet.position.set(0, 0.028, -9.2);
  carpet.receiveShadow = true;

  // Pavilion Header Signboard
  const pavCanvas = document.createElement('canvas');
  pavCanvas.width = 512;
  pavCanvas.height = 128;
  const pCtx = pavCanvas.getContext('2d')!;
  pCtx.fillStyle = '#071326';
  pCtx.fillRect(0, 0, 512, 128);
  pCtx.fillStyle = '#fbbf24';
  pCtx.font = '800 54px "Barlow Condensed", sans-serif';
  pCtx.textAlign = 'center';
  pCtx.textBaseline = 'middle';
  pCtx.fillText('PAVILION TUNNEL', 256, 66);
  const pavTex = new THREE.CanvasTexture(pavCanvas);
  pavTex.colorSpace = THREE.SRGBColorSpace;
  pavTex.anisotropy = anisotropy;
  const pavSignGeo = new THREE.PlaneGeometry(5.6, 1.0);
  const pavSignMat = new THREE.MeshStandardMaterial({
    map: pavTex,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: pavTex,
    emissiveIntensity: 0.65,
    roughness: 0.4,
  });
  const pavSign = new THREE.Mesh(pavSignGeo, pavSignMat);
  pavSign.position.set(0, 5.05, -2.75);
  pavSign.rotation.y = Math.PI;

  tunnelGroup.add(
    pillarL,
    pillarR,
    lintel,
    tunnelGlow,
    topSignTrim,
    carpet,
    pavSign,
  );
  group.add(tunnelGroup);

  // 11. Cathedral End Clocktower & Arch Landmark (North / -Z End)
  const cathedralGroup = new THREE.Group();
  cathedralGroup.position.set(-18.5, 0, -76.5);
  cathedralGroup.rotation.y = 0.22;

  const towerBodyGeo = new THREE.BoxGeometry(6.2, 24.0, 5.2);
  const towerSpireGeo = new THREE.ConeGeometry(4.4, 7.2, 4);
  towerSpireGeo.rotateY(Math.PI / 4);
  const clockGeo = new THREE.CircleGeometry(1.75, 24);
  const clockMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 1.15,
    roughness: 0.25,
  });

  const towerBody = new THREE.Mesh(towerBodyGeo, tunnelArchMat);
  towerBody.position.y = 12.0;
  const towerSpire = new THREE.Mesh(towerSpireGeo, concreteMat);
  towerSpire.position.y = 27.6;
  const clockFace = new THREE.Mesh(clockGeo, clockMat);
  clockFace.position.set(0, 20.2, 2.65);

  cathedralGroup.add(towerBody, towerSpire, clockFace);
  group.add(cathedralGroup);

  disposables.push(
    tunnelArchMat,
    tunnelInnerGlowMat,
    tunnelGoldMat,
    carpetMat,
    pillarGeo,
    lintelGeo,
    backdropGeo,
    trimBarGeo,
    carpetGeo,
    pavTex,
    pavSignGeo,
    pavSignMat,
    towerBodyGeo,
    towerSpireGeo,
    clockGeo,
    clockMat,
  );

  return {
    group,
    crowdMesh,
    crowdBaseMatrices,
    crowdCount,
    boundaryRx,
    boundaryRz,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
