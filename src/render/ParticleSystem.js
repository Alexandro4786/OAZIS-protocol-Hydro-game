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

    // 2. Yomg'ir tizimi (Rain Particles)
    this.rainCount = 800;
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = [];

    const mapWidth = GRID_SIZE * TILE_SIZE;
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3 + 0] = (Math.random() - 0.2) * mapWidth * 1.4;
      this.rainPositions[i * 3 + 1] = Math.random() * 25 + 5;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.2) * mapWidth * 1.4;
      this.rainVelocities.push({
        y: 18 + Math.random() * 10,
        x: 2 + Math.random() * 2
      });
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0x81d4fa,
      size: 0.22,
      transparent: true,
      opacity: 0.75
    });
    this.rainPoints = new THREE.Points(this.rainGeo, this.rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // 3. Shamol va Qum/To'zon zarrachalari (Wind Dust Storm)
    this.dustCount = 250;
    this.dustGeo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustSpeeds = [];

    for (let i = 0; i < this.dustCount; i++) {
      this.dustPositions[i * 3 + 0] = Math.random() * mapWidth * 1.5 - mapWidth * 0.25;
      this.dustPositions[i * 3 + 1] = Math.random() * 4 + 0.3;
      this.dustPositions[i * 3 + 2] = Math.random() * mapWidth * 1.5 - mapWidth * 0.25;
      this.dustSpeeds.push(12 + Math.random() * 10);
    }

    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustMat = new THREE.PointsMaterial({
      color: 0xd7ccc8,
      size: 0.28,
      transparent: true,
      opacity: 0.5
    });
    this.dustPoints = new THREE.Points(this.dustGeo, this.dustMat);
    this.dustPoints.visible = false;
    this.scene.add(this.dustPoints);

    // 4. Qushlar (Oazis ko'tarilganda paydo bo'ladi)
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

  update(time, dt, ecoScore, crisis, weather = {}, timeOfDay = 12) {
    const mapWidth = GRID_SIZE * TILE_SIZE;

    // 1. Sprinkler va truba yorilishidan suv sachrashi
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

    // 2. Yomg'ir simulyatsiyasi (Rain Particles)
    const isRaining = (weather.rainRate && weather.rainRate > 0) || weather.id === 'rain' || weather.id === 'storm_flood';
    this.rainPoints.visible = !!isRaining;
    if (isRaining) {
      const windFactor = (weather.windSpeed || 5) * 0.2;
      const speedMult = weather.id === 'storm_flood' ? 1.5 : 1.0;
      for (let i = 0; i < this.rainCount; i++) {
        this.rainPositions[i * 3 + 1] -= this.rainVelocities[i].y * dt * speedMult;
        this.rainPositions[i * 3 + 0] += windFactor * dt * 4.0;
        this.rainPositions[i * 3 + 2] += windFactor * dt * 1.5;

        // Erga tushganda tepadan qayta yog'adi
        if (this.rainPositions[i * 3 + 1] <= 0) {
          this.rainPositions[i * 3 + 1] = 20 + Math.random() * 8;
          this.rainPositions[i * 3 + 0] = (Math.random() - 0.3) * mapWidth * 1.4;
          this.rainPositions[i * 3 + 2] = (Math.random() - 0.3) * mapWidth * 1.4;
        }
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }

    // 3. Kuchli Shamol va Chang to'zon (Dust Storm Particles)
    const isWindy = (weather.windSpeed && weather.windSpeed > 12) || weather.id === 'windy' || (crisis && crisis.id === 'heatwave');
    this.dustPoints.visible = !!isWindy;
    if (isWindy) {
      const windSpeed = (weather.windSpeed || 15);
      for (let i = 0; i < this.dustCount; i++) {
        this.dustPositions[i * 3 + 0] += this.dustSpeeds[i] * (windSpeed / 15) * dt;
        this.dustPositions[i * 3 + 1] += Math.sin(time * 2 + i) * dt * 0.8;
        this.dustPositions[i * 3 + 2] += (Math.random() - 0.5) * dt * 2.0;

        if (this.dustPositions[i * 3 + 0] > mapWidth * 1.3) {
          this.dustPositions[i * 3 + 0] = -mapWidth * 0.25;
          this.dustPositions[i * 3 + 1] = Math.random() * 4 + 0.3;
          this.dustPositions[i * 3 + 2] = Math.random() * mapWidth * 1.4 - mapWidth * 0.2;
        }
      }
      this.dustGeo.attributes.position.needsUpdate = true;
    }

    // 4. Qushlar parvozi (Faqat kunduzi: 06:00 - 19:00, Eko-Ball > 30, va yomg'ir/to'fon/garmsel bo'lmaganda)
    const isDay = timeOfDay >= 6 && timeOfDay <= 19;
    const showBirds = isDay && ecoScore >= 30 && !isRaining && weather.id !== 'storm_flood' && weather.id !== 'windy';
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
