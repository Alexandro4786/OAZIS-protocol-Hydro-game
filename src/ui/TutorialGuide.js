// Oasis Protocol - Yangi O'yinchilar uchun Interaktiv Qo'llanma (Onboarding Tutorial)

export class TutorialGuide {
  constructor(audioManager, gameState) {
    this.audioManager = audioManager;
    this.gameState = gameState;
    this.modalEl = document.getElementById('intro-modal');
    this.currentSlide = 0;
    this.totalSlides = 4;

    this.initDOM();
    this.initEvents();
    this.checkAutoStart();
  }

  initDOM() {
    this.slides = document.querySelectorAll('.intro-slide');
    this.dots = document.querySelectorAll('.intro-step-dot');
    this.prevBtn = document.getElementById('btn-intro-prev');
    this.nextBtn = document.getElementById('btn-intro-next');
    this.startBtn = document.getElementById('btn-intro-start');
    this.skipCheckbox = document.getElementById('intro-dont-show-again');
  }

  initEvents() {
    // 1. Qo'llanmani ochish (❓ tugmasi orqali)
    document.getElementById('btn-help-modal')?.addEventListener('click', () => {
      this.open(0);
    });

    document.querySelectorAll('[data-close="intro-modal"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // 2. Oldingi / Keyingi tugmalari
    this.prevBtn?.addEventListener('click', () => {
      this.audioManager.playClick();
      if (this.currentSlide > 0) {
        this.goToSlide(this.currentSlide - 1);
      }
    });

    this.nextBtn?.addEventListener('click', () => {
      this.audioManager.playClick();
      if (this.currentSlide < this.totalSlides - 1) {
        this.goToSlide(this.currentSlide + 1);
      } else {
        this.close();
      }
    });

    // 3. O'yinni boshlash tugmasi
    this.startBtn?.addEventListener('click', () => {
      this.close();
    });

    // 4. Qadamlar nuqtalariga bosish
    this.dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        this.audioManager.playClick();
        this.goToSlide(idx);
      });
    });
  }

  checkAutoStart() {
    const hasSeen = localStorage.getItem('oasis_protocol_tutorial_seen');
    if (!hasSeen) {
      // Birinchi marta kirgan o'yinchiga avtomatik ochiladi
      setTimeout(() => {
        this.open(0);
      }, 500);
    }
  }

  open(slideIndex = 0) {
    this.audioManager.playClick();
    this.goToSlide(slideIndex);
    if (this.modalEl) this.modalEl.style.display = 'flex';
  }

  close() {
    this.audioManager.playHarvest();
    if (this.modalEl) this.modalEl.style.display = 'none';

    if (this.skipCheckbox?.checked) {
      localStorage.setItem('oasis_protocol_tutorial_seen', 'true');
    }
  }

  goToSlide(index) {
    this.currentSlide = Math.max(0, Math.min(this.totalSlides - 1, index));

    // Slaydlarni ko'rsatish
    this.slides.forEach((slide, idx) => {
      if (idx === this.currentSlide) {
        slide.style.display = 'block';
      } else {
        slide.style.display = 'none';
      }
    });

    // Qadam nuqtalarini faollashtirish
    this.dots.forEach((dot, idx) => {
      if (idx === this.currentSlide) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Tugmalar holati
    if (this.prevBtn) {
      this.prevBtn.style.visibility = this.currentSlide === 0 ? 'hidden' : 'visible';
    }

    if (this.currentSlide === this.totalSlides - 1) {
      if (this.nextBtn) this.nextBtn.style.display = 'none';
      if (this.startBtn) this.startBtn.style.display = 'flex';
    } else {
      if (this.nextBtn) this.nextBtn.style.display = 'flex';
      if (this.startBtn) this.startBtn.style.display = 'none';
    }
  }
}
