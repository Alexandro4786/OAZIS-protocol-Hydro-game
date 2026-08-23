import * as THREE from 'three';
import { GRID_SIZE, TILE_SIZE } from '../config.js';

export class TileRenderer {
  constructor(scene, gridWorld) {
    this.scene = scene;
    this.gridWorld = gridWorld;
    this.tileMeshes = [];
    this.waterMeshes = [];
    this.interactiveMeshes = []; // For Raycasting

    this.initMeshes();
  }

  syncTileReferences() {
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tileData = this.gridWorld.tiles[x][y];
        const mesh = this.tileMeshes[x][y];
        if (mesh) {
          mesh.userData = { gridX: x, gridY: y, tileData };
        }
      }
    }
  }

  initMeshes() {
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.98, 0.35, TILE_SIZE * 0.98);
    // Base tile material
    const baseMat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });

    for (let x = 0; x < this.gridWorld.size; x++) {
      this.tileMeshes[x] = [];
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tileData = this.gridWorld.tiles[x][y];
        
        const mat = baseMat.clone();
        const mesh = new THREE.Mesh(tileGeo, mat);
        
        mesh.position.set(
          x * TILE_SIZE + TILE_SIZE / 2,
          tileData.type === 'river' ? -0.22 : -0.175,
          y * TILE_SIZE + TILE_SIZE / 2
        );
        mesh.receiveShadow = true;
        mesh.castShadow = false;

        // Custom metadata for Raycaster
        mesh.userData = { gridX: x, gridY: y, tileData };
        this.scene.add(mesh);
        this.tileMeshes[x][y] = mesh;
        this.interactiveMeshes.push(mesh);

        // Agar daryo bo'lsa suv tekisligi qo'shish
        if (tileData.type === 'river') {
          const waterGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
          const waterMat = new THREE.MeshStandardMaterial({
            color: 0x00bcd4,
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85
          });
          const waterMesh = new THREE.Mesh(waterGeo, waterMat);
          waterMesh.rotation.x = -Math.PI / 2;
          waterMesh.position.set(
            x * TILE_SIZE + TILE_SIZE / 2,
            0.02,
            y * TILE_SIZE + TILE_SIZE / 2
          );
          this.scene.add(waterMesh);
          this.waterMeshes.push(waterMesh);
        }
      }
    }
  }

  update(time, activeHeatmap) {
    // Suv to'lqini animatsiyasi
    this.waterMeshes.forEach((mesh, idx) => {
      mesh.position.y = 0.02 + Math.sin(time * 3.0 + idx * 0.5) * 0.02;
    });

    // Har bir katak rangini heatmap yoki tabiiy holatga moslash
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tile = this.gridWorld.tiles[x][y];
        const mesh = this.tileMeshes[x][y];

        if (tile.type === 'river') {
          mesh.material.color.set(0x01579b);
          continue;
        }

        if (activeHeatmap === 'moisture') {
          // Namlik xaritasi: Qizil (<20) -> Sariq (20-40) -> Yashil (40-75) -> To'q Moviy (>75)
          const m = tile.moisture;
          if (m < 25) {
            mesh.material.color.setRGB(0.85, 0.2 + (m / 25) * 0.4, 0.1);
          } else if (m < 50) {
            mesh.material.color.setRGB(0.85, 0.85, 0.1);
          } else if (m <= 75) {
            mesh.material.color.setRGB(0.15, 0.85, 0.25);
          } else {
            mesh.material.color.setRGB(0.1, 0.5, 0.95);
          }
        } else if (activeHeatmap === 'loss') {
          // Isrof xaritasi: Suv yo'qotish tezligi bo'yicha qizil qatlam
          const loss = Math.min(1.0, tile.waterLossRate * 3.0);
          if (loss > 0.05) {
            mesh.material.color.setRGB(0.3 + loss * 0.7, 0.2 * (1 - loss), 0.1);
          } else {
            mesh.material.color.setRGB(0.2, 0.25, 0.3);
          }
        } else if (activeHeatmap === 'salinity') {
          // Sho'rlanish xaritasi: Oq/kulrang sho'r qatlam
          const s = tile.salinity / 100;
          mesh.material.color.setRGB(0.6 + s * 0.4, 0.5 + s * 0.45, 0.4 + s * 0.55);
        } else if (activeHeatmap === 'iot') {
          // IoT qamrovi xaritasi: Neon feruza va to'q ko'k
          if (tile.isCoveredByIot) {
            const pulse = (Math.sin(time * 4) + 1) * 0.1;
            mesh.material.color.setRGB(0.05, 0.5 + pulse, 0.7 + pulse);
          } else {
            mesh.material.color.setRGB(0.15, 0.18, 0.22);
          }
        } else {
          // Tabiiy holat (Qum -> Unumdor nam tuproq -> Yashil oazis)
          const moistureFactor = Math.min(1.0, tile.moisture / 100);
          const greenFactor = tile.greenery || 0;
          const saltFactor = Math.min(1.0, tile.salinity / 80);

          if (saltFactor > 0.4) {
            // Sho'rxok yer
            mesh.material.color.setRGB(0.85, 0.82, 0.78);
          } else if (greenFactor > 0.3) {
            // Yashil o'tloq / oazis tuprog'i
            const g = 0.45 + greenFactor * 0.35;
            mesh.material.color.setRGB(0.15 + (1 - greenFactor) * 0.2, g, 0.15);
          } else {
            // Quruq qumdan to'q nam tuproqqacha
            const r = 0.85 - moistureFactor * 0.45;
            const g = 0.70 - moistureFactor * 0.42;
            const b = 0.45 - moistureFactor * 0.25;
            mesh.material.color.setRGB(r, g, b);
          }
        }
      }
    }
  }
}
