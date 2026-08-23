import { INITIAL_RESOURCES, TECH_NODES } from '../config.js';

export class GameState {
  constructor() {
    this.listeners = new Map();
    this.reset();
  }

  reset() {
    this.resources = { ...INITIAL_RESOURCES };
    this.speed = 1.0; // 0 (pause), 1 (normal), 2 (tez), 5 (juda tez)
    this.isPaused = false;
    this.activeTool = 'survey'; // survey, furrow, sprinkler, drip_surface, sdi, scada_ai, crop_cotton, crop_wheat, crop_corn, crop_orchard, crop_oasis, build_canal_intake, build_deep_well, build_pipe, build_iot_tower, build_solar, demolish
    this.activeHeatmap = 'none'; // 'none', 'moisture', 'loss', 'salinity', 'iot'
    
    // Ochiq texnologiyalar
    this.unlockedTech = new Set(['furrow']);
    
    // Inqiroz holati
    this.activeCrisis = null;
    this.crisisTimer = 0;
    
    // Tanlangan katak ma'lumotlari
    this.selectedTile = null;
    
    // Statistika
    this.stats = {
      waterUsedSurface: 0,
      waterUsedAquifer: 0,
      waterWasted: 0,
      waterSaved: 0,
      totalHarvestRevenue: 0,
      cropsHarvested: 0,
      cropsLost: 0,
      crisesResolved: 0
    };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Xatolik hodisada [${event}]:`, err);
        }
      });
    }
  }

  setTool(toolId) {
    this.activeTool = toolId;
    this.emit('toolChanged', toolId);
  }

  setHeatmap(heatmapMode) {
    this.activeHeatmap = heatmapMode;
    this.emit('heatmapChanged', heatmapMode);
  }

  setSpeed(speedMultiplier) {
    if (speedMultiplier === 0) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.speed = speedMultiplier;
    }
    this.emit('speedChanged', { speed: this.speed, isPaused: this.isPaused });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.emit('speedChanged', { speed: this.speed, isPaused: this.isPaused });
  }

  selectTile(tile) {
    this.selectedTile = tile;
    this.emit('tileSelected', tile);
  }

  addBudget(amount) {
    this.resources.budget = Math.max(0, this.resources.budget + amount);
    this.emit('resourcesUpdated', this.resources);
  }

  spendBudget(amount) {
    if (this.resources.budget >= amount) {
      this.resources.budget -= amount;
      this.emit('resourcesUpdated', this.resources);
      return true;
    }
    this.emit('notify', { type: 'error', message: "Yetarli mablag' mavjud emas!" });
    return false;
  }

  consumeWater(amount, source = 'surface') {
    let actualConsumed = 0;
    if (source === 'surface' && this.resources.surfaceWater > 0) {
      actualConsumed = Math.min(amount, this.resources.surfaceWater);
      this.resources.surfaceWater -= actualConsumed;
      this.stats.waterUsedSurface += actualConsumed;
    } else if (this.resources.aquiferWater > 0) {
      actualConsumed = Math.min(amount, this.resources.aquiferWater);
      this.resources.aquiferWater -= actualConsumed;
      this.stats.waterUsedAquifer += actualConsumed;
      
      // Akvifer pasayishi sho'rlanish xavfini oshiradi
      const aquiferRatio = this.resources.aquiferWater / this.resources.aquiferCapacity;
      if (aquiferRatio < 0.3) {
        this.resources.salinityRisk = Math.min(1.0, (0.3 - aquiferRatio) * 2.5);
      }
    }
    this.emit('resourcesUpdated', this.resources);
    return actualConsumed;
  }

  updateEcoScore(delta) {
    this.resources.ecoScore = Math.max(0, Math.min(100, this.resources.ecoScore + delta));
    this.emit('resourcesUpdated', this.resources);
  }

  unlockTech(techId, cost, ecoReq) {
    if (this.unlockedTech.has(techId)) return false;
    if (this.resources.ecoScore < ecoReq) {
      this.emit('notify', { type: 'warning', message: `Eko-Ball yetarli emas! Kerak: ${ecoReq}` });
      return false;
    }
    if (!this.spendBudget(cost)) return false;

    this.unlockedTech.add(techId);
    
    // Tegishli asboblarni ochish
    const techNode = TECH_NODES.find(t => t.id === techId);
    if (techNode && techNode.unlocks) {
      techNode.unlocks.forEach(u => this.unlockedTech.add(u));
    }
    
    this.emit('techUnlocked', techId);
    this.emit('notify', { type: 'success', message: `Yangi texnologiya ochildi: ${techNode?.name || techId}` });
    return true;
  }

  isTechUnlocked(techId) {
    return this.unlockedTech.has(techId);
  }

  checkEndGameConditions() {
    // Mag'lubiyat shartlari
    if (this.resources.budget <= 0 && this.resources.surfaceWater <= 0 && this.resources.aquiferWater <= 0) {
      return { ended: true, win: false, reason: "Barcha suv va byudjet zaxiralari tugadi. Oazis barbod bo'ldi." };
    }
    if (this.resources.aquiferWater <= 500 && this.resources.salinityRisk >= 0.9) {
      return { ended: true, win: false, reason: "Yer osti akviferi to'liq quridi va tuproq butunlay sho'rlandi." };
    }
    
    // G'alaba sharti (Oasis Index 90+ ga chiqishi, suv barqarorligi va 4-bosqich Smart AI o'rnatilishi)
    if (this.resources.ecoScore >= 85 && this.isTechUnlocked('tech_ai_scada') && this.resources.budget >= 10000) {
      return { ended: true, win: true, reason: "G'ALABA! Siz cho'l hududida to'liq avtomatlashtirilgan, o'zini o'zi ta'minlovchi yashil ekotizim — Oasis Protocol ni yaratdingiz!" };
    }

    return { ended: false };
  }
}
