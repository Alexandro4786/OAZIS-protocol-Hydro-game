import * as THREE from 'three';
import { GameState } from './engine/GameState.js';
import { GridWorld } from './engine/GridWorld.js';
import { AudioManager } from './engine/AudioManager.js';
import { ScadaPID } from './engine/ScadaPID.js';
import { CrisisManager } from './engine/CrisisManager.js';
import { SceneManager } from './render/SceneManager.js';
import { TileRenderer } from './render/TileRenderer.js';
import { BuildingRenderer } from './render/BuildingRenderer.js';
import { ParticleSystem } from './render/ParticleSystem.js';
import { Terraformer } from './render/Terraformer.js';
import { TechTreeModal } from './ui/TechTreeModal.js';
import { ScadaModal } from './ui/ScadaModal.js';
import { UIManager } from './ui/UIManager.js';
import { TutorialGuide } from './ui/TutorialGuide.js';
import { CROP_TYPES, IRRIGATION_TECH, BUILDINGS } from './config.js';

class OasisGame {
  constructor() {
    this.canvasContainer = document.getElementById('canvas-container');
    
    // 1. Dvigatel va holatlar
    this.gameState = new GameState();
    this.gridWorld = new GridWorld(this.gameState);
    this.audioManager = new AudioManager();
    this.scadaEngine = new ScadaPID(this.gridWorld, this.gameState);
    this.crisisManager = new CrisisManager(this.gameState, this.gridWorld);

    // 2. 3D Render Tizimlari
    this.sceneManager = new SceneManager(this.canvasContainer);
    this.tileRenderer = new TileRenderer(this.sceneManager.scene, this.gridWorld);
    this.buildingRenderer = new BuildingRenderer(this.sceneManager.scene, this.gridWorld);
    this.particleSystem = new ParticleSystem(this.sceneManager.scene, this.gridWorld);
    this.terraformer = new Terraformer(this.sceneManager.scene);

    // 3. UI Modullari
    this.techTreeModal = new TechTreeModal(this.gameState, this.audioManager);
    this.scadaModal = new ScadaModal(this.scadaEngine, this.gameState, this.audioManager);
    this.uiManager = new UIManager(this.gameState, this.gridWorld, this.audioManager, this.crisisManager);
    this.tutorialGuide = new TutorialGuide(this.audioManager, this.gameState);

    // Ob-havo
    this.weather = {
      temperature: 28,
      et0: 4.5
    };

    this.lastTime = performance.now();
    this.initInteraction();
    this.syncInitialWorld();

    // Qayta boshlash hodisasi
    this.gameState.on('restartGame', () => this.restart());

    // Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  restart() {
    this.gameState.reset();
    this.gridWorld.initGrid();
    this.tileRenderer.syncTileReferences();
    this.buildingRenderer.clearAll();
    
    // Telemetriya va inqiroz boshqaruvini yangilash
    this.scadaEngine = new ScadaPID(this.gridWorld, this.gameState);
    this.scadaModal.scadaEngine = this.scadaEngine;
    this.crisisManager = new CrisisManager(this.gameState, this.gridWorld);
    this.uiManager.crisisManager = this.crisisManager;
    
    // Tanlovlarni bekor qilish
    this.sceneManager.setSelectedTile(null);
    this.sceneManager.setHoveredTile(null);
    
    // Ob-havo
    this.weather.temperature = 28;
    this.weather.et0 = 4.5;
    
    // Terraformer va bino vizualini qayta tiklash
    this.terraformer.update(this.gameState.resources.ecoScore);
    this.syncInitialWorld();
    this.uiManager.renderTools();
    this.uiManager.update(this.weather, null);

    // Ochiq modallarni yopish
    document.getElementById('endgame-modal').style.display = 'none';
    document.getElementById('restart-modal').style.display = 'none';

    this.audioManager.playHarvest();
    
    this.gameState.emit('notify', {
      type: 'success',
      message: "O'yin yangitdan boshlandi! Barcha resurslar va maydon tiklandi."
    });
  }

  syncInitialWorld() {
    this.buildingRenderer.sync();
    // Boshlang'ich bildirishnoma
    this.gameState.emit('notify', {
      type: 'info',
      message: "Oasis Protocol ga xush kelibsiz! Boshlash uchun kanalga quvur ulang va ekin eking."
    });
  }

