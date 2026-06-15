import * as THREE from 'three';

export const WEAPONS = {
  pistol: {
    name: 'PULSE PISTOL',
    damage: 22,
    fireRate: 180, // ms
    spread: 0.008,
    pellets: 1,
    automatic: false,
    projectile: false,
    color: 0x00eaff,
    recoil: 0.04,
  },
  shotgun: {
    name: 'SCATTER CANNON',
    damage: 12,
    fireRate: 750,
    spread: 0.055,
    pellets: 8,
    automatic: false,
    projectile: false,
    color: 0xffaa00,
    recoil: 0.18,
  },
  rocket: {
    name: 'NOVA ROCKET',
    damage: 0,
    fireRate: 1100,
    spread: 0,
    pellets: 1,
    automatic: false,
    projectile: true,
    speed: 55,
    color: 0xff003c,
    recoil: 0.25,
  },
};

export class WeaponView {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(0.35, -0.35, -0.65);
    this.camera.add(this.group);

    this.meshes = {};
    this.buildModels();
    this.current = null;
  }

  buildModels() {
    // Pistol
    const pistol = new THREE.Group();
    const pBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.14, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6, roughness: 0.3 })
    );
    pBody.position.z = -0.1;
    const pGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x00eaff })
    );
    pGlow.position.set(0, 0.04, -0.26);
    pistol.add(pBody, pGlow);
    this.meshes.pistol = pistol;

    // Shotgun
    const shotgun = new THREE.Group();
    const sBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x443322, metalness: 0.5, roughness: 0.5 })
    );
    sBody.position.z = -0.15;
    const sGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.04, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    sGlow.position.set(0, 0.08, -0.35);
    shotgun.add(sBody, sGlow);
    this.meshes.shotgun = shotgun;

    // Rocket launcher
    const rocket = new THREE.Group();
    const rBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x552233, metalness: 0.4, roughness: 0.4 })
    );
    rBody.rotation.x = Math.PI / 2;
    rBody.position.z = -0.2;
    const rGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12),
      new THREE.MeshBasicMaterial({ color: 0xff003c })
    );
    rGlow.rotation.x = Math.PI / 2;
    rGlow.position.set(0, 0.06, -0.4);
    rocket.add(rBody, rGlow);
    this.meshes.rocket = rocket;

    for (const m of Object.values(this.meshes)) {
      m.visible = false;
      this.group.add(m);
    }
  }

  setWeapon(key) {
    if (this.current) this.meshes[this.current].visible = false;
    this.current = key;
    if (this.meshes[key]) {
      this.meshes[key].visible = true;
      this.group.position.y = -0.35;
    }
  }

  recoil(amount) {
    this.group.position.y -= amount;
    this.group.position.z += amount * 0.4;
  }

  update(dt) {
    // Recover from recoil
    this.group.position.y += ( -0.35 - this.group.position.y) * 10 * dt;
    this.group.position.z += ( -0.65 - this.group.position.z) * 10 * dt;
  }
}
