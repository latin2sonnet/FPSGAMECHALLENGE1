import * as THREE from 'three';

export class ProjectileManager {
  constructor(scene, localPlayerId) {
    this.scene = scene;
    this.localPlayerId = localPlayerId;
    this.rockets = [];
    this.effects = [];
  }

  spawnTracer(origin, direction, distance, color = 0x00eaff) {
    const geom = new THREE.CylinderGeometry(0.015, 0.015, distance, 6);
    geom.translate(0, distance / 2, 0);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(direction));
    this.scene.add(mesh);

    this.effects.push({
      mesh,
      life: 0.08,
      maxLife: 0.08,
      type: 'tracer',
    });
  }

  spawnMuzzleFlash(position, color = 0x00eaff) {
    const geom = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.06, maxLife: 0.06, type: 'flash' });
  }

  spawnRocket(origin, direction, owner) {
    const geom = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff003c, emissiveIntensity: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(direction));

    const light = new THREE.PointLight(0xff003c, 2, 12);
    mesh.add(light);

    this.scene.add(mesh);
    this.rockets.push({
      mesh,
      velocity: direction.clone().multiplyScalar(55),
      owner,
      born: performance.now(),
    });
  }

  spawnExplosion(position, radius = 5) {
    const geom = new THREE.SphereGeometry(0.2, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);

    const light = new THREE.PointLight(0xff5500, 5, radius * 2);
    mesh.add(light);

    this.effects.push({
      mesh,
      light,
      life: 0.5,
      maxLife: 0.5,
      type: 'explosion',
      maxScale: radius,
    });
  }

  spawnHitSpark(position, color = 0xffdd44) {
    const geom = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.12, maxLife: 0.12, type: 'spark' });
  }

  update(dt) {
    // Rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.mesh.position.addScaledVector(r.velocity, dt);
      if (performance.now() - r.born > 4000) {
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }

    // Effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
        continue;
      }
      const t = 1 - e.life / e.maxLife;
      if (e.type === 'explosion') {
        const s = 0.2 + (e.maxScale - 0.2) * t;
        e.mesh.scale.set(s, s, s);
        e.mesh.material.opacity = 0.9 * (1 - t);
        e.light.intensity = 5 * (1 - t);
      } else if (e.type === 'tracer') {
        e.mesh.material.opacity = 0.8 * (1 - t);
      } else if (e.type === 'flash') {
        const s = 1 + t * 3;
        e.mesh.scale.set(s, s, s);
        e.mesh.material.opacity = 0.9 * (1 - t);
      } else if (e.type === 'spark') {
        e.mesh.scale.setScalar(1 - t);
        e.mesh.material.opacity = 0.9 * (1 - t);
      }
    }
  }

  removeAll() {
    for (const r of this.rockets) this.scene.remove(r.mesh);
    for (const e of this.effects) this.scene.remove(e.mesh);
    this.rockets = [];
    this.effects = [];
  }
}
