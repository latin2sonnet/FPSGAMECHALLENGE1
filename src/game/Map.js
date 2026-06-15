import * as THREE from 'three';

export class Map {
  constructor(scene) {
    this.scene = scene;
    this.bodies = []; // physics shape data {position, size, type:'box'}
    this.meshes = [];
    this.build();
  }

  addBox(x, y, z, w, h, d, color = 0x112233, emissive = 0x001122) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.2,
      emissive,
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.bodies.push({
      type: 'box',
      position: { x, y, z },
      size: { x: w, y: h, z: d },
    });
    return mesh;
  }

  addRamp(x, y, z, w, h, d, rotZ, color = 0x223344) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.bodies.push({
      type: 'box',
      position: { x, y, z },
      size: { x: w, y: h, z: d },
      rotation: { x: 0, y: 0, z: rotZ },
    });
    return mesh;
  }

  addNeonStrip(parent, x, y, z, w, h, d, color) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  build() {
    // Floor
    const floorGeom = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080c12,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.bodies.push({ type: 'plane' });

    // Grid neon lines on floor
    const grid = new THREE.GridHelper(120, 60, 0x00eaff, 0x003344);
    grid.position.y = 0.05;
    this.scene.add(grid);

    // Central raised platform
    this.addBox(0, 2, 0, 12, 4, 12, 0x16202e, 0x002244);
    this.addNeonStrip(this.scene, 0, 4.05, 6, 12, 0.1, 0.2, 0x00eaff);
    this.addNeonStrip(this.scene, 0, 4.05, -6, 12, 0.1, 0.2, 0x00eaff);

    // Corner towers
    this.addBox(-30, 6, -30, 8, 12, 8, 0x1a1625, 0x220044);
    this.addBox(30, 6, -30, 8, 12, 8, 0x1a1625, 0x220044);
    this.addBox(-30, 6, 30, 8, 12, 8, 0x1a1625, 0x220044);
    this.addBox(30, 6, 30, 8, 12, 8, 0x1a1625, 0x220044);

    // Connecting bridges
    this.addBox(0, 5, -30, 44, 1.5, 5, 0x14202a, 0x001133);
    this.addBox(0, 5, 30, 44, 1.5, 5, 0x14202a, 0x001133);
    this.addBox(-30, 5, 0, 5, 1.5, 44, 0x14202a, 0x001133);
    this.addBox(30, 5, 0, 5, 1.5, 44, 0x14202a, 0x001133);

    // Side platforms
    this.addBox(-18, 3, -18, 8, 2, 8, 0x1b2532, 0x001a2a);
    this.addBox(18, 3, -18, 8, 2, 8, 0x1b2532, 0x001a2a);
    this.addBox(-18, 3, 18, 8, 2, 8, 0x1b2532, 0x001a2a);
    this.addBox(18, 3, 18, 8, 2, 8, 0x1b2532, 0x001a2a);

    // Ramps to center
    this.addRamp(-10, 1.2, 0, 8, 0.5, 3, -Math.PI / 6, 0x1c2633);
    this.addRamp(10, 1.2, 0, 8, 0.5, 3, Math.PI / 6, 0x1c2633);

    // Outer walls
    const wallH = 10;
    const wallT = 2;
    this.addBox(0, wallH / 2, -60 + wallT / 2, 120, wallH, wallT, 0x0d1117, 0x000811);
    this.addBox(0, wallH / 2, 60 - wallT / 2, 120, wallH, wallT, 0x0d1117, 0x000811);
    this.addBox(-60 + wallT / 2, wallH / 2, 0, wallT, wallH, 120, 0x0d1117, 0x000811);
    this.addBox(60 - wallT / 2, wallH / 2, 0, wallT, wallH, 120, 0x0d1117, 0x000811);

    // Decorative pillars
    for (const [px, pz] of [[-45, -45], [45, -45], [-45, 45], [45, 45]]) {
      this.addBox(px, 3, pz, 3, 6, 3, 0x101820, 0x001122);
      this.addNeonStrip(this.scene, px, 6.05, pz, 3.2, 0.1, 3.2, 0xff003c);
    }
  }
}
