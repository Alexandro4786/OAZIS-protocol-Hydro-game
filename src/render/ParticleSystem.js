import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config.js';

export class ParticleSystem {
  constructor(scene, gridWorld) {
    this.scene = scene;
    this.gridWorld = gridWorld;

    // 1. Suv tomchilari zarrachalari
    this.sprayCount = 300;
    this.sprayGeo = new THREE.BufferGeometry();
    this.sprayPositions = new Float32Array(this.sprayCount * 3);
    this.sprayVelocities = [];

    for (let i = 0; i < this.sprayCount; i++) {
      this.sprayPositions[i * 3 + 0] = -999;
      this.sprayPositions[i * 3 + 1] = -999;
      this.sprayPositions[i * 3 + 2] = -999;
      this.sprayVelocities.push(new THREE.Vector3());
    }

    this.sprayGeo.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3));
    this.sprayMat = new THREE.PointsMaterial({
      color: 0x4fc3f7,
      size: 0.15,
      transparent: true,
      opacity: 0.8
    });
    this.sprayPoints = new THREE.Points(this.sprayGeo, this.sprayMat);
    this.scene.add(this.sprayPoints);

    // 2. Qushlar (Oazis ko'tarilganda paydo bo'ladi)
    this.birdsGroup = new THREE.Group();
    this.scene.add(this.birdsGroup);
    this.initBirds();
  }

  initBirds() {
    const birdGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0.2,
      -0.3, 0.1, 0,
      0, 0, -0.2,
      0, 0, 0.2,
      0.3, 0.1, 0,
      0, 0, -0.2
    ]);
    birdGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    this.birds = [];
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Mesh(birdGeo, birdMat);
      bird.position.set(
        (GRID_SIZE * TILE_SIZE) / 2 + (Math.random() - 0.5) * 15,
        10 + Math.random() * 5,
        (GRID_SIZE * TILE_SIZE) / 2 + (Math.random() - 0.5) * 15
      );
      bird.userData = {
        angle: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.4,
        radius: 8 + Math.random() * 6,
        baseY: bird.position.y
      };
      this.birdsGroup.add(bird);
      this.birds.push(bird);
    }
  }

  update(time, dt, ecoScore, crisis) {
    // 1. Sprinkler va truba yorilishidan suv sachrashi
    let pIdx = 0;
    const activeSources = [];

    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tile = this.gridWorld.tiles[x][y];
        if (tile.irrigation === 'sprinkler' && tile.irrigationActive && tile.isConnectedToWater) {
          activeSources.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: 1.2 + tile.elevation,
            z: y * TILE_SIZE + TILE_SIZE / 2,
            type: 'sprinkler'
          });
        }
      }
    }

    // Inqiroz: truba yorilishi favvorasi
    if (crisis && crisis.id === 'pipe_burst') {
      activeSources.push({
        x: (GRID_SIZE * TILE_SIZE) / 2,
        y: 0.2,
        z: (GRID_SIZE * TILE_SIZE) / 2,
        type: 'burst'
      });
    }

    if (activeSources.length > 0) {
      for (let i = 0; i < this.sprayCount; i++) {
        const src = activeSources[i % activeSources.length];
        if (this.sprayPositions[i * 3 + 1] <= 0 || Math.random() < 0.08) {
          this.sprayPositions[i * 3 + 0] = src.x;
          this.sprayPositions[i * 3 + 1] = src.y;
          this.sprayPositions[i * 3 + 2] = src.z;

          const spread = src.type === 'burst' ? 1.5 : 0.8;
          const vy = src.type === 'burst' ? 4.0 : 1.5;
          this.sprayVelocities[i].set(
            (Math.random() - 0.5) * spread,
            vy + Math.random() * 0.8,
            (Math.random() - 0.5) * spread
          );
        } else {
          // Harakat va gravitatsiya
          this.sprayVelocities[i].y -= 9.8 * dt * 0.5;
          this.sprayPositions[i * 3 + 0] += this.sprayVelocities[i].x * dt;
          this.sprayPositions[i * 3 + 1] += this.sprayVelocities[i].y * dt;
          this.sprayPositions[i * 3 + 2] += this.sprayVelocities[i].z * dt;
        }
      }
      this.sprayGeo.attributes.position.needsUpdate = true;
    } else {
      for (let i = 0; i < this.sprayCount; i++) {
        this.sprayPositions[i * 3 + 1] = -999;
      }
      this.sprayGeo.attributes.position.needsUpdate = true;
    }

    // 2. Qushlar parvozi (Eko-Ball > 30 bo'lsa)
    const showBirds = ecoScore >= 30;
    this.birdsGroup.visible = showBirds;
    if (showBirds) {
      this.birds.forEach((bird) => {
        bird.userData.angle += dt * bird.userData.speed * 0.4;
        const centerX = (GRID_SIZE * TILE_SIZE) / 2;
        const centerZ = (GRID_SIZE * TILE_SIZE) / 2;
        bird.position.x = centerX + Math.cos(bird.userData.angle) * bird.userData.radius;
        bird.position.z = centerZ + Math.sin(bird.userData.angle) * bird.userData.radius;
        bird.position.y = bird.userData.baseY + Math.sin(time * 3 + bird.userData.angle) * 0.5;
        bird.rotation.y = -bird.userData.angle;
      });
    }
  }
}
