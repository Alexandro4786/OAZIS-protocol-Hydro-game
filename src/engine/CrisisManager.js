import { CRISIS_TYPES } from '../config.js';

export class CrisisManager {
  constructor(gameState, gridWorld) {
    this.gameState = gameState;
    this.gridWorld = gridWorld;
    this.timerToNextCrisis = 65; // Birinchi inqiroz 65 soniyadan keyin
    this.activeCrisis = null;
    this.crisisDurationLeft = 0;
  }

  update(dt, weather = {}) {
    if (this.activeCrisis) {
      // 1. Agar yomg'ir yoki sel boshlansa, issiqlik to'lqini va qurg'oqchilik avtomatik tugaydi!
      if ((weather.rainRate > 0 || weather.id === 'rain' || weather.id === 'storm_flood') && 
          (this.activeCrisis.id === 'heatwave' || this.activeCrisis.id === 'drought')) {
        this.resolveCrisis();
        this.gameState.emit('notify', {
          type: 'success',
          message: "🌧️ Yomg'ir va sel tufayli qurg'oqchilik/jazirama inqirozi barham topdi!"
        });
        return;
      }

      this.crisisDurationLeft -= dt;
      
      // Inqiroz ta'sirlarini qo'llash
      if (this.activeCrisis.id === 'pipe_burst') {
        const waste = this.activeCrisis.waterWastePerSec * dt;
        this.gameState.consumeWater(waste, 'surface');
        this.gameState.stats.waterWasted += waste;
      }

      if (this.crisisDurationLeft <= 0) {
        this.resolveCrisis();
      }
    } else {
      this.timerToNextCrisis -= dt;
      if (this.timerToNextCrisis <= 0) {
        this.triggerRandomCrisis(weather);
      }
    }
  }

  triggerRandomCrisis(weather = {}) {
    let availableKeys = Object.keys(CRISIS_TYPES);

    // Yomg'ir yoki sel paytida qurg'oqchilik (drought) va jazirama (heatwave) bo'lishi MUMKIN EMAS!
    if (weather.rainRate > 0 || weather.id === 'rain' || weather.id === 'storm_flood') {
      availableKeys = availableKeys.filter(k => k !== 'heatwave' && k !== 'drought');
    }

    if (availableKeys.length === 0) return;

    const randomKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    const crisis = CRISIS_TYPES[randomKey];

    this.activeCrisis = { ...crisis };
    this.crisisDurationLeft = crisis.duration;
    this.gameState.activeCrisis = this.activeCrisis;

    this.gameState.emit('crisisStarted', this.activeCrisis);
    this.gameState.emit('notify', {
      type: 'crisis',
      message: `DIQQAT INQIROZ: ${crisis.name}! ${crisis.description}`
    });
  }

  resolveCrisis() {
    if (!this.activeCrisis) return;
    const name = this.activeCrisis.name;
    this.activeCrisis = null;
    this.gameState.activeCrisis = null;
    this.gameState.stats.crisesResolved++;
    this.timerToNextCrisis = 80 + Math.random() * 40; // Keyingi inqiroz vaqti

    this.gameState.emit('crisisEnded', { name });
    this.gameState.emit('notify', {
      type: 'success',
      message: `Inqiroz barham topdi: ${name}`
    });
  }

  repairPipeBurst() {
    if (this.activeCrisis && this.activeCrisis.id === 'pipe_burst') {
      if (this.gameState.spendBudget(150)) {
        this.resolveCrisis();
        this.gameState.emit('notify', { type: 'success', message: "Quvur ta'mirlandi (-$150)!" });
        return true;
      }
    }
    return false;
  }
}
