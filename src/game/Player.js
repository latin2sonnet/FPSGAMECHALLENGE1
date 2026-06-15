import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WEAPONS } from './Weapon.js';
import { GROUP_MAP, GROUP_REMOTE } from '../engine/Physics.js';

export class LocalPlayer {
  constructor(renderer, physics, input, audio, projectiles, network) {
    this.renderer = renderer;
    this.physics = physics;
    this.input = input;
    this.audio = audio;
    this.projectiles = projectiles;
    this.network = network;

    this.body = physics.createPlayerBody();
    this.camera = renderer.camera;
    this.camera.position.copy(this.body.position);

    this.yaw = 0;
    this.pitch = 0;
    this.speed = 14;
    this.jumpForce = 16;
    this.dashForce = 26;
    this.health = 100;
    this.maxHealth = 100;
    this.energy = 0;
    this.alive = true;

    this.lastShotTime = 0;
    this.currentWeapon = 'pistol';

    this.focusActive = false;
    this.focusPressed = false;
    this.focusTimer = 0;
    this.focusCost = 40;
    this.focusDrain = 25; // per second

    this.dashCooldown = 0;
    this.footstepTimer = 0;
    this.wasGrounded = false;

    this.name = 'Player';
    this.score = 0;
    this.deaths = 0;

    this.remotePlayers = new Map();
  }

  setName(name) {
    this.name = name;
  }

  setWeapon(key) {
    this.currentWeapon = key;
    this.network.sendWeapon(key);
  }

  spawn(x, y, z) {
    this.physics.setPlayerPosition(x, y, z);
    this.health = this.maxHealth;
    this.energy = 0;
    this.alive = true;
  }

  takeDamage(amount) {
    this.health -= amount;
    this.audio.hit();
    if (this.health <= 0) {
      this.alive = false;
      this.deaths += 1;
    }
  }

  getEyePosition() {
    const p = this.body.position;
    return new THREE.Vector3(p.x, p.y + 0.85, p.z);
  }

  getForwardVector() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  update(dt) {
    if (!this.alive) return;

    this.updateLook(dt);
    this.updateMovement(dt);
    this.updateAbilities(dt);
    this.updateWeapons(dt);

    const pos = this.body.position;
    this.camera.position.set(pos.x, pos.y + 0.85, pos.z);

    this.network.sendMove({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      qx: this.camera.quaternion.x,
      qy: this.camera.quaternion.y,
      qz: this.camera.quaternion.z,
      qw: this.camera.quaternion.w,
    });
  }

