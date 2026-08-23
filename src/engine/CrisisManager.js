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
    const seasonId = this.gameState.resources.seasonId || 'spring';
    const isCoolOrWet = weather.rainRate > 0 || 
                        weather.id === 'rain' || 
                        weather.id === 'storm_flood' || 
                        weather.id === 'fresh_cloudy' || 
                        weather.id === 'cloudy' || 
                        weather.id === 'humid_sun';

    if (this.activeCrisis) {
      // 1. Agar salqin, bulutli yoki yomg'irli ob-havo bo'lsa yoki Yoz fasli bo'lmasa, jazirama/qurg'oqchilik darhol bekor qilinadi!
      if ((this.activeCrisis.id === 'heatwave' || this.activeCrisis.id === 'drought') && (isCoolOrWet || seasonId !== 'summer')) {
        this.resolveCrisis();
        this.gameState.emit('notify', {
          type: 'success',
          message: "🌤️ Salqin va nam havo tufayli jazirama/qurg'oqchilik xavfi to'liq bartaraf etildi!"
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
        this.triggerRandomCrisis(weather, seasonId);
      }
    }
  }

  triggerRandomCrisis(weather = {}, seasonId = 'spring') {
    let availableKeys = Object.keys(CRISIS_TYPES);
    const isCoolOrWet = weather.rainRate > 0 || 
                        weather.id === 'rain' || 
                        weather.id === 'storm_flood' || 
                        weather.id === 'fresh_cloudy' || 
                        weather.id === 'cloudy' || 
                        weather.id === 'humid_sun';

    // 1. Jazirama (Heatwave) FAQATGINA Yoz faslida va ochiq quyoshli/garmsel ob-havosida bo'lishi mumkin!
    if (seasonId !== 'summer' || isCoolOrWet || (weather.id !== 'sunny' && weather.id !== 'windy')) {
      availableKeys = availableKeys.filter(k => k !== 'heatwave');
    }

    // 2. Qurg'oqchilik (Drought) salqin, bulutli yoki yomg'irli paytda bo'lishi MUMKIN EMAS!
    if (isCoolOrWet || seasonId === 'winter') {
      availableKeys = availableKeys.filter(k => k !== 'drought');
    }

    if (availableKeys.length === 0) {
      this.timerToNextCrisis = 45; // Mos inqiroz bo'lmasa keyinroqqa qoldirish
      return;
    }

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
