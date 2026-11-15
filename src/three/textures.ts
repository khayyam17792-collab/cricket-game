import * as THREE from 'three';

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lush green stadium outfield texture with concentric mowed bands,
 * 30-yard fielding circle, and fine turf speckle.
 */
export function createOutfieldTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Base rich turf green
  ctx.fillStyle = '#1b5e27';
  ctx.fillRect(0, 0, size, size);

  // Concentric mowed rings
  const ringCount = 14;
  const maxR = size * 0.49;
  for (let i = ringCount; i >= 1; i--) {
    const r = (i / ringCount) * maxR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#1e6b2c' : '#257934';
    ctx.fill();
  }

  // Subtle radial mowed strips across the square
  ctx.save();
  ctx.globalAlpha = 0.08;
  const stripWidth = size / 24;
  for (let i = 0; i < 24; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(i * stripWidth, 0, stripWidth, size);
    }
  }
  ctx.restore();

  // Turf micro-grain
  ctx.save();
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(255, 255, 255, 0.035)'
        : 'rgba(0, 20, 5, 0.06)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  // 30-yard inner fielding circle (approx 45% of boundary radius)
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.72)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.21, size * 0.24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * Detailed brown clay cricket pitch texture with worn footmarks,
 * rolled clay grain, and crisp white crease markings.
 * World dimensions mapped: width = 3.05m, length = 23.2m (centered at z=0).
 */
export function createPitchTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Warm dry clay gradient
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, '#9c7b56');
  grad.addColorStop(0.2, '#b08e64');
  grad.addColorStop(0.5, '#ba976c');
  grad.addColorStop(0.8, '#b08e64');
  grad.addColorStop(1, '#9c7b56');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle rolled clay striations
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 8 + Math.random() * 28;
    ctx.fillStyle =
      Math.random() > 0.45
        ? 'rgba(72, 50, 28, 0.08)'
        : 'rgba(232, 208, 175, 0.08)';
    ctx.fillRect(x, y, 2, len);
  }

  // Helper to convert pitch Z (-11.6..+11.6) to canvas Y (0..h)
  const zToY = (z: number) => ((z + 11.6) / 23.2) * h;
  // Helper to convert pitch X (-1.525..+1.525) to canvas X (0..w)
  const xToX = (x: number) => ((x + 1.525) / 3.05) * w;

  // Realistic bowler landing footmarks & batting guard wear patches
  const drawWearPatch = (cx: number, cy: number, rx: number, ry: number, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(rx, ry));
    g.addColorStop(0, `rgba(74, 54, 34, ${alpha})`);
    g.addColorStop(0.65, `rgba(92, 68, 44, ${alpha * 0.45})`);
    g.addColorStop(1, 'rgba(92, 68, 44, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Bowler follow-through rough & batter guard marks
  drawWearPatch(xToX(0.32), zToY(-8.6), 48, 120, 0.34);
  drawWearPatch(xToX(-0.34), zToY(-8.5), 42, 100, 0.25);
  drawWearPatch(xToX(-0.28), zToY(8.9), 44, 90, 0.32);
  drawWearPatch(xToX(0.05), zToY(6.2), 36, 75, 0.16);
  drawWearPatch(xToX(-0.08), zToY(4.5), 34, 70, 0.14);

  // White painted crease lines
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 7;
  ctx.lineCap = 'square';

  const drawCreaseSet = (stumpZ: number, dirToCenter: number) => {
    const bowlingY = zToY(stumpZ);
    const poppingY = zToY(stumpZ + dirToCenter * 1.22);
    const backEdgeY = zToY(stumpZ - dirToCenter * 1.22);

    // Bowling crease (through stumps, 2.64m wide)
    ctx.beginPath();
    ctx.moveTo(xToX(-1.32), bowlingY);
    ctx.lineTo(xToX(1.32), bowlingY);
    ctx.stroke();

    // Popping crease (full width)
    ctx.beginPath();
    ctx.moveTo(xToX(-1.52), poppingY);
    ctx.lineTo(xToX(1.52), poppingY);
    ctx.stroke();

    // Return creases
    ctx.beginPath();
    ctx.moveTo(xToX(-1.32), poppingY);
    ctx.lineTo(xToX(-1.32), backEdgeY);
    ctx.moveTo(xToX(1.32), poppingY);
    ctx.lineTo(xToX(1.32), backEdgeY);
    ctx.stroke();

    // Wide guidelines
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(xToX(-0.89), bowlingY);
    ctx.lineTo(xToX(-0.89), poppingY);
    ctx.moveTo(xToX(0.89), bowlingY);
    ctx.lineTo(xToX(0.89), poppingY);
    ctx.stroke();
    ctx.lineWidth = 7;
  };

  // Bowler end (-Z, dirToCenter = +1)
  drawCreaseSet(-10.06, 1);
  // Striker end (+Z, dirToCenter = -1)
  drawCreaseSet(10.06, -1);

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * Red leather cricket ball texture with stitched equatorial seam.
 */
export function createCricketBallTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep crimson leather base
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#7c0f15');
  grad.addColorStop(0.5, '#a8141c');
  grad.addColorStop(1, '#7c0f15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle leather pores
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(255, 190, 190, 0.06)'
        : 'rgba(40, 0, 0, 0.1)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }

  // Equatorial seam band
  const midY = h / 2;
  ctx.fillStyle = 'rgba(58, 6, 9, 0.65)';
  ctx.fillRect(0, midY - 12, w, 24);

  // Double-row white stitched seam
  ctx.fillStyle = '#f8fafc';
  for (let x = 6; x < w; x += 14) {
    ctx.fillRect(x, midY - 8, 8, 3);
    ctx.fillRect(x + 3, midY + 5, 8, 3);
  }

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * Glowing stadium LED perimeter advertising strip.
 */
export function createLedBoardTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#071326';
  ctx.fillRect(0, 0, w, h);

  // Top & bottom neon accent rails
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, h - 6, w, 6);

  // Repeating crisp stadium signage blocks
  const labels = ['SUPER OVER', 'NIGHT T20', 'MAXIMUM 6', 'STADIUM LIVE'];
  ctx.font = '800 54px "Barlow Condensed", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (let i = 0; i < 4; i++) {
    const segW = w / 4;
    const x = i * segW + segW / 2;
    ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#34d399';
    ctx.fillText(labels[i], x, h / 2 + 2);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(i * segW, 14, 3, h - 28);
  }

  return finalizeColorTexture(canvas, anisotropy, 8, 1);
}

