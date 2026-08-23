import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config.js';

export class Terraformer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.oasisFoliage = [];
    this.initSurroundings();
  }

  initSurroundings() {
    const worldCenter = (GRID_SIZE * TILE_SIZE) / 2;
    const groundGeo = new THREE.PlaneGeometry(160, 160, 24, 24);
    
    // Qumtepalar relefi
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const distFromCenter = Math.sqrt(vx * vx + vy * vy);
      if (distFromCenter > (GRID_SIZE * TILE_SIZE) * 0.7) {
        pos.setZ(i, Math.sin(vx * 0.1) * Math.cos(vy * 0.1) * 2.5);
      }
    }
    groundGeo.computeVertexNormals();

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0xc2a679,
      roughness: 0.9,
      metalness: 0.05
    });

    const groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(worldCenter, -0.22, worldCenter);
    groundMesh.receiveShadow = true;
    this.group.add(groundMesh);

    // Atrofdagi oazis daraxtlari (Eko-score o'sishi bilan ochiladi)
    const palmMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = (GRID_SIZE * TILE_SIZE) * 0.65 + Math.random() * 8;
      const x = worldCenter + Math.cos(angle) * radius;
      const z = worldCenter + Math.sin(angle) * radius;

      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3.0, 5);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      treeGroup.add(trunk);

      const leavesGeo = new THREE.ConeGeometry(1.6, 2.4, 5);
      const leaves = new THREE.Mesh(leavesGeo, palmMat);
      leaves.position.y = 3.5;
      treeGroup.add(leaves);

      treeGroup.scale.set(0.01, 0.01, 0.01); // Dastlab kichik
      this.group.add(treeGroup);
      this.oasisFoliage.push({ group: treeGroup, targetScale: 0.6 + Math.random() * 0.6 });
    }
  }

  update(ecoScore) {
    const factor = Math.min(1.0, ecoScore / 80);

    // Tuproq rangi cho'ldan yashil oazisga aylanadi
    const r = 0.76 - factor * 0.35;
    const g = 0.65 - factor * 0.15;
    const b = 0.47 - factor * 0.25;
    this.groundMat.color.setRGB(r, g, b);

    // Daraxtlar asta-sekin bo'y cho'zadi
    this.oasisFoliage.forEach((item, idx) => {
      const threshold = (idx / this.oasisFoliage.length) * 80;
      if (ecoScore > threshold) {
        const curScale = item.group.scale.x;
        const target = item.targetScale;
        const newScale = curScale + (target - curScale) * 0.05;
        item.group.scale.set(newScale, newScale, newScale);
      }
    });
  }
}