  initInteraction() {
    const domElement = this.sceneManager.renderer.domElement;

    // Birinchi klikda ovozni yoqish
    window.addEventListener('click', () => {
      this.audioManager.init();
    }, { once: true });

    domElement.addEventListener('click', (e) => {
      if (e.button !== 0) return; // Faqat chap klik

      // Agar xarita surilgan bo'lsa (Google Maps drag), klik hisoblanmasin
      if (this.sceneManager.hasMovedMap) {
        return;
      }

      // Raycast orqali bosilgan katakni aniqlash
      this.sceneManager.raycaster.setFromCamera(this.sceneManager.mouse, this.sceneManager.camera);
      const intersects = this.sceneManager.raycaster.intersectObjects(this.tileRenderer.interactiveMeshes);

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const { gridX, gridY } = hit.userData;
        this.handleTileClick(gridX, gridY);
      }
    });

    // Hover orqali katakni ajratib ko'rsatish
    domElement.addEventListener('mousemove', () => {
      this.sceneManager.raycaster.setFromCamera(this.sceneManager.mouse, this.sceneManager.camera);
      const intersects = this.sceneManager.raycaster.intersectObjects(this.tileRenderer.interactiveMeshes);
      if (intersects.length > 0) {
        const { gridX, gridY } = intersects[0].object.userData;
        this.sceneManager.setHoveredTile({ x: gridX, y: gridY });
      } else {
        this.sceneManager.setHoveredTile(null);
      }
    });
  }

  handleTileClick(x, y) {
    const tile = this.gridWorld.getTile(x, y);
    if (!tile) return;

    this.gameState.selectTile(tile);
    this.sceneManager.setSelectedTile({ x, y });

    const tool = this.gameState.activeTool;

    // Daryo katagiga narsa qurib bo'lmaydi (kanal intake dan tashqari)
    if (tile.type === 'river' && tool !== 'survey' && tool !== 'bld_canal_intake') {
      this.gameState.emit('notify', { type: 'warning', message: "Daryo oqimiga ekin yoki quvur ekib bo'lmaydi!" });
      return;
    }

    // 1. Tahlil
    if (tool === 'survey') {
      this.audioManager.playClick();
      return;
    }

    // 2. Ekin ekish
    if (tool.startsWith('crop_')) {
      const cropKey = tool.replace('crop_', '');
      const cropConfig = CROP_TYPES[cropKey];
      if (cropConfig) {
        if (tile.crop) {
          this.gameState.emit('notify', { type: 'warning', message: "Bu yerda allaqachon ekin mavjud!" });
          return;
        }
        if (this.gameState.spendBudget(cropConfig.seedCost)) {
          tile.crop = {
            type: cropKey,
            stage: 0,
            progress: 0,
            health: 100,
            daysAlive: 0,
            isWithered: false
          };
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
          this.gameState.emit('notify', { type: 'success', message: `${cropConfig.name} ekildi (-$${cropConfig.seedCost})` });
        }
      }
      return;
    }

    // 3. Sug'orish tizimi o'rnatish
    if (tool.startsWith('irr_')) {
      const irrKey = tool.replace('irr_', '');
      const techConfig = IRRIGATION_TECH[irrKey];
      if (techConfig) {
        if (!this.gameState.isTechUnlocked(irrKey)) {
          this.gameState.emit('notify', { type: 'warning', message: "Ushbu texnologiya hali ochilmagan! Tech Tree dan oching." });
          return;
        }
        if (this.gameState.spendBudget(techConfig.cost)) {
          tile.irrigation = irrKey;
          tile.irrigationActive = true;
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
          this.gameState.emit('notify', { type: 'success', message: `${techConfig.shortName} o'rnatildi (-$${techConfig.cost})` });
        }
      }
      return;
    }

    // 4. Infratuzilma qurish
    if (tool.startsWith('bld_')) {
      const bldKey = tool.replace('bld_', '');
      if (bldKey === 'pipe') {
        const cost = BUILDINGS.pipe.cost;
        if (this.gameState.spendBudget(cost)) {
          tile.hasPipe = true;
          this.audioManager.playBuild();
          this.buildingRenderer.sync();
        }
      } else {
        const bldConfig = BUILDINGS[bldKey];
        if (bldConfig) {
          if (tile.building) {
            this.gameState.emit('notify', { type: 'warning', message: "Bu katakda boshqa inshoot bor!" });
            return;
          }
          if (this.gameState.spendBudget(bldConfig.cost)) {
            tile.building = bldKey;
            tile.hasPipe = true; // Inshootlar avtomatik quvur vazifasini ham o'taydi
            this.audioManager.playBuild();
            this.buildingRenderer.sync();
            this.gameState.emit('notify', { type: 'success', message: `${bldConfig.name} qurildi (-$${bldConfig.cost})` });
          }
        }
      }
      return;
    }

    // 5. Buzish / Tozalash
    if (tool === 'demolish') {
      if (tile.crop || tile.irrigation || tile.hasPipe || tile.building) {
        tile.crop = null;
        tile.irrigation = null;
        tile.hasPipe = false;
        if (tile.building && tile.building !== 'canal_intake') {
          tile.building = null;
        }
        this.audioManager.playBuild();
        this.buildingRenderer.sync();
        this.gameState.emit('notify', { type: 'info', message: "Katak tozalandi." });
      }
    }
  }

  updateSimulation(dt) {
    if (this.gameState.isPaused) return;

    const gameDt = dt * this.gameState.speed;
    const res = this.gameState.resources;

    // Kun va vaqt hisobi
    res.timeOfDay = (res.timeOfDay + gameDt * 0.4) % 24;
    res.day += gameDt * 0.016;

    // Ob-havo dinamikasi
    const hour = res.timeOfDay;
    let baseTemp = 24 + Math.sin(((hour - 6) / 12) * Math.PI) * 10;
    if (hour < 6 || hour > 20) baseTemp = 18;

    let baseEt0 = 3.5 + (baseTemp / 30) * 2.0;

    // Inqiroz ta'siri
    if (this.crisisManager.activeCrisis) {
      if (this.crisisManager.activeCrisis.id === 'heatwave') {
        baseTemp += 14;
        baseEt0 *= 2.2;
      }
    }

    this.weather.temperature = baseTemp;
    this.weather.et0 = baseEt0;
    res.temperature = baseTemp;
    res.et0 = baseEt0;

    // Dvigatellarni yangilash
    this.gridWorld.update(gameDt, this.weather);
    this.crisisManager.update(gameDt, this.weather);
    this.scadaEngine.update(gameDt, this.weather);

    // Eko-Ball barqarorligi
    let aliveCrops = 0;
    let healthyCount = 0;
    for (let x = 0; x < this.gridWorld.size; x++) {
      for (let y = 0; y < this.gridWorld.size; y++) {
        const t = this.gridWorld.tiles[x][y];
        if (t.crop) {
          aliveCrops++;
          if (t.crop.health > 70) healthyCount++;
        }
      }
    }
    if (aliveCrops > 0) {
      const targetEco = (healthyCount / (this.gridWorld.size * this.gridWorld.size)) * 120;
      res.ecoScore += (targetEco - res.ecoScore) * 0.01 * gameDt;
    }

    // 3D Visual sinxronizatsiyasi
    this.buildingRenderer.sync();
  }

  loop(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // 1. Simulyatsiya
    this.updateSimulation(dt);

    // 2. 3D Render
    this.sceneManager.updateLighting(this.gameState.resources.timeOfDay, this.crisisManager.activeCrisis);
    this.tileRenderer.update(currentTime * 0.001, this.gameState.activeHeatmap);
    this.buildingRenderer.update(currentTime * 0.001, dt);
    this.particleSystem.update(currentTime * 0.001, dt, this.gameState.resources.ecoScore, this.crisisManager.activeCrisis);
    this.terraformer.update(this.gameState.resources.ecoScore);
    this.sceneManager.render();

    // 3. UI
    this.uiManager.update(this.weather, this.crisisManager.activeCrisis);
    this.scadaModal.update();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// O'yinni ishga tushirish
window.addEventListener('DOMContentLoaded', () => {
  new OasisGame();
});
