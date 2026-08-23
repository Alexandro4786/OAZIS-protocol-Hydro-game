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

  update(time, dt, weather = {}) {
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

    // 2.1. Shamol quduq nasosi parraklari aylanishi
    this.buildingMeshes.forEach((meshObj) => {
      if (meshObj.type === 'windmill_pump' && meshObj.group.userData.rotor) {
        meshObj.group.userData.rotor.rotation.z += (weather.windSpeed || 5) * 0.35 * dt;
      }
    });

    // 3. Ekinlar va daraxtlarning shamolda dinamik tebranishi
    const windSpeed = weather.windSpeed || 4;
    const windFreq = 1.5 + windSpeed * 0.25;
    const windAngle = 0.03 + Math.min(0.2, windSpeed * 0.008);

    this.cropMeshes.forEach((mesh) => {
      mesh.rotation.z = Math.sin(time * windFreq + mesh.position.x * 0.8) * windAngle;
      mesh.rotation.x = Math.cos(time * (windFreq * 0.8) + mesh.position.z * 0.8) * (windAngle * 0.5);
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
    } else if (tile.building === 'well') {
      // ===== 1. ODDIY YER OSTI QUDUQ =====
      // Tosh devorli quduq xalqasi
      const wellGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.5, 12, 1, true);
      const wellMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.85 });
      const wellMesh = new THREE.Mesh(wellGeo, wellMat);
      wellMesh.position.y = 0.25;
      wellMesh.castShadow = true;
      group.add(wellMesh);

      // Quduq ichidagi suv oynasi (Aqua surface)
      const waterGeo = new THREE.CircleGeometry(0.5, 12);
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.1, metalness: 0.8 });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.y = 0.22;
      group.add(waterMesh);

      // 2 ta yog'och ustun
      const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
      [-0.45, 0.45].forEach(px => {
        const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 5);
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0.7, 0);
        group.add(post);
      });

      // Yog'och shingilli tomi
      const roofGeo = new THREE.ConeGeometry(0.75, 0.45, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.45;
      group.add(roof);

      // Chelak (Bucket)
      const bucketGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.16, 6);
      const bucketMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
      const bucket = new THREE.Mesh(bucketGeo, bucketMat);
      bucket.position.set(0, 0.45, 0);
      group.add(bucket);
    } else if (tile.building === 'windmill_pump') {
      // ===== 2. SHAMOL TURBINALI QUDUQ NASOSI =====
      // Beton poydevor
      const baseGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.25, 8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.8 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.12;
      group.add(baseMesh);

      // Metall ferma minora (Lattice Tower)
      const towerGeo = new THREE.CylinderGeometry(0.18, 0.55, 2.6, 4);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, wireframe: true });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.y = 1.4;
      group.add(tower);

      // Shamol turbinasi rotori (Aylanuvchi parraklar)
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, 2.7, 0.1);

      const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8);
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.8 });
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.x = Math.PI / 2;
      rotorGroup.add(hub);

      // 6 ta aerodinamik parrak
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < 6; i++) {
        const bladeGeo = new THREE.BoxGeometry(0.1, 0.75, 0.02);
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        const angle = (i / 6) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
        blade.rotation.z = angle;
        rotorGroup.add(blade);
      }
      group.add(rotorGroup);
      group.userData.rotor = rotorGroup; // Animatsiya uchun
    } else if (tile.building === 'deep_well') {
      // ===== 3. ELEKTR VFD CHUQUR NASOS STANSIYASI =====
      // Beton poydevor
      const baseGeo = new THREE.BoxGeometry(1.4, 0.25, 1.4);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.12;
      group.add(base);

      // Elektr boshqaruv shkafi (VFD Controller)
      const cabinetGeo = new THREE.BoxGeometry(0.4, 0.9, 0.3);
      const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.7 });
      const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
      cabinet.position.set(-0.35, 0.65, 0);
      group.add(cabinet);

      // Yuqori bosimli ko'k nasos motori
      const motorGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
      const motorMat = new THREE.MeshStandardMaterial({ color: 0x0277bd, metalness: 0.8, roughness: 0.2 });
      const motor = new THREE.Mesh(motorGeo, motorMat);
      motor.position.set(0.3, 0.6, 0);
      motor.castShadow = true;
      group.add(motor);

      // Chiqish gidravlik manifolti
      const outPipeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.8, 8);
      const outPipe = new THREE.Mesh(outPipeGeo, this.activePipeMat);
      outPipe.rotation.z = Math.PI / 2;
      outPipe.position.set(0.65, 0.4, 0);
      group.add(outPipe);

      // LED Quvvat indikatori
      const ledGeo = new THREE.SphereGeometry(0.08, 6, 6);
      const ledMat = new THREE.MeshStandardMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 1.0 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(-0.35, 1.15, 0.12);
      group.add(led);
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
    const isWithered = !!tile.crop.isWithered;
    const healthTier = isWithered ? -1 : Math.floor((tile.crop.health || 0) / 30);
    const cropType = tile.crop.type;

    if (existing && existing.userData.stage === stage && existing.userData.isWithered === isWithered && existing.userData.healthTier === healthTier) {
      return; // O'zgarishsiz
    }

    if (existing) {
      this.objectGroup.remove(existing);
    }

    const cropGroup = new THREE.Group();
    cropGroup.position.set(x, y, z);
    cropGroup.userData = { stage, isWithered, healthTier };
    cropGroup.sway = !isWithered;

    // Ranglar va materiallar
    let plantColor = 0x4caf50;
    if (isWithered) plantColor = 0x5d4037; // Qurigan to'q jigarrang
    else if (tile.crop.health < 40) plantColor = 0xc0ca33; // Chanqagan sarg'ish

    const plantMat = new THREE.MeshStandardMaterial({ color: plantColor, roughness: 0.8 });

    // O'simlik turi bo'yicha 3D modellash
    if (cropType === 'cotton') {
      // ===== O'ZBEKISTON OQ OLTINI - PAXTA (G'O'ZA) =====
      if (isWithered) {
        // 1. Qurigan g'o'zapoya
        const deadStalkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
        const stalkGeo = new THREE.CylinderGeometry(0.03, 0.07, 0.9, 5);
        const stalk = new THREE.Mesh(stalkGeo, deadStalkMat);
        stalk.position.y = 0.45;
        stalk.rotation.z = 0.2;
        cropGroup.add(stalk);

        for (let b = 0; b < 3; b++) {
          const twigGeo = new THREE.CylinderGeometry(0.015, 0.03, 0.4, 4);
          const twig = new THREE.Mesh(twigGeo, deadStalkMat);
          const angle = (b / 3) * Math.PI * 2;
          twig.position.set(Math.cos(angle) * 0.1, 0.5 + b * 0.15, Math.sin(angle) * 0.1);
          twig.rotation.set(Math.cos(angle) * 0.8, angle, Math.sin(angle) * 0.8);
          cropGroup.add(twig);
        }
      } else {
        // 2. Tirik va yashil g'o'za
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x33691e, roughness: 0.7 });
        const leafColor = tile.crop.health < 40 ? 0x9e9d24 : 0x2e7d32;
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.65, flatShading: true });

        // Asosiy poya (Main Stem)
        const plantHeight = 0.3 + stage * 0.22;
        const stemGeo = new THREE.CylinderGeometry(0.025, 0.05, plantHeight, 6);
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.y = plantHeight / 2;
        stem.castShadow = true;
        cropGroup.add(stem);

        // Barglar shox-shabbasi (Bushes)
        const bushScale = 0.22 + stage * 0.18;
        const bushGeo = new THREE.DodecahedronGeometry(bushScale, 1);
        const bush = new THREE.Mesh(bushGeo, leafMat);
        bush.position.y = plantHeight * 0.75;
        bush.castShadow = true;
        cropGroup.add(bush);

        // Yon shoxchalardagi barglar
        if (stage >= 1) {
          for (let b = 0; b < 4; b++) {
            const sideBushGeo = new THREE.DodecahedronGeometry(bushScale * 0.6, 0);
            const sideBush = new THREE.Mesh(sideBushGeo, leafMat);
            const angle = (b / 4) * Math.PI * 2;
            sideBush.position.set(Math.cos(angle) * bushScale * 0.8, plantHeight * 0.6, Math.sin(angle) * bushScale * 0.8);
            cropGroup.add(sideBush);
          }
        }

        // ===== BOSQICH 2: GULLASH (PAXTA GULI) 🌸🌼 =====
        if (stage === 2) {
          const flowerPetalMat = new THREE.MeshStandardMaterial({
            color: 0xfff9c4, // Sariq-qaymoqrang gulyaproq
            emissive: 0xf48fb1,
            emissiveIntensity: 0.3,
            roughness: 0.5
          });
          const calyxMat = new THREE.MeshStandardMaterial({ color: 0x33691e });

          for (let f = 0; f < 6; f++) {
            const angle = (f / 6) * Math.PI * 2 + (f % 2) * 0.5;
            const r = bushScale * 0.85;
            const fy = plantHeight * (0.5 + (f % 3) * 0.2);
            const fx = Math.cos(angle) * r;
            const fz = Math.sin(angle) * r;

            const flowerGroup = new THREE.Group();
            flowerGroup.position.set(fx, fy, fz);

            // Yashil kosachabarg (Calyx)
            const calyxGeo = new THREE.ConeGeometry(0.08, 0.08, 3);
            const calyx = new THREE.Mesh(calyxGeo, calyxMat);
            calyx.rotation.x = Math.PI;
            flowerGroup.add(calyx);

            // Sariq gul
            const flowerGeo = new THREE.SphereGeometry(0.07, 6, 6);
            const flower = new THREE.Mesh(flowerGeo, flowerPetalMat);
            flower.position.y = 0.05;
            flowerGroup.add(flower);

            cropGroup.add(flowerGroup);
          }
        }

        // ===== BOSQICH 3: KO'SAK TUGISH (GREEN BOLLS) 🟢 =====
        if (stage === 3) {
          const bollMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.5 });
          for (let k = 0; k < 7; k++) {
            const angle = (k / 7) * Math.PI * 2;
            const r = bushScale * 0.85;
            const by = plantHeight * (0.45 + (k % 3) * 0.2);
            const bx = Math.cos(angle) * r;
            const bz = Math.sin(angle) * r;

            const bollGeo = new THREE.ConeGeometry(0.07, 0.14, 5);
            const boll = new THREE.Mesh(bollGeo, bollMat);
            boll.position.set(bx, by, bz);
            boll.rotation.set(Math.random() * 0.5, angle, Math.random() * 0.5);
            cropGroup.add(boll);
          }
        }

        // ===== BOSQICH 4: OCHILGAN OPPOG' PAXTA KO'SAKLARI (SNOW-WHITE COTTON) ☁️✨ =====
        if (stage >= 4) {
          const cottonMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0.05
          });
          const driedBractMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });

          for (let p = 0; p < 9; p++) {
            const angle = (p / 9) * Math.PI * 2 + (p % 2) * 0.3;
            const r = bushScale * (0.8 + (p % 3) * 0.1);
            const py = plantHeight * (0.35 + (p % 4) * 0.18);
            const px = Math.cos(angle) * r;
            const pz = Math.sin(angle) * r;

            const bollGroup = new THREE.Group();
            bollGroup.position.set(px, py, pz);

            // Qurigan 4 qirrali ko'sak kosachasi (Dried Bracts)
            for (let b = 0; b < 4; b++) {
              const bGeo = new THREE.BoxGeometry(0.14, 0.02, 0.04);
              const bMesh = new THREE.Mesh(bGeo, driedBractMat);
              bMesh.rotation.y = (b / 4) * Math.PI * 2;
              bollGroup.add(bMesh);
            }

            // 4 ta bo'lakli oppog' paxta tolasi (Fluffy Cotton Segments)
            const centerCottonGeo = new THREE.SphereGeometry(0.09, 8, 8);
            const centerCotton = new THREE.Mesh(centerCottonGeo, cottonMat);
            centerCotton.position.y = 0.04;
            centerCotton.castShadow = true;
            bollGroup.add(centerCotton);

            for (let c = 0; c < 4; c++) {
              const puffGeo = new THREE.SphereGeometry(0.055, 6, 6);
              const puff = new THREE.Mesh(puffGeo, cottonMat);
              const cAngle = (c / 4) * Math.PI * 2;
              puff.position.set(Math.cos(cAngle) * 0.04, 0.05, Math.sin(cAngle) * 0.04);
              bollGroup.add(puff);
            }

            cropGroup.add(bollGroup);
          }
        }
      }
    } else if (cropType === 'wheat' || cropType === 'corn') {
      const stalkCount = isWithered ? 4 : (6 + stage * 2);
      for (let i = 0; i < stalkCount; i++) {
        const height = (0.3 + stage * 0.25) * (isWithered ? 0.6 : (0.8 + Math.random() * 0.4));
        const stalkGeo = new THREE.CylinderGeometry(0.02, 0.03, height, 4);
        let color = plantColor;
        if (!isWithered && cropType === 'wheat' && stage >= 3) color = 0xfbc02d;
        const stalk = new THREE.Mesh(stalkGeo, new THREE.MeshStandardMaterial({ color }));
        const offX = (Math.random() - 0.5) * 1.0;
        const offZ = (Math.random() - 0.5) * 1.0;
        stalk.position.set(offX, height / 2, offZ);
        if (isWithered) stalk.rotation.z = (Math.random() - 0.5) * 0.8; // Egilib qolgan
        cropGroup.add(stalk);
      }
    } else if (cropType === 'orchard') {
      // ===== INTENSIV MEVALI OLMA BOG'I =====
      if (isWithered) {
        // 1. Qurigan olma daraxti (Bargsiz, qaqragan shoxlar)
        const deadTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.6, 6);
        const trunk = new THREE.Mesh(trunkGeo, deadTrunkMat);
        trunk.position.y = 0.8;
        trunk.rotation.z = 0.15;
        cropGroup.add(trunk);

        // Qaqragan yon shoxlar
        for (let b = 0; b < 4; b++) {
          const branchGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.8, 5);
          const branch = new THREE.Mesh(branchGeo, deadTrunkMat);
          const angle = (b / 4) * Math.PI * 2;
          branch.position.set(Math.cos(angle) * 0.3, 1.2, Math.sin(angle) * 0.3);
          branch.rotation.set(Math.sin(angle) * 0.8, angle, Math.cos(angle) * 0.8);
          cropGroup.add(branch);
        }
      } else {
        // 2. Tirik va sog'lom olma daraxti
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
        
        // Ildiz asosi (Root flare)
        const rootGeo = new THREE.ConeGeometry(0.32, 0.35, 6);
        const root = new THREE.Mesh(rootGeo, barkMat);
        root.position.y = 0.17;
        cropGroup.add(root);

        // Asosiy tana (Trunk)
        const trunkHeight = 1.0 + stage * 0.25;
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, trunkHeight, 7);
        const trunk = new THREE.Mesh(trunkGeo, barkMat);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        cropGroup.add(trunk);

        // Shox-shabbalar (Branches)
        if (stage >= 1) {
          for (let b = 0; b < 3; b++) {
            const bGeo = new THREE.CylinderGeometry(0.05, 0.09, 0.6, 5);
            const bMesh = new THREE.Mesh(bGeo, barkMat);
            const angle = (b / 3) * Math.PI * 2 + 0.4;
            bMesh.position.set(Math.cos(angle) * 0.2, trunkHeight * 0.8, Math.sin(angle) * 0.2);
            bMesh.rotation.set(Math.cos(angle) * 0.6, angle, Math.sin(angle) * 0.6);
            cropGroup.add(bMesh);
          }
        }

        // Barglar toji (Multi-layered Fluffy Canopy)
        const crownScale = 0.5 + stage * 0.22;
        const leafColor = stage === 2 ? 0x558b2f : (tile.crop.health < 40 ? 0x9e9d24 : 0x2e7d32);
        const leafMat = new THREE.MeshStandardMaterial({
          color: leafColor,
          roughness: 0.7,
          flatShading: true
        });

        // 4 ta bir-birini to'ldiruvchi gumbazlar (Organic Cloud Canopy)
        const crownOffsets = [
          { x: 0, y: trunkHeight + crownScale * 0.7, z: 0, r: crownScale * 0.9 },
          { x: crownScale * 0.45, y: trunkHeight + crownScale * 0.5, z: crownScale * 0.3, r: crownScale * 0.7 },
          { x: -crownScale * 0.45, y: trunkHeight + crownScale * 0.55, z: crownScale * 0.2, r: crownScale * 0.75 },
          { x: 0, y: trunkHeight + crownScale * 0.45, z: -crownScale * 0.45, r: crownScale * 0.7 }
        ];

        crownOffsets.forEach(c => {
          const domeGeo = new THREE.DodecahedronGeometry(c.r, 1);
          const dome = new THREE.Mesh(domeGeo, leafMat);
          dome.position.set(c.x, c.y, c.z);
          dome.castShadow = true;
          cropGroup.add(dome);
        });

        // ===== BOSQICH 2: GULLASH (APPLE BLOSSOM) 🌸 =====
        if (stage === 2) {
          const petalMat = new THREE.MeshStandardMaterial({
            color: 0xfff0f5,
            emissive: 0xf8bbd0,
            emissiveIntensity: 0.35,
            roughness: 0.5
          });
          const pistilMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });

          for (let f = 0; f < 16; f++) {
            const angle = (f / 16) * Math.PI * 2 + (f % 3) * 0.5;
            const radius = crownScale * (0.65 + (f % 4) * 0.1);
            const flowerY = trunkHeight + crownScale * (0.3 + (f % 5) * 0.18);
            const fx = Math.cos(angle) * radius;
            const fz = Math.sin(angle) * radius;

            // 5 ta gulbarg
            const flowerGroup = new THREE.Group();
            flowerGroup.position.set(fx, flowerY, fz);

            const flowerGeo = new THREE.CircleGeometry(0.09, 5);
            const flowerMesh = new THREE.Mesh(flowerGeo, petalMat);
            flowerMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            flowerGroup.add(flowerMesh);

            // Sariq markazi (Pistil)
            const pistilGeo = new THREE.SphereGeometry(0.035, 4, 4);
            const pistilMesh = new THREE.Mesh(pistilGeo, pistilMat);
            flowerGroup.add(pistilMesh);

            cropGroup.add(flowerGroup);
          }
        }

        // ===== BOSQICH 3: XOM MEVALAR (BLUSHING APPLES) 🍏 =====
        if (stage === 3) {
          const rawAppleMat = new THREE.MeshStandardMaterial({
            color: 0x8bc34a,
            roughness: 0.3,
            metalness: 0.1
          });
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + (i % 2) * 0.4;
            const r = crownScale * 0.8;
            const ay = trunkHeight + crownScale * (0.35 + (i % 3) * 0.2);
            const ax = Math.cos(angle) * r;
            const az = Math.sin(angle) * r;

            const appleGeo = new THREE.SphereGeometry(0.08, 6, 6);
            const apple = new THREE.Mesh(appleGeo, rawAppleMat);
            apple.position.set(ax, ay, az);
            cropGroup.add(apple);
          }
        }

        // ===== BOSQICH 4: PISHGAN YALTIRAG'ON QIZIL OLMALAR (RIPE RED APPLES) 🍎✨ =====
        if (stage >= 4) {
          const ripeAppleMat = new THREE.MeshStandardMaterial({
            color: 0xd50000,
            emissive: 0x5d0000,
            emissiveIntensity: 0.2,
            roughness: 0.15,
            metalness: 0.2
          });
          const stemMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

          // Daraxtdagi 14 ta yirik qizil olmalar
          for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
            const r = crownScale * (0.75 + (i % 3) * 0.1);
            const ay = trunkHeight + crownScale * (0.3 + (i % 4) * 0.2);
            const ax = Math.cos(angle) * r;
            const az = Math.sin(angle) * r;

            const appleGroup = new THREE.Group();
            appleGroup.position.set(ax, ay, az);

            const appleGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const apple = new THREE.Mesh(appleGeo, ripeAppleMat);
            apple.castShadow = true;
            appleGroup.add(apple);

            // Olma bandi (Stem)
            const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4);
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.y = 0.12;
            stem.rotation.z = 0.3;
            appleGroup.add(stem);

            cropGroup.add(appleGroup);
          }

          // Daraxt tagida to'plangan olma savatchasi (Harvest Basket)
          const basketGroup = new THREE.Group();
          basketGroup.position.set(0.45, 0, 0.45);

          const basketMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
          const basketGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.22, 8, 1, true);
          const basket = new THREE.Mesh(basketGeo, basketMat);
          basket.position.y = 0.11;
          basketGroup.add(basket);

          // Savatdagi olmalar
          for (let a = 0; a < 3; a++) {
            const bAppleGeo = new THREE.SphereGeometry(0.08, 6, 6);
            const bApple = new THREE.Mesh(bAppleGeo, ripeAppleMat);
            const bAngle = (a / 3) * Math.PI * 2;
            bApple.position.set(Math.cos(bAngle) * 0.08, 0.16, Math.sin(bAngle) * 0.08);
            basketGroup.add(bApple);
          }
          cropGroup.add(basketGroup);
        }
      }
    } else if (cropType === 'oasis_tree') {
      // Xurmo / Saksovul daraxti
      const trunkMat = new THREE.MeshStandardMaterial({
        color: isWithered ? 0x3e2723 : 0x5d4037,
        roughness: 0.9
      });
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2.2, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      if (isWithered) {
        trunk.rotation.z = 0.22; // Quriganda egilgan tana
      }
      trunk.castShadow = true;
      cropGroup.add(trunk);

      // Saksovul barglari (quriganda to'q qoramtir-jigarrang va pastga osilgan)
      let leafColor = 0x2e7d32;
      if (isWithered) leafColor = 0x4e342e; // Qurigan barglar
      else if (tile.crop.health < 40) leafColor = 0xafb42b; // Chanqagan sarg'ish

      const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.85 });
      for (let i = 0; i < 6; i++) {
        const leafGeo = new THREE.ConeGeometry(0.28, isWithered ? 1.0 : 1.6, 4);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const angle = (i / 6) * Math.PI * 2;
        leaf.rotation.x = isWithered ? Math.PI / 1.6 : Math.PI / 2.5; // Pastga so'ligan
        leaf.rotation.y = angle;
        leaf.position.set(0, isWithered ? 1.8 : 2.1, 0);
        cropGroup.add(leaf);
      }
    }

    this.objectGroup.add(cropGroup);
    this.cropMeshes.set(key, cropGroup);
  }
}
