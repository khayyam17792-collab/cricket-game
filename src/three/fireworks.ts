import * as THREE from 'three';

const MAX_PARTICLES = 360;
const PARTICLES_PER_BURST = 60;

const FIREWORK_PALETTE = [
  new THREE.Color(0xfbbf24), // Stadium Gold
  new THREE.Color(0x10b981), // Emerald
  new THREE.Color(0x38bdf8), // Electric Cyan
  new THREE.Color(0xf43f5e), // Crimson
  new THREE.Color(0xa855f7), // Violet
];

interface ParticleSlot {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  baseScale: number;
}

const _dummy = new THREE.Object3D();

export class VictoryFireworks {
  public readonly mesh: THREE.InstancedMesh;
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;
  private slots: ParticleSlot[];
  private active = false;
  private spawnCooldown = 0;
  private cursor = 0;
  private onBurstCallback?: () => void;

  constructor(onBurst?: () => void) {
    this.onBurstCallback = onBurst;
    this.geometry = new THREE.SphereGeometry(0.24, 8, 8);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_PARTICLES,
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;

    this.slots = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      age: 0,
      life: 1.5,
      baseScale: 1,
    }));

    const initColor = new THREE.Color(0xfbbf24);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
      this.mesh.setColorAt(i, initColor);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public start(): void {
    this.active = true;
    this.mesh.visible = true;
    this.spawnCooldown = 0.05;
    // Launch two immediate opening bursts on opposite stadium stands
    this.spawnBurst(-24, 29, -46);
    this.spawnBurst(24, 32, -48);
  }

  public stop(): void {
    this.active = false;
    this.mesh.visible = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.slots[i].active = false;
    }
  }

  private spawnBurst(cx: number, cy: number, cz: number): void {
    const primary =
      FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)];
    const secondary =
      FIREWORK_PALETTE[Math.floor(Math.random() * FIREWORK_PALETTE.length)];

    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const slotIdx = this.cursor;
      const slot = this.slots[slotIdx];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;

      // Spherical radial burst distribution
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const speed = 9.5 + Math.random() * 9.0;

      slot.active = true;
      slot.pos.set(cx, cy, cz);
      slot.vel.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 2.5,
        Math.sin(phi) * Math.sin(theta) * speed,
      );
      slot.age = 0;
      slot.life = 1.15 + Math.random() * 0.65;
      slot.baseScale = 0.75 + Math.random() * 0.7;

      this.mesh.setColorAt(slotIdx, i % 3 === 0 ? secondary : primary);
    }

    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.onBurstCallback?.();
  }

  public update(dt: number): void {
    if (!this.active) return;

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnCooldown = 0.55 + Math.random() * 0.45;
      const bx = (Math.random() - 0.5) * 68;
      const by = 24 + Math.random() * 16;
      const bz = -52 + Math.random() * 28;
      this.spawnBurst(bx, by, bz);
    }

    const drag = Math.exp(-1.55 * dt);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const slot = this.slots[i];
      if (!slot.active) {
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.age += dt;
      if (slot.age >= slot.life) {
        slot.active = false;
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      slot.vel.multiplyScalar(drag);
      slot.vel.y += -6.2 * dt;
      slot.pos.addScaledVector(slot.vel, dt);

      const t = slot.age / slot.life;
      const scale = slot.baseScale * (1 - t * 0.85);
      _dummy.position.copy(slot.pos);
      _dummy.scale.setScalar(Math.max(0.001, scale));
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