  updateLook(dt) {
    const sens = 0.002;
    const { dx, dy } = this.input.consumeMouseDelta();
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));

    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    this.camera.quaternion.copy(qYaw).multiply(qPitch);
  }

  updateMovement(dt) {
    const grounded = this.physics.isGrounded();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    let move = new THREE.Vector3();
    if (this.input.isDown('KeyW')) move.add(forward);
    if (this.input.isDown('KeyS')) move.sub(forward);
    if (this.input.isDown('KeyA')) move.sub(right);
    if (this.input.isDown('KeyD')) move.add(right);

    if (move.lengthSq() > 0) {
      move.normalize();
      const speed = this.focusActive ? this.speed * 0.55 : this.speed;
      const target = move.multiplyScalar(speed);
      this.body.velocity.x += (target.x - this.body.velocity.x) * 10 * dt;
      this.body.velocity.z += (target.z - this.body.velocity.z) * 10 * dt;
    } else {
      // Friction when no input
      this.body.velocity.x *= Math.pow(0.001, dt);
      this.body.velocity.z *= Math.pow(0.001, dt);
    }

    if (this.input.isDown('Space') && grounded) {
      this.body.velocity.y = this.jumpForce;
      this.audio.jump();
    }

    if (this.input.isDown('ShiftLeft') && this.dashCooldown <= 0 && move.lengthSq() > 0) {
      if (this.energy >= 15) {
        this.energy -= 15;
        const dashDir = move.normalize();
        this.body.velocity.x = dashDir.x * this.dashForce;
        this.body.velocity.z = dashDir.z * this.dashForce;
        this.dashCooldown = 1.2;
        this.audio.dash();
      } else {
        this.audio.denied();
        this.dashCooldown = 0.3;
      }
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (!grounded && this.body.velocity.y > -20) {
      this.body.velocity.y -= 18 * dt;
    }

    // Footsteps
    if (grounded && move.lengthSq() > 0) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = this.focusActive ? 0.45 : 0.28;
        this.audio.footstep();
      }
    } else {
      this.footstepTimer = 0;
    }

    // Landing sound
    if (grounded && !this.wasGrounded && this.body.velocity.y < -4) {
      this.audio.footstep();
    }
    this.wasGrounded = grounded;
  }

  updateAbilities(dt) {
    if (this.input.isDown('KeyF') && !this.focusPressed) {
      this.focusPressed = true;
      if (!this.focusActive) {
        if (this.energy >= this.focusCost) {
          this.focusActive = true;
          this.energy -= this.focusCost;
          this.focusTimer = 2.5;
          this.audio.focus();
        } else {
          this.audio.denied();
        }
      }
    }
    if (!this.input.isDown('KeyF')) this.focusPressed = false;

    if (this.focusActive) {
      this.focusTimer -= dt;
      this.energy -= this.focusDrain * dt;
      if (this.focusTimer <= 0 || this.energy <= 0) {
        this.focusActive = false;
        this.energy = Math.max(0, this.energy);
      }
    }
  }

  updateWeapons(dt) {
    if (this.input.isDown('Digit1')) this.setWeapon('pistol');
    if (this.input.isDown('Digit2')) this.setWeapon('shotgun');
    if (this.input.isDown('Digit3')) this.setWeapon('rocket');

    if (this.input.mouse.down) {
      this.fire(this.currentWeapon);
    }
  }

  fire(key) {
    const weapon = WEAPONS[key];
    const now = performance.now();
    if (now - this.lastShotTime < weapon.fireRate) return;
    this.lastShotTime = now;

    const origin = this.getEyePosition();
    const forward = this.getForwardVector();

    if (key === 'pistol') this.audio.pistol();
    if (key === 'shotgun') this.audio.shotgun();
    if (key === 'rocket') this.audio.rocket();

    this.projectiles.spawnMuzzleFlash(origin.clone().add(forward.clone().multiplyScalar(0.4)), weapon.color);

    if (weapon.projectile) {
      this.projectiles.spawnRocket(origin, forward, this.network.id);
      this.network.sendShoot({ weapon: key, origin, dir: forward });
      return;
    }

    const range = 120;
    for (let i = 0; i < weapon.pellets; i++) {
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * weapon.spread,
        (Math.random() - 0.5) * weapon.spread,
        (Math.random() - 0.5) * weapon.spread
      );
      const dir = forward.clone().add(spread).normalize();
      const pelletTo = new CANNON.Vec3(
        origin.x + dir.x * range,
        origin.y + dir.y * range,
        origin.z + dir.z * range
      );
      const result = this.physics.raycast(
        { x: origin.x, y: origin.y, z: origin.z },
        pelletTo
      );

      if (result.hasHit) {
        const hitPoint = new THREE.Vector3(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z);
        const dist = origin.distanceTo(hitPoint);
        this.projectiles.spawnTracer(origin, dir, dist, weapon.color);
        this.projectiles.spawnHitSpark(hitPoint, weapon.color);

        if (result.body === this.physics.playerBody) continue;

        const bodyId = result.body.id;
        const remote = this.findRemoteByBody(bodyId);
        if (remote) {
          this.network.sendHit({ victimId: remote.id, damage: weapon.damage });
          remote.flashDamage();
        }
      } else {
        this.projectiles.spawnTracer(origin, dir, range, weapon.color);
      }
    }
  }

  findRemoteByBody(bodyId) {
    for (const rp of this.remotePlayers.values()) {
      if (rp.body && rp.body.id === bodyId) return rp;
    }
    return null;
  }
}

export class RemotePlayer {
  constructor(scene, physics, id, name) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.physics = physics;

    this.group = new THREE.Group();
    const bodyGeom = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.3 });
    this.mesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.mesh.position.y = 1.1;
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    const headGeom = new THREE.SphereGeometry(0.35, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00eaff, emissiveIntensity: 0.4 });
    this.head = new THREE.Mesh(headGeom, headMat);
    this.head.position.y = 2.0;
    this.group.add(this.head);

    const nameEl = document.createElement('div');
    nameEl.className = 'nametag';
    nameEl.textContent = name;
    this.nameEl = nameEl;

    this.scene.add(this.group);

    this.body = new CANNON.Body({ mass: 0 });
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1.1, 0.5));
    this.body.addShape(shape, new CANNON.Vec3(0, 1.1, 0));
    this.body.collisionFilterGroup = GROUP_REMOTE;
    this.body.collisionFilterMask = GROUP_MAP;
    this.physics.world.addBody(this.body);

    this.health = 100;
    this.weapon = 'pistol';
    this.alive = true;
    this.damageFlash = 0;
  }

  setState(data) {
    this.group.position.set(data.x, data.y, data.z);
    this.body.position.set(data.x, data.y, data.z);

    const q = new THREE.Quaternion(data.qx, data.qy, data.qz, data.qw);
    this.group.quaternion.copy(q);
    this.head.quaternion.copy(q);

    this.health = data.health;
    this.weapon = data.weapon;
    this.alive = data.alive;

    if (!this.alive) {
      this.group.visible = false;
    } else {
      this.group.visible = true;
    }
  }

  flashDamage() {
    this.damageFlash = 0.15;
    this.mesh.material.emissive.setHex(0xff003c);
    this.mesh.material.emissiveIntensity = 0.6;
  }

  update(dt) {
    if (this.damageFlash > 0) {
      this.damageFlash -= dt;
      if (this.damageFlash <= 0) {
        this.mesh.material.emissive.setHex(0x000000);
        this.mesh.material.emissiveIntensity = 0;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.physics.world.removeBody(this.body);
    this.nameEl.remove();
  }
}