/**
 * Slatted white sightscreen texture.
 */
export function createSightscreenTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 16) {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fillRect(0, y, w, 2);
  }

  return finalizeColorTexture(canvas, anisotropy);
}

export interface JerseyTextureConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  collarColor: string;
  playerName: string;
  playerNumber: string;
  sponsorText: string;
}

/**
 * Wrap-around athletic cricket jersey CanvasTexture designed for a LatheGeometry
 * rotated +PI/2 around Y:
 * - Back center sits at u = 0.25 (x = 128 in 512px)
 * - Front chest center sits at u = 0.75 (x = 384 in 512px)
 * - Side seams sit at u = 0/1 (+X) and u = 0.5 (-X)
 */
export function createJerseyTexture(
  anisotropy: number,
  cfg: JerseyTextureConfig,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Base athletic jersey gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, cfg.primaryColor);
  grad.addColorStop(0.65, cfg.primaryColor);
  grad.addColorStop(1, cfg.secondaryColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle breathable athletic mesh weave
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let y = 0; y < h; y += 6) {
    for (let x = (y % 12 === 0 ? 0 : 3); x < w; x += 6) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Side seam accent panels at u=0/1 (x=0 & x=w) and u=0.5 (x=w/2)
  ctx.fillStyle = cfg.accentColor;
  ctx.fillRect(0, 48, 34, h - 48);
  ctx.fillRect(w - 34, 48, 34, h - 48);
  ctx.fillRect(w * 0.5 - 34, 48, 68, h - 48);

  // Shoulder yoke & piping
  ctx.fillStyle = cfg.secondaryColor;
  ctx.fillRect(0, 0, w, 62);
  ctx.fillStyle = cfg.accentColor;
  ctx.fillRect(0, 58, w, 8);

  // Ribbed Collar Trim along top edge
  ctx.fillStyle = cfg.collarColor;
  ctx.fillRect(0, 0, w, 24);

  // Front V-neck collar detail (centered at x = 0.75 * w = 768)
  const frontX = w * 0.75;
  ctx.beginPath();
  ctx.moveTo(frontX - 42, 0);
  ctx.lineTo(frontX, 74);
  ctx.lineTo(frontX + 42, 0);
  ctx.closePath();
  ctx.fillStyle = '#d99b72';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = cfg.collarColor;
  ctx.stroke();

  // Front Chest Team Crest & Sponsor Logo
  ctx.fillStyle = cfg.accentColor;
  ctx.beginPath();
  ctx.arc(frontX + 68, 138, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.sponsorText, frontX, 248);
  ctx.fillStyle = cfg.accentColor;
  ctx.fillRect(frontX - 88, 282, 176, 6);

  // Back Player Name & Number (centered at x = 0.25 * w = 256)
  const backX = w * 0.25;
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 42px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.playerName.toUpperCase(), backX, 128);

  ctx.font = '800 162px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(cfg.playerNumber, backX, 266);
  ctx.lineWidth = 4;
  ctx.strokeStyle = cfg.accentColor;
  ctx.strokeText(cfg.playerNumber, backX, 266);

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * Ribbed white leather cricket batting leg-pad texture with horizontal straps.
 */
