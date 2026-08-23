import * as THREE from 'three';
import { TILE_SIZE, CROP_TYPES } from '../config.js';

export class BuildingRenderer {
  constructor(scene, gridWorld) {
    this.scene = scene;
    this.gridWorld = gridWorld;
    this.objectGroup = new THREE.Group();
    this.scene.add(this.objectGroup);

    // Cache mesh references by tile key
    this.buildingMeshes = new Map();
    this.pipeMeshes = new Map();
    this.cropMeshes = new Map();
    this.irrigationMeshes = new Map();

    // Reusable Materials & Geometries
    this.initSharedAssets();
  }

  clearAll() {
    while (this.objectGroup.children.length > 0) {
      this.objectGroup.remove(this.objectGroup.children[0]);
    }
    this.buildingMeshes.clear();
    this.pipeMeshes.clear();
    this.cropMeshes.clear();
    this.irrigationMeshes.clear();
  }

  initSharedAssets() {
    this.pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, TILE_SIZE, 8);
    this.pipeMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.8, roughness: 0.3 });

    this.activePipeMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      metalness: 0.3,
      roughness: 0.1,
      emissive: 0x00bcd4,
      emissiveIntensity: 0.75
    });

    this.pipeDryMat = new THREE.MeshStandardMaterial({
      color: 0x546e7a,
      metalness: 0.6,
      roughness: 0.4
    });

    this.pumpBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.0
    });

    // Material for sprinkler rotation
    this.sprinklerMat = new THREE.MeshStandardMaterial({ color: 0x0288d1, metalness: 0.7, roughness: 0.3 });
  }

  update(time, dt) {
    // 1. Quvurlardagi suv oqimi pulsatsiyasi
    const pulse = 0.6 + Math.sin(time * 5.0) * 0.35;
    this.activePipeMat.emissiveIntensity = pulse;
    this.pumpBeaconMat.emissiveIntensity = 0.7 + Math.sin(time * 8.0) * 0.3;

    // 2. Sprinkler aylanish animatsiyasi
    this.irrigationMeshes.forEach((meshObj) => {
      if (meshObj.type === 'sprinkler' && meshObj.active) {
        meshObj.rotator.rotation.y += dt * 3.5;
      } else if (meshObj.type === 'scada_ai') {
        meshObj.sensorBeacon.material.emissiveIntensity = 0.5 + Math.sin(time * 6) * 0.4;
      }
    });

    // 3. Ekinlar tebranishi (shabboda)
    this.cropMeshes.forEach((mesh) => {
      if (mesh.sway) {
        mesh.rotation.z = Math.sin(time * 2.5 + mesh.position.x) * 0.06;
      }
    });
  }

  sync() {
    // Grid holatini 3D sahna bilan to'liq sinxronlashtirish
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const tile = this.gridWorld.tiles[x][y];
        const key = `${x}_${y}`;
        const posX = x * TILE_SIZE + TILE_SIZE / 2;
        const posZ = y * TILE_SIZE + TILE_SIZE / 2;
        const posY = tile.elevation || 0;

        // Inshootlar (Bino/Nasos/Quyosh/IoT)
        this.syncBuilding(key, tile, posX, posY, posZ);

        // Quvurlar
        this.syncPipe(key, tile, posX, posY, posZ);

        // Sug'orish uskunalari
        this.syncIrrigation(key, tile, posX, posY, posZ);

        // Ekinlar
        this.syncCrop(key, tile, posX, posY, posZ);
      }
    }
  }

  syncBuilding(key, tile, x, y, z) {
    const existing = this.buildingMeshes.get(key);
    if (!tile.building) {
      if (existing) {
        this.objectGroup.remove(existing.group);
        this.buildingMeshes.delete(key);
      }
      return;
    }

    if (existing && existing.type === tile.building) return; // Allaqachon mavjud

    if (existing) {
      this.objectGroup.remove(existing.group);
    }

    const group = new THREE.Group();
    group.position.set(x, y, z);

    if (tile.building === 'canal_intake') {
      // Daryo qirg'og'idagi kuchli nasos stansiyasi
      const stationGeo = new THREE.BoxGeometry(1.3, 0.85, 1.3);
      const stationMat = new THREE.MeshStandardMaterial({ color: 0x0277bd, metalness: 0.6, roughness: 0.2 });
      const station = new THREE.Mesh(stationGeo, stationMat);
      station.position.y = 0.42;
      station.castShadow = true;
      group.add(station);

      const roofGeo = new THREE.ConeGeometry(1.1, 0.5, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x01579b });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.1;
      group.add(roof);

      // Daryo ichiga tushuvchi so'rish trubasi
      const suctionPipeGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 10);
      const suctionPipe = new THREE.Mesh(suctionPipeGeo, this.activePipeMat);
      suctionPipe.rotation.z = Math.PI / 3;
      suctionPipe.position.set(-0.8, 0.15, 0);
      group.add(suctionPipe);

      // Chiqish quvuri (Quruqlik tomon ulanadigan quvur)
      const outletPipeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10);
      const outletPipe = new THREE.Mesh(outletPipeGeo, this.activePipeMat);
      outletPipe.rotation.z = Math.PI / 2;
      outletPipe.position.set(0.65, 0.18, 0);
      group.add(outletPipe);

      // Suv indikatori (Blink LED)
      const beaconGeo = new THREE.SphereGeometry(0.18, 8, 8);
      const beacon = new THREE.Mesh(beaconGeo, this.pumpBeaconMat);
      beacon.position.set(0, 1.5, 0);
      group.add(beacon);
    } else if (tile.building === 'deep_well') {
      // Arteziyan quduq vishkasi
      const towerGeo = new THREE.CylinderGeometry(0.2, 0.7, 2.2, 4);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x263238, wireframe: true });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.y = 1.1;
      group.add(tower);

      // VFD elektr dvigateli
      const motorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x0277bd, metalness: 0.7 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.y = 0.35;
      motor.castShadow = true;
      group.add(motor);
    } else if (tile.building === 'iot_tower') {
      // SCADA aloqa minorasi
      const mastGeo = new THREE.CylinderGeometry(0.06, 0.15, 3.2, 6);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, metalness: 0.8 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 1.6;
      group.add(mast);

      // Radar antennasi
      const dishGeo = new THREE.SphereGeometry(0.35, 8, 8, 0, Math.PI);
      const dishMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.9 });
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(0, 3.0, 0);
      dish.rotation.x = Math.PI / 4;
      group.add(dish);

      // LED chirog'i
      const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.9 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 3.3, 0);
      group.add(beacon);
    } else if (tile.building === 'solar_array') {
      // Quyosh batareyasi
      const panelGeo = new THREE.BoxGeometry(1.6, 0.08, 1.4);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, metalness: 0.9, roughness: 0.1 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.y = 0.6;
      panel.rotation.x = Math.PI / 6;
      panel.castShadow = true;
      group.add(panel);

      const standGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.y = 0.3;
      group.add(stand);
    }

    this.objectGroup.add(group);
    this.buildingMeshes.set(key, { group, type: tile.building });
  }

  syncPipe(key, tile, x, y, z) {
    const existing = this.pipeMeshes.get(key);
    if (!tile.hasPipe) {
      if (existing) {
        this.objectGroup.remove(existing);
        this.pipeMeshes.delete(key);
      }
      return;
    }

    // 4 tomonlama qo'shnilarni tekshirish
    const dirs = [
      { dx: 0, dy: 1, rot: 'x' },   // Janub
      { dx: 0, dy: -1, rot: 'x' },  // Shimol
      { dx: 1, dy: 0, rot: 'z' },   // Sharq
      { dx: -1, dy: 0, rot: 'z' }   // G'arb
    ];

    const connectedDirs = [];
    dirs.forEach(d => {
      const n = this.gridWorld.getTile(tile.x + d.dx, tile.y + d.dy);
      if (n && (n.hasPipe || n.building === 'canal_intake' || n.building === 'deep_well' || n.irrigation !== null)) {
        connectedDirs.push(d);
      }
    });

    const isWater = tile.isConnectedToWater;
    const mask = `${isWater ? 'W1' : 'W0'}_${connectedDirs.map(d => `${d.dx}_${d.dy}`).join(',')}`;

    if (existing && existing.userData?.mask === mask) {
      return; // Allaqachon to'g'ri ulangan
    }

    if (existing) {
      this.objectGroup.remove(existing);
    }

    const pipeGroup = new THREE.Group();
    pipeGroup.position.set(x, y, z);
    pipeGroup.userData = { mask };

    const curMat = isWater ? this.activePipeMat : this.pipeDryMat;

    // Markaziy ulanish bo'g'ini (Hub Joint)
    const nodeGeo = new THREE.SphereGeometry(0.19, 10, 10);
    const nodeMesh = new THREE.Mesh(nodeGeo, curMat);
    nodeMesh.position.y = 0.14;
    pipeGroup.add(nodeMesh);

    // Barcha ulangan yo'nalishlarga to'liq chekkagacha yetib boruvchi quvurlar
    if (connectedDirs.length > 0) {
      connectedDirs.forEach(d => {
        const segGeo = new THREE.CylinderGeometry(0.13, 0.13, TILE_SIZE / 2, 10);
        const segMesh = new THREE.Mesh(segGeo, curMat);
        segMesh.position.set(d.dx * (TILE_SIZE / 4), 0.14, d.dy * (TILE_SIZE / 4));
        
        if (d.rot === 'z') {
          segMesh.rotation.z = Math.PI / 2;
        } else {
          segMesh.rotation.x = Math.PI / 2;
        }
        pipeGroup.add(segMesh);
      });
    } else {
      // Hali ulanmagan yolg'iz quvur (Kichik ko'ndalang qirra bilan ko'rsatish)
      const stubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
      const stubMesh = new THREE.Mesh(stubGeo, curMat);
      stubMesh.rotation.z = Math.PI / 2;
      stubMesh.position.y = 0.14;
      pipeGroup.add(stubMesh);
    }

    this.objectGroup.add(pipeGroup);
    this.pipeMeshes.set(key, pipeGroup);
  }

  syncIrrigation(key, tile, x, y, z) {
    const existing = this.irrigationMeshes.get(key);
    if (!tile.irrigation) {
      if (existing) {
        this.objectGroup.remove(existing.group);
        this.irrigationMeshes.delete(key);
      }
      return;
    }

    if (existing && existing.type === tile.irrigation) {
      existing.active = tile.irrigationActive && tile.isConnectedToWater;
      return;
    }

    if (existing) {
      this.objectGroup.remove(existing.group);
    }

    const group = new THREE.Group();
    group.position.set(x, y, z);

    let rotator = null;
    let sensorBeacon = null;

    if (tile.irrigation === 'furrow') {
      // Egatlar (jo'yaklar)
      for (let i = -0.6; i <= 0.6; i += 0.4) {
        const ditchGeo = new THREE.BoxGeometry(0.12, 0.06, TILE_SIZE * 0.9);
        const ditchMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });
        const ditch = new THREE.Mesh(ditchGeo, ditchMat);
        ditch.position.set(i, 0.03, 0);
        group.add(ditch);
      }
    } else if (tile.irrigation === 'sprinkler') {
      // Purkagich markaziy tirgagi
      const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8);
      const post = new THREE.Mesh(postGeo, this.pipeMat);
      post.position.y = 0.6;
      group.add(post);

      // Aylanuvchi purkagich kallagi
      rotator = new THREE.Group();
      rotator.position.y = 1.2;
      const nozGeo = new THREE.BoxGeometry(0.6, 0.08, 0.08);
      const noz = new THREE.Mesh(nozGeo, this.sprinklerMat);
      rotator.add(noz);
      group.add(rotator);
    } else if (tile.irrigation === 'drip_surface') {
      // Er usti tomchilatish shlanglari
      for (let i = -0.6; i <= 0.6; i += 0.4) {
        const hoseGeo = new THREE.CylinderGeometry(0.03, 0.03, TILE_SIZE * 0.9, 6);
        const hoseMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
        const hose = new THREE.Mesh(hoseGeo, hoseMat);
        hose.rotation.x = Math.PI / 2;
        hose.position.set(i, 0.03, 0);
        group.add(hose);
      }
    } else if (tile.irrigation === 'sdi') {
      // Yer osti tomchilatish - yashil neon datchik belgisi
      const markGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.15, 6);
      const markMat = new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.4 });
      const mark = new THREE.Mesh(markGeo, markMat);
      mark.position.y = 0.08;
      group.add(mark);
    } else if (tile.irrigation === 'scada_ai') {
      // Smart AI IoT datchik ustuni
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.4, 6);
      const pole = new THREE.Mesh(poleGeo, this.pipeMat);
      pole.position.y = 0.7;
      group.add(pole);

      const beaconGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xd500f9, emissive: 0xd500f9, emissiveIntensity: 0.8 });
      sensorBeacon = new THREE.Mesh(beaconGeo, beaconMat);
      sensorBeacon.position.y = 1.4;
      group.add(sensorBeacon);
    }

    this.objectGroup.add(group);
    this.irrigationMeshes.set(key, {
      group,
      type: tile.irrigation,
      active: tile.irrigationActive && tile.isConnectedToWater,
      rotator,
      sensorBeacon
    });
  }

  syncCrop(key, tile, x, y, z) {
    const existing = this.cropMeshes.get(key);
    if (!tile.crop) {
      if (existing) {
        this.objectGroup.remove(existing);
        this.cropMeshes.delete(key);
      }
      return;
    }

    const stage = tile.crop.stage || 0;
    const isWithered = tile.crop.isWithered;
    const cropType = tile.crop.type;

    if (existing && existing.userData.stage === stage && existing.userData.isWithered === isWithered) {
      return; // O'zgarishsiz
    }

    if (existing) {
      this.objectGroup.remove(existing);
    }

    const cropGroup = new THREE.Group();
    cropGroup.position.set(x, y, z);
    cropGroup.userData = { stage, isWithered };
    cropGroup.sway = !isWithered;

    // Ranglar va materiallar
    let plantColor = 0x4caf50;
    if (isWithered) plantColor = 0x5d4037; // Qurigan
    else if (tile.crop.health < 40) plantColor = 0xafb42b; // Sariq

    const plantMat = new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.6 });

    // O'simlik turi bo'yicha 3D modellash
    if (cropType === 'cotton') {
      const scale = 0.3 + stage * 0.22;
      const bushGeo = new THREE.DodecahedronGeometry(scale, 1);
      const bush = new THREE.Mesh(bushGeo, plantMat);
      bush.position.y = scale * 0.8;
      bush.castShadow = true;
      cropGroup.add(bush);

      // Pishgan paxta ko'saklari
      if (stage >= 3 && !isWithered) {
        const bollMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        for (let i = 0; i < 5; i++) {
          const bollGeo = new THREE.SphereGeometry(0.12, 6, 6);
          const boll = new THREE.Mesh(bollGeo, bollMat);
          const angle = (i / 5) * Math.PI * 2;
          boll.position.set(Math.cos(angle) * scale * 0.7, scale * 0.8 + Math.sin(i) * 0.2, Math.sin(angle) * scale * 0.7);
          cropGroup.add(boll);
        }
      }
    } else if (cropType === 'wheat' || cropType === 'corn') {
      const stalkCount = 6 + stage * 2;
      for (let i = 0; i < stalkCount; i++) {
        const height = (0.3 + stage * 0.25) * (0.8 + Math.random() * 0.4);
        const stalkGeo = new THREE.CylinderGeometry(0.02, 0.03, height, 4);
        const color = cropType === 'wheat' && stage >= 3 ? 0xfbc02d : plantColor;
        const stalk = new THREE.Mesh(stalkGeo, new THREE.MeshStandardMaterial({ color }));
        const offX = (Math.random() - 0.5) * 1.2;
        const offZ = (Math.random() - 0.5) * 1.2;
        stalk.position.set(offX, height / 2, offZ);
        cropGroup.add(stalk);
      }
    } else if (cropType === 'orchard') {
      // Mevali daraxt
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.0 + stage * 0.3, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = (1.0 + stage * 0.3) / 2;
      trunk.castShadow = true;
      cropGroup.add(trunk);

      const foliageGeo = new THREE.SphereGeometry(0.6 + stage * 0.2, 7, 7);
      const foliage = new THREE.Mesh(foliageGeo, plantMat);
      foliage.position.y = 1.0 + stage * 0.4;
      foliage.castShadow = true;
      cropGroup.add(foliage);

      // Qizil olmalar
      if (stage >= 3 && !isWithered) {
        const fruitMat = new THREE.MeshStandardMaterial({ color: 0xe53935 });
        for (let i = 0; i < 4; i++) {
          const fruitGeo = new THREE.SphereGeometry(0.1, 5, 5);
          const fruit = new THREE.Mesh(fruitGeo, fruitMat);
          fruit.position.set((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
          cropGroup.add(fruit);
        }
      }
    } else if (cropType === 'oasis_tree') {
      // Xurmo / Saksovul daraxti
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2.2, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      cropGroup.add(trunk);

      // Xurmo barglari
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
      for (let i = 0; i < 6; i++) {
        const leafGeo = new THREE.ConeGeometry(0.3, 1.6, 4);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const angle = (i / 6) * Math.PI * 2;
        leaf.rotation.x = Math.PI / 2.5;
        leaf.rotation.y = angle;
        leaf.position.set(0, 2.1, 0);
        cropGroup.add(leaf);
      }
    }

    this.objectGroup.add(cropGroup);
    this.cropMeshes.set(key, cropGroup);
  }
}
