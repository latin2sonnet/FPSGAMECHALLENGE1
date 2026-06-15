import * as CANNON from 'cannon-es';

export const GROUP_MAP = 1;
export const GROUP_REMOTE = 2;
export const GROUP_LOCAL = 4;

export class Physics {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -28, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.material = new CANNON.Material('default');
    const contact = new CANNON.ContactMaterial(this.material, this.material, {
      friction: 0.4,
      restitution: 0.05,
    });
    this.world.addContactMaterial(contact);

    this.bodies = [];
    this.playerBody = null;
  }

  addMap(map) {
    for (const def of map.bodies) {
      if (def.type === 'plane') {
        const shape = new CANNON.Plane();
        const body = new CANNON.Body({ mass: 0, material: this.material });
        body.addShape(shape);
        body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        body.collisionFilterGroup = GROUP_MAP;
        body.collisionFilterMask = -1;
        this.world.addBody(body);
        this.bodies.push(body);
      } else if (def.type === 'box') {
        const shape = new CANNON.Box(new CANNON.Vec3(def.size.x / 2, def.size.y / 2, def.size.z / 2));
        const body = new CANNON.Body({ mass: 0, material: this.material });
        body.addShape(shape);
        body.position.set(def.position.x, def.position.y, def.position.z);
        if (def.rotation) {
          body.quaternion.setFromEuler(def.rotation.x, def.rotation.y, def.rotation.z);
        }
        body.collisionFilterGroup = GROUP_MAP;
        body.collisionFilterMask = -1;
        this.world.addBody(body);
        this.bodies.push(body);
      }
    }
  }

  createPlayerBody() {
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1.1, 0.5));
    const body = new CANNON.Body({
      mass: 70,
      material: this.material,
      fixedRotation: true,
    });
    body.addShape(shape);
    body.position.set(0, 4, 0);
    body.linearDamping = 0.0;
    body.angularDamping = 1.0;
    body.collisionFilterGroup = GROUP_LOCAL;
    body.collisionFilterMask = GROUP_MAP | GROUP_REMOTE;
    this.world.addBody(body);
    this.playerBody = body;
    return body;
  }

  step(dt) {
    this.world.step(1 / 60, dt, 3);
  }

  isGrounded() {
    if (!this.playerBody) return false;
    const from = this.playerBody.position;
    const to = new CANNON.Vec3(from.x, from.y - 1.25, from.z);
    const ray = new CANNON.Ray(from, to);
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      skipBackfaces: true,
      collisionFilterMask: GROUP_MAP | GROUP_REMOTE,
    });
    return ray.result.hasHit;
  }

  raycast(from, to) {
    const ray = new CANNON.Ray(from, to);
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      skipBackfaces: true,
      collisionFilterMask: GROUP_MAP | GROUP_REMOTE,
    });
    return ray.result;
  }

  setPlayerPosition(x, y, z) {
    if (!this.playerBody) return;
    this.playerBody.position.set(x, y, z);
    this.playerBody.velocity.set(0, 0, 0);
    this.playerBody.angularVelocity.set(0, 0, 0);
  }
}