export function createLegPadTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, w, h);

  // Subtle leather grain & pitch dust near bottom
  const dust = ctx.createLinearGradient(0, h * 0.72, 0, h);
  dust.addColorStop(0, 'rgba(180, 150, 110, 0)');
  dust.addColorStop(1, 'rgba(155, 125, 85, 0.24)');
  ctx.fillStyle = dust;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // Vertical shin bolsters
  ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.fillRect(w * 0.31, 0, 4, h);
  ctx.fillRect(w * 0.67, 0, 4, h);

  // Knee roll horizontal stitching
  ctx.fillStyle = 'rgba(100, 116, 139, 0.32)';
  ctx.fillRect(0, 95, w, 6);
  ctx.fillRect(0, 145, w, 6);

  // Three horizontal Velcro straps across back & sides
  const strapYs = [130, 260, 395];
  for (const sy of strapYs) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, sy, w, 24);
    ctx.fillStyle = '#0f4c81';
    ctx.fillRect(w * 0.42, sy + 4, 34, 16);
  }

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * English-willow cricket bat blade texture with natural wood grain and splice sticker.
 */
export function createWillowBatTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const woodGrad = ctx.createLinearGradient(0, 0, w, 0);
  woodGrad.addColorStop(0, '#d8b47c');
  woodGrad.addColorStop(0.5, '#f0d8ab');
  woodGrad.addColorStop(1, '#d8b47c');
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, 0, w, h);

  // Natural vertical willow heartwood grain lines
  for (let x = 8; x < w; x += 11) {
    ctx.fillStyle = 'rgba(138, 92, 42, 0.14)';
    ctx.fillRect(x + (Math.random() - 0.5) * 3, 0, 2, h);
  }

  // Geometric sponsor splice sticker in upper-middle blade
  ctx.fillStyle = '#0f4c81';
  ctx.fillRect(26, 90, w - 52, 130);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(26, 90, w - 52, 18);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(26, 204, w - 52, 16);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('APEX', w / 2, 148);
  ctx.font = '700 22px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText('GRADE-A WILLOW', w / 2, 182);

  // Toe guard strip at bottom
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h - 28, w, 28);

  return finalizeColorTexture(canvas, anisotropy);
}

/**
 * High-contrast jersey nameplate + squad number patch for rigged Xbot backs.
 */
export function createBackNameplateTexture(
  anisotropy: number,
  playerName: string,
  playerNumber: string,
  jerseyHex: string,
  accentHex: string,
): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = jerseyHex;
  ctx.fillRect(0, 0, w, h);

  // Top & bottom subtle trim
  ctx.fillStyle = accentHex;
  ctx.fillRect(16, 12, w - 32, 6);
  ctx.fillRect(16, h - 18, w - 32, 6);

  // Player Surname
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 44px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(playerName.toUpperCase(), w / 2, 68);

  // Squad Number
  ctx.font = '800 168px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(playerNumber, w / 2, 198);
  ctx.lineWidth = 4;
  ctx.strokeStyle = accentHex;
  ctx.strokeText(playerNumber, w / 2, 198);

  return finalizeColorTexture(canvas, anisotropy);
}


