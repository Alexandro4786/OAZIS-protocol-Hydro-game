import { CRISIS_TYPES } from '../config.js';

export class CrisisManager {
  constructor(gameState, gridWorld) {
    this.gameState = gameState;
    this.gridWorld = gridWorld;
    this.timerToNextCrisis = 65; // Birinchi inqiroz 65 soniyadan keyin
    this.activeCrisis = null;
    this.crisisDurationLeft = 0;
  }

  update(dt, weather) {
    if (this.activeCrisis) {
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
        this.triggerRandomCrisis();
      }
    }
  }

  triggerRandomCrisis() {
    const keys = Object.keys(CRISIS_TYPES);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
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
