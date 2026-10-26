/* ============================================================
   UTIL
   ============================================================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const renderIcons = () => { if (window.lucide?.createIcons) window.lucide.createIcons(); };

/* ============================================================
   SOUND ENGINE (Web Audio API — tanpa file eksternal)
   ============================================================ */
const Sound = (() => {
  let ctx = null;
  const getCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const beep = (freq, delay = 0, dur = .2, type = 'sine', vol = .16) => {
    const c = getCtx(); if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + .02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + .06);
  };
  return {
    click()   { beep(880, 0, .06, 'sine', .06); },
    drop()    { beep(523.25, 0, .10, 'sine', .12); beep(783.99, .07, .14, 'sine', .10); },
    pick()    { beep(659.25, 0, .07, 'triangle', .08); },
    correct() { [659.25, 783.99, 1046.5].forEach((f, i) => beep(f, i * .085, .24, 'sine', .16)); },
    wrong()   { beep(233.08, 0, .16, 'sawtooth', .11); beep(174.61, .14, .30, 'sawtooth', .11); },
    finish()  { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => beep(f, i * .10, .40, 'triangle', .15)); },
    warn()    { beep(392, 0, .12, 'triangle', .10); }
  };
})();

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderIcons();

  /* ---------- NAVIGASI SLIDE ---------- */
  const slides   = $$('.slide');
  const progress = $('#progressBar');
  const count    = $('#slideCount');
  const prevBtn  = $('#prevButton');
  const nextBtn  = $('#nextButton');
  let current = 0;

  function showSlide(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((s, i) => s.classList.toggle('active', i === current));
    progress.style.width = ((current + 1) / slides.length * 100) + '%';
    count.textContent = `${current + 1} / ${slides.length}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    const active = slides[current];
    if (active) active.scrollTop = 0;
  }

  prevBtn.addEventListener('click', () => { Sound.click(); showSlide(current - 1); });
  nextBtn.addEventListener('click', () => { Sound.click(); showSlide(current + 1); });
  $('#startButton').addEventListener('click', () => { Sound.click(); showSlide(1); });
  $('#conceptButton').addEventListener('click', () => { Sound.click(); showSlide(3); });

  document.addEventListener('keydown', e => {
    if (e.target.matches('textarea, input')) return;
    if (e.key === 'ArrowRight') showSlide(current + 1);
    if (e.key === 'ArrowLeft')  showSlide(current - 1);
  });

  /* ---------- FULLSCREEN ---------- */
  const fullscreenBtn = $('#fullscreenToggle');
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      document.exitFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    fullscreenBtn.innerHTML = `<i data-lucide="${isFull ? 'minimize' : 'maximize'}" width="18" height="18"></i>`;
    fullscreenBtn.setAttribute('aria-label', isFull ? 'Keluar layar penuh' : 'Layar penuh');
    renderIcons();
  });

  /* ---------- TIMER 15 MENIT ---------- */
  let seconds = 900, running = false, timerId = null;
  const display = $('#timerDisplay'), toggle = $('#timerToggle');
  const drawTimer = () => {
    display.textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  toggle.addEventListener('click', () => {
    running = !running;
    toggle.innerHTML = running
      ? '<i data-lucide="pause" width="16" height="16"></i>'
      : '<i data-lucide="play" width="16" height="16"></i>';
    display.classList.toggle('timer-run', running);
    renderIcons();
    Sound.click();
    if (running) {
      timerId = setInterval(() => {
        if (seconds > 0) { seconds--; drawTimer(); }
        else {
          running = false; clearInterval(timerId);
          display.classList.remove('timer-run');
          toggle.innerHTML = '<i data-lucide="play" width="16" height="16"></i>';
          renderIcons(); Sound.finish();
        }
      }, 1000);
    } else {
      clearInterval(timerId);
    }
  });
  drawTimer();

  /* ---------- SIMULASI IPO ---------- */
  const simSteps = ['ipoInput', 'ipoProcess', 'ipoOutput'];
  $('#runSimulation').addEventListener('click', () => {
    const fb = $('#simulationFeedback');
    fb.hidden = true;
    simSteps.forEach(id => $('#' + id).classList.remove('active-flow'));
    simSteps.forEach((id, i) => {
      setTimeout(() => {
        $('#' + id).classList.add('active-flow');
        Sound.pick();
        if (i === simSteps.length - 1) { fb.hidden = false; Sound.correct(); }
      }, i * 750);
    });
  });

  /* ---------- LKPD : DRAG & DROP + KLIK ---------- */
  (function initLkpd() {
    const bank     = $('#cardBank');
    const zones    = $$('.drop-zone');
    const feedback = $('#lkpdFeedback');
    let selectedCard = null;
    let dragPayload  = null;

    const totalCards = $$('.part-card').length;

    const clearSelection = () => {
      $$('.part-card.selected').forEach(c => c.classList.remove('selected'));
      selectedCard = null;
    };

    const findCardByName = name =>
      $$('.part-card').find(c => c.dataset.name === name);

    function placeCard(card, zone) {
      if (!card || card.classList.contains('placed')) return;
      const item = document.createElement('div');
      item.className = 'placed-item';
      item.draggable = true;
      item.dataset.group = card.dataset.group;
      item.dataset.name  = card.dataset.name;

      const label = document.createElement('span');
      label.textContent = card.dataset.name;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-item';
      rm.setAttribute('aria-label', 'Kembalikan kartu');
      rm.textContent = '×';
      rm.addEventListener('click', ev => { ev.stopPropagation(); returnItem(item); });

      item.append(label, rm);
      zone.querySelector('.placed-list').appendChild(item);

      card.classList.add('placed');
      card.classList.remove('selected');
      selectedCard = null;
      feedback.hidden = true;
      Sound.drop();
    }

    function returnItem(item) {
      const card = findCardByName(item.dataset.name);
      if (card) card.classList.remove('placed');
      item.remove();
      feedback.hidden = true;
      Sound.warn();
    }

    function moveItem(item, zone) {
      if (item.parentElement === zone.querySelector('.placed-list')) return;
      item.classList.remove('ok', 'bad');
      zone.querySelector('.placed-list').appendChild(item);
      feedback.hidden = true;
      Sound.drop();
    }

    /* --- drag dari bank --- */
    $$('.part-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('placed')) return;
        if (selectedCard === card) { clearSelection(); return; }
        clearSelection();
        card.classList.add('selected');
        selectedCard = card;
        Sound.pick();
      });

      card.addEventListener('dragstart', e => {
        if (card.classList.contains('placed')) { e.preventDefault(); return; }
        dragPayload = { type: 'card', el: card };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.name);
        card.classList.add('dragging');
        clearSelection();
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        dragPayload = null;
      });
    });

    /* --- drag item yang sudah ditempatkan --- */
    document.addEventListener('dragstart', e => {
      const item = e.target.closest?.('.placed-item');
      if (!item) return;
      dragPayload = { type: 'item', el: item };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.name);
      item.style.opacity = '.45';
    });
    document.addEventListener('dragend', e => {
      const item = e.target.closest?.('.placed-item');
      if (item) item.style.opacity = '';
    });

    /* --- drop zone --- */
    zones.forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('over');
      });
      zone.addEventListener('dragleave', e => {
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('over');
      });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('over');
        if (!dragPayload) return;
        if (dragPayload.type === 'card') placeCard(dragPayload.el, zone);
        else moveItem(dragPayload.el, zone);
        dragPayload = null;
      });

      /* fallback klik (mobile / sentuh) */
      zone.addEventListener('click', e => {
        if (e.target.closest('.placed-item')) return;
        if (!selectedCard) return;
        placeCard(selectedCard, zone);
      });
    });

    /* --- bank sebagai area pengembalian --- */
    bank.addEventListener('dragover', e => {
      e.preventDefault();
      bank.classList.add('over');
    });
    bank.addEventListener('dragleave', e => {
      if (!bank.contains(e.relatedTarget)) bank.classList.remove('over');
    });
    bank.addEventListener('drop', e => {
      e.preventDefault();
      bank.classList.remove('over');
      if (dragPayload?.type === 'item') returnItem(dragPayload.el);
      dragPayload = null;
    });

    /* --- periksa jawaban --- */
    $('#checkLkpd').addEventListener('click', () => {
      let total = 0, correct = 0;
      zones.forEach(zone => {
        zone.querySelectorAll('.placed-item').forEach(item => {
          total++;
          const ok = item.dataset.group === zone.dataset.zone;
          item.classList.toggle('ok', ok);
          item.classList.toggle('bad', !ok);
          if (ok) correct++;
        });
      });

      feedback.hidden = false;
      if (total === 0) {
        feedback.textContent = 'Belum ada kartu yang ditempatkan. Seret kartu ke kolom yang tepat terlebih dahulu.';
        feedback.className = 'feedback warn';
        Sound.wrong();
        return;
      }
      const perfect = correct === totalCards && total === totalCards;
      feedback.textContent = `${correct} dari ${totalCards} kartu sudah tepat. ` +
        (perfect
          ? 'Hebat! Semua komponen sudah berada di kolom yang sesuai.'
          : 'Periksa kembali fungsi setiap komponen dan coba diskusikan bersama pasangan.');
      feedback.className = 'feedback ' + (perfect ? 'good' : 'warn');
      perfect ? Sound.correct() : Sound.wrong();
    });

    /* --- reset LKPD --- */
    $('#resetLkpd').addEventListener('click', () => {
      zones.forEach(z => z.querySelector('.placed-list').innerHTML = '');
      $$('.part-card').forEach(c => c.classList.remove('placed', 'selected'));
      clearSelection();
      feedback.hidden = true;
      Sound.warn();
    });
  })();

  /* ---------- KUIS ---------- */
  (function initQuiz() {
    let answers = [null, null, null, null, null];
    let qIndex = 0;
    const qs         = $$('.question');
    const feedback   = $('#quizFeedback');
    const scoreBtn   = $('#showScore');
    const scoreBox   = $('#scoreBox');

    $$('.answer').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answers[qIndex] !== null) return;

        const questionIndex = qIndex;
        const ok = btn.dataset.correct === 'true';
        answers[questionIndex] = { selected: btn.textContent.trim(), correct: ok };

        btn.classList.add(ok ? 'correct' : 'wrong');
        qs[questionIndex].querySelectorAll('.answer').forEach(b => {
          b.disabled = true;
          if (b.dataset.correct === 'true') b.classList.add('correct');
        });

        scoreBtn.disabled = !answers.every(a => a !== null);

        feedback.hidden = false;
        feedback.textContent = ok
          ? 'Benar! Lanjut ke soal berikutnya.'
          : 'Belum tepat. Perhatikan jawaban yang diberi tanda hijau.';
        feedback.className = 'feedback ' + (ok ? 'good' : 'warn');

        ok ? Sound.correct() : Sound.wrong();

        setTimeout(() => {
          if (questionIndex < 4) {
            qs[questionIndex].classList.remove('active-q');
            qIndex = questionIndex + 1;
            qs[qIndex].classList.add('active-q');
            feedback.hidden = true;
          }
        }, 800);
      });
    });

    scoreBtn.addEventListener('click', () => {
      if (!answers.every(a => a !== null)) return;
      const total = answers.reduce((sum, a) => sum + (a.correct ? 1 : 0), 0);

      scoreBox.classList.add('show');
      $('#scoreText').textContent = `Skor: ${total}/5 (${total} jawaban benar)`;
      $('#followUp').textContent =
        total === 5 ? 'Pengayaan melalui buku digital.'
        : total >= 3 ? 'Baca ulang diagram IPO dan diskusikan dengan pasangan.'
        : 'Remedial dengan contoh menghitung menggunakan kalkulator sederhana.';

      if (total === 5) Sound.finish();
      else if (total >= 3) Sound.correct();
      else Sound.wrong();

      scoreBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    $('#resetQuiz').addEventListener('click', () => {
      answers = [null, null, null, null, null];
      qIndex = 0;
      scoreBtn.disabled = true;
      qs.forEach((q, i) => {
        q.classList.toggle('active-q', i === 0);
        q.querySelectorAll('.answer').forEach(b => {
          b.disabled = false;
          b.classList.remove('correct', 'wrong');
        });
      });
      feedback.hidden = true;
      scoreBox.classList.remove('show');
      $('#scoreText').textContent = '';
      $('#followUp').textContent = '';
      Sound.warn();
    });
  })();

  /* ---------- VIDEO INLINE (hanya satu) ---------- */
  $$('.video-embed').forEach(box => {
    const poster = box.querySelector('.video-poster');
    if (!poster) return;
    poster.addEventListener('click', () => {
      const id = box.dataset.video;
      box.innerHTML =
        `<div class="video-frame">
           <iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
                   title="Video penjelasan sistem komputer"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                   allowfullscreen></iframe>
         </div>`;
    });
  });

  /* ---------- BACKSOUND LOOPING (volume rendah) ---------- */
  const bgMusic   = $('#bgMusic');
  const musicBtn  = $('#musicToggle');
  let musicOn = false;
  bgMusic.volume = 0.07;

  function setMusicIcon() {
    musicBtn.innerHTML = `<i data-lucide="${musicOn ? 'volume-2' : 'volume-x'}" width="18" height="18"></i>`;
    musicBtn.setAttribute('aria-pressed', String(musicOn));
    renderIcons();
  }

  function playMusic() {
    bgMusic.volume = 0.07;
    bgMusic.play()
      .then(() => { musicOn = true; setMusicIcon(); })
      .catch(() => { musicOn = false; setMusicIcon(); });
  }

  function pauseMusic() {
    bgMusic.pause();
    musicOn = false;
    setMusicIcon();
  }

  musicBtn.addEventListener('click', () => { musicOn ? pauseMusic() : playMusic(); });

  /* Mulai otomatis pada interaksi pertama pengguna */
  const startMusicOnce = () => { if (!musicOn) playMusic(); };
  document.addEventListener('pointerdown', startMusicOnce, { once: true });
  document.addEventListener('keydown', startMusicOnce, { once: true });

  setMusicIcon();

  /* ---------- INIT ---------- */
  showSlide(0);
});
