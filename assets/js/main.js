/**
 * ============================================================================
 * A LITTLE QUESTION FOR ZEY — Main Interactive Experience
 * ============================================================================
 * Handles:
 *   - Gentle view transitions (Landing -> Letter -> Response -> Confirmation)
 *   - Romantic piano background audio with mobile autoplay compliance &
 *     localStorage preference persistence
 *   - Lightweight floating tulip petals & subtle YES celebration particles
 *   - Form validation, submission lock, loading states, and Supabase saving
 * ============================================================================
 */

(function initZeyExperience() {
  "use strict";

  const STORAGE_KEYS = {
    MUSIC_PAUSED: "zey_music_paused",
    MUSIC_VOLUME: "zey_music_volume",
  };

  const DEFAULT_VOLUME = 0.45;
  const REDUCED_MOTION_QUERY = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    currentView: "view-landing",
    selectedAnswer: null,
    isSubmitting: false,
    hasSubmitted: false,
  };

  /* ------------------------------------------------------------------------
     Utility Helpers
     ------------------------------------------------------------------------ */

  /**
   * Returns today's LOCAL calendar date formatted as YYYY-MM-DD.
   * Avoids UTC offset shifts from Date.prototype.toISOString().
   */
  function getTodayLocalIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a YYYY-MM-DD string into a warm readable date (e.g. "November 22, 2026").
   */
  function formatCalendarDate(isoDateStr) {
    if (!isoDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) return "";
    const [year, month, day] = isoDateStr.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(localDate);
  }

  /**
   * Formats an ISO timestamp into a readable local date and time string.
   */
  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota / private-browsing restrictions silently
    }
  }

  /* ------------------------------------------------------------------------
     Romantic Piano Music Controller
     ------------------------------------------------------------------------ */
  function createMusicController() {
    const audio = document.getElementById("bg-music");
    const toggleBtn = document.getElementById("music-toggle");
    const statusLabel = document.getElementById("music-status-label");
    const volumeWrap = document.getElementById("music-volume-wrap");
    const volumeToggle = document.getElementById("volume-toggle");
    const volumeSlider = document.getElementById("music-volume");

    let isAvailable = true;
    let fadeTimer = null;
    let targetVolume = DEFAULT_VOLUME;

    // Restore saved volume preference
    const savedVolume = parseFloat(safeStorageGet(STORAGE_KEYS.MUSIC_VOLUME));
    if (!Number.isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      targetVolume = savedVolume;
    }

    if (volumeSlider) {
      volumeSlider.value = String(targetVolume);
    }

    function applyVolume(value) {
      const clamped = Math.max(0, Math.min(1, value));
      try {
        audio.volume = clamped;
      } catch {
        // Mobile Safari restricts programmatic audio.volume changes safely
      }
    }

    applyVolume(targetVolume);

    function isUserPausedPreferred() {
      return safeStorageGet(STORAGE_KEYS.MUSIC_PAUSED) === "true";
    }

    function setPlayingUI(playing) {
      if (!toggleBtn || !statusLabel) return;
      toggleBtn.classList.toggle("is-playing", playing);
      toggleBtn.setAttribute("aria-pressed", String(playing));

      if (!isAvailable) {
        statusLabel.textContent = "Unavailable";
        toggleBtn.setAttribute("aria-label", "Piano music file unavailable");
        toggleBtn.disabled = true;
        return;
      }

      if (playing) {
        statusLabel.textContent = "Playing";
        toggleBtn.setAttribute("aria-label", "Pause romantic piano music");
      } else {
        statusLabel.textContent = "Paused";
        toggleBtn.setAttribute("aria-label", "Play romantic piano music");
      }
    }

    function clearFade() {
      if (fadeTimer !== null) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
      }
    }

    function fadeVolumeIn() {
      clearFade();
      if (REDUCED_MOTION_QUERY.matches || targetVolume <= 0.05) {
        applyVolume(targetVolume);
        return;
      }

      let current = Math.min(0.05, targetVolume);
      applyVolume(current);
      const steps = 18;
      const increment = (targetVolume - current) / steps;

      fadeTimer = window.setInterval(() => {
        current = Math.min(targetVolume, current + increment);
        applyVolume(current);
        if (current >= targetVolume - 0.005) {
          applyVolume(targetVolume);
          clearFade();
        }
      }, 65);
    }

    /**
     * Attempts playback directly inside a user gesture handler so iOS Safari
     * and Android Chrome allow audio cleanly.
     */
    function playMusic(withGentleFade) {
      if (!audio || !isAvailable) return;
      clearFade();

      if (withGentleFade) {
        applyVolume(Math.min(0.05, targetVolume));
      } else {
        applyVolume(targetVolume);
      }

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            setPlayingUI(true);
            if (withGentleFade) {
              fadeVolumeIn();
            }
          })
          .catch((err) => {
            console.warn("[Music] Playback was blocked or interrupted:", err);
            setPlayingUI(false);
          });
      } else {
        setPlayingUI(!audio.paused);
      }
    }

    function pauseMusic() {
      if (!audio) return;
      clearFade();
      audio.pause();
      setPlayingUI(false);
    }

    // Start music only after she clicks "Open my little surprise",
    // respecting any explicit pause preference saved locally.
    function startOnInitialOpen() {
      if (!isAvailable || isUserPausedPreferred()) {
        return;
      }
      if (audio.paused) {
        playMusic(true);
      }
    }

    // Play / Pause toggle click
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        if (!isAvailable) return;
        if (audio.paused) {
          safeStorageSet(STORAGE_KEYS.MUSIC_PAUSED, "false");
          playMusic(false);
        } else {
          safeStorageSet(STORAGE_KEYS.MUSIC_PAUSED, "true");
          pauseMusic();
        }
      });
    }

    // Volume drawer toggle (especially convenient on mobile touchscreens)
    if (volumeToggle && volumeWrap) {
      volumeToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = volumeWrap.classList.toggle("is-open");
        volumeToggle.setAttribute("aria-expanded", String(isOpen));
      });

      document.addEventListener("click", (event) => {
        if (!volumeWrap.contains(event.target)) {
          volumeWrap.classList.remove("is-open");
          volumeToggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Volume slider updates
    if (volumeSlider) {
      volumeSlider.addEventListener("input", () => {
        clearFade();
        const nextVol = parseFloat(volumeSlider.value);
        if (!Number.isNaN(nextVol)) {
          targetVolume = Math.max(0, Math.min(1, nextVol));
          applyVolume(targetVolume);
          safeStorageSet(STORAGE_KEYS.MUSIC_VOLUME, String(targetVolume));
        }
      });
    }

    // Keep UI synced with actual audio element state
    audio.addEventListener("play", () => setPlayingUI(true));
    audio.addEventListener("pause", () => {
      if (isAvailable) setPlayingUI(false);
    });
    audio.addEventListener("error", () => {
      isAvailable = false;
      setPlayingUI(false);
    });

    // Initial calm resting label before interaction
    if (statusLabel) {
      statusLabel.textContent = isUserPausedPreferred() ? "Paused" : "Music";
    }

    return { startOnInitialOpen, pauseMusic };
  }

  /* ------------------------------------------------------------------------
     Lightweight Floating Petals & YES Celebration Canvas
     ------------------------------------------------------------------------ */
  function createPetalAmbient() {
    const canvas = document.getElementById("petal-canvas");
    if (!canvas || !canvas.getContext) {
      return { triggerYesCelebration() {} };
    }

    if (REDUCED_MOTION_QUERY.matches) {
      return { triggerYesCelebration() {} };
    }

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let rafId = null;
    let lastTime = 0;

    const PETAL_COLORS = [
      "rgba(236, 189, 203, 0.56)",
      "rgba(246, 214, 224, 0.62)",
      "rgba(218, 161, 177, 0.45)",
      "rgba(243, 228, 217, 0.6)",
    ];

    const HEART_COLORS = [
      "rgba(201, 138, 153, 0.58)",
      "rgba(227, 164, 181, 0.64)",
      "rgba(107, 45, 62, 0.36)",
    ];

    const ambientPetals = [];
    const celebrationParticles = [];

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createPetal(randomY) {
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -20 - Math.random() * 60,
        size: 6 + Math.random() * 7,
        speedY: 14 + Math.random() * 18,
        swayAmp: 10 + Math.random() * 18,
        swaySpeed: 0.6 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.7,
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      };
    }

    function initAmbientPetals() {
      ambientPetals.length = 0;
      const count = width < 640 ? 11 : 16;
      for (let i = 0; i < count; i += 1) {
        ambientPetals.push(createPetal(true));
      }
    }

    function drawPetal(x, y, size, rotation, color, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.85, -size * 0.45, size * 0.75, size * 0.65, 0, size);
      ctx.bezierCurveTo(-size * 0.75, size * 0.65, -size * 0.85, -size * 0.45, 0, -size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawHeart(x, y, size, rotation, color, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      const s = size * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.8);
      ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 1.2, -s * 1.4, 0, -s * 0.55);
      ctx.bezierCurveTo(s * 1.2, -s * 1.4, s * 1.4, -s * 0.1, 0, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function triggerYesCelebration() {
      if (REDUCED_MOTION_QUERY.matches) return;
      const petalBurst = width < 640 ? 20 : 30;
      const heartBurst = width < 640 ? 10 : 14;

      for (let i = 0; i < petalBurst; i += 1) {
        celebrationParticles.push({
          kind: "petal",
          x: width * (0.12 + Math.random() * 0.76),
          y: -15 - Math.random() * 140,
          vx: (Math.random() - 0.5) * 32,
          vy: 38 + Math.random() * 48,
          size: 7 + Math.random() * 7,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 1.6,
          life: 0,
          maxLife: 6.5 + Math.random() * 3.5,
          color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
        });
      }

      for (let i = 0; i < heartBurst; i += 1) {
        celebrationParticles.push({
          kind: "heart",
          x: width * (0.18 + Math.random() * 0.64),
          y: height * (0.55 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 24,
          vy: -(32 + Math.random() * 34),
          size: 8 + Math.random() * 6,
          rotation: (Math.random() - 0.5) * 0.4,
          rotSpeed: (Math.random() - 0.5) * 0.45,
          life: 0,
          maxLife: 4.5 + Math.random() * 2.5,
          color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
        });
      }
    }

    function step(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      ctx.clearRect(0, 0, width, height);

      // Gentle ambient drifting petals
      for (let i = 0; i < ambientPetals.length; i += 1) {
        const p = ambientPetals[i];
        p.y += p.speedY * dt;
        p.phase += p.swaySpeed * dt;
        p.rotation += p.rotSpeed * dt;
        const drawX = p.x + Math.sin(p.phase) * p.swayAmp;

        if (p.y > height + 30) {
          ambientPetals[i] = createPetal(false);
          continue;
        }
        drawPetal(drawX, p.y, p.size, p.rotation, p.color);
      }

      // Celebratory petals & subtle hearts (active temporarily after YES)
      for (let i = celebrationParticles.length - 1; i >= 0; i -= 1) {
        const c = celebrationParticles[i];
        c.life += dt;
        if (c.life >= c.maxLife) {
          celebrationParticles.splice(i, 1);
          continue;
        }

        c.x += c.vx * dt + Math.sin(c.life * 2.2 + i) * 14 * dt;
        c.y += c.vy * dt;
        c.rotation += c.rotSpeed * dt;

        const progress = c.life / c.maxLife;
        const alpha = progress < 0.12 ? progress / 0.12 : Math.max(0, 1 - (progress - 0.65) / 0.35);

        if (c.kind === "heart") {
          drawHeart(c.x, c.y, c.size, c.rotation, c.color, alpha);
        } else {
          drawPetal(c.x, c.y, c.size, c.rotation, c.color, alpha);
        }
      }

      rafId = window.requestAnimationFrame(step);
    }

    function start() {
      if (rafId !== null) return;
      lastTime = 0;
      rafId = window.requestAnimationFrame(step);
    }

    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    resize();
    initAmbientPetals();
    start();

    window.addEventListener("resize", () => {
      resize();
      if (ambientPetals.length === 0) initAmbientPetals();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else if (!REDUCED_MOTION_QUERY.matches) {
        start();
      }
    });

    return { triggerYesCelebration };
  }

  /* ------------------------------------------------------------------------
     View Transition Manager
     ------------------------------------------------------------------------ */
  function transitionToView(nextViewId, focusElement) {
    const currentEl = document.getElementById(state.currentView);
    const nextEl = document.getElementById(nextViewId);
    if (!nextEl) return;

    const completeSwap = () => {
      if (currentEl) {
        currentEl.hidden = true;
        currentEl.classList.remove("view--active", "view--leaving");
      }

      nextEl.hidden = false;
      // Trigger reflow so CSS entry animations restart cleanly
      void nextEl.offsetWidth;
      nextEl.classList.add("view--active");
      state.currentView = nextViewId;

      window.scrollTo({
        top: 0,
        behavior: REDUCED_MOTION_QUERY.matches ? "auto" : "smooth",
      });

      if (focusElement && typeof focusElement.focus === "function") {
        window.setTimeout(() => {
          focusElement.focus({ preventScroll: true });
        }, 120);
      }
    };

    if (!currentEl || currentEl === nextEl || REDUCED_MOTION_QUERY.matches) {
      completeSwap();
      return;
    }

    currentEl.classList.add("view--leaving");
    window.setTimeout(completeSwap, 260);
  }

  /* ------------------------------------------------------------------------
     Main Application Wiring
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    const music = createMusicController();
    const petals = createPetalAmbient();

    const btnOpenSurprise = document.getElementById("btn-open-surprise");
    const letterHeading = document.getElementById("letter-heading");
    const choiceButtons = document.querySelectorAll("[data-answer]");
    const btnBackToLetter = document.getElementById("btn-back-to-letter");
    const backRow = document.getElementById("response-back-row");

    const panels = {
      YES: document.getElementById("panel-yes"),
      NOT_YET: document.getElementById("panel-not-yet"),
      NO: document.getElementById("panel-no"),
    };

    const panelHeadings = {
      YES: document.getElementById("heading-yes"),
      NOT_YET: document.getElementById("heading-not-yet"),
      NO: document.getElementById("heading-no"),
    };

    const errorBoxes = {
      YES: document.getElementById("error-yes"),
      NOT_YET: document.getElementById("error-not-yet"),
      NO: document.getElementById("error-no"),
    };

    // Date picker initialization (YES panel)
    const dateInput = document.getElementById("courtship-date");
    const datePreview = document.getElementById("date-preview");
    const btnSetToday = document.getElementById("btn-set-today");

    function updateDatePreview() {
      if (!dateInput || !datePreview) return;
      const val = dateInput.value;
      if (val && window.ZeySupabase.isValidCalendarDate(val)) {
        datePreview.textContent = `Selected: ${formatCalendarDate(val)}`;
      } else {
        datePreview.textContent = "Choose the day you'd like us to remember.";
      }
    }

    if (dateInput) {
      const todayIso = getTodayLocalIsoDate();
      dateInput.value = todayIso;
      dateInput.min = "2020-01-01";
      dateInput.max = "2100-12-31";
      updateDatePreview();
      dateInput.addEventListener("change", updateDatePreview);
      dateInput.addEventListener("input", updateDatePreview);
    }

    if (btnSetToday && dateInput) {
      btnSetToday.addEventListener("click", () => {
        dateInput.value = getTodayLocalIsoDate();
        updateDatePreview();
      });
    }

    // Live character counters for optional textareas
    document.querySelectorAll(".char-counter[data-for]").forEach((counter) => {
      const fieldId = counter.getAttribute("data-for");
      const textarea = document.getElementById(fieldId);
      if (!textarea) return;
      const max = textarea.getAttribute("maxlength") || "1000";
      const refreshCount = () => {
        counter.textContent = `${textarea.value.length} / ${max}`;
      };
      textarea.addEventListener("input", refreshCount);
      refreshCount();
    });

    // Step 1: Landing -> Letter (+ begin gentle piano music after click)
    if (btnOpenSurprise) {
      btnOpenSurprise.addEventListener("click", () => {
        music.startOnInitialOpen();
        transitionToView("view-letter", letterHeading);
      });
    }

    // Helper: hide inline errors
    function clearErrors() {
      Object.values(errorBoxes).forEach((box) => {
        if (box) {
          box.hidden = true;
          box.textContent = "";
        }
      });
    }

    function showError(answerKey, message) {
      const box = errorBoxes[answerKey];
      if (!box) return;
      box.textContent = message;
      box.hidden = false;
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Step 2: Response selection (YES / NOT_YET / NO)
    choiceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (state.isSubmitting || state.hasSubmitted) return;

        const chosen = button.getAttribute("data-answer");
        if (!panels[chosen]) return;

        state.selectedAnswer = chosen;
        clearErrors();

        Object.entries(panels).forEach(([key, panelEl]) => {
          if (panelEl) panelEl.hidden = key !== chosen;
        });

        if (chosen === "YES") {
          if (dateInput && !dateInput.value) {
            dateInput.value = getTodayLocalIsoDate();
          }
          updateDatePreview();
          petals.triggerYesCelebration();
        }

        transitionToView("view-response", panelHeadings[chosen]);
      });
    });

    // Optional back navigation before submission
    if (btnBackToLetter) {
      btnBackToLetter.addEventListener("click", () => {
        if (state.isSubmitting || state.hasSubmitted) return;
        clearErrors();
        transitionToView("view-letter", letterHeading);
      });
    }

    // Helper: toggle submission lock & loading state
    function setFormLoading(formEl, submitBtn, loading, defaultLabel) {
      state.isSubmitting = loading;
      if (btnBackToLetter) btnBackToLetter.disabled = loading;

      const fields = formEl.querySelectorAll("input, textarea, button");
      fields.forEach((el) => {
        el.disabled = loading;
      });

      if (submitBtn) {
        submitBtn.classList.toggle("is-loading", loading);
        submitBtn.setAttribute("aria-busy", String(loading));
        const labelSpan = submitBtn.querySelector(".btn-label");
        if (labelSpan) {
          labelSpan.textContent = loading ? "Saving your response..." : defaultLabel;
        }
      }
    }

    // Step 4: Render final confirmation screen (only after Supabase confirms success)
    function showConfirmationScreen(result) {
      const { answer, selected_courtship_date: chosenDate } = result.payload;
      const heading = document.getElementById("confirmation-heading");
      const message = document.getElementById("confirmation-message");
      const visual = document.getElementById("confirmation-visual");
      const detailsBox = document.getElementById("confirmation-details");
      const summaryDateRow = document.getElementById("summary-date-row");
      const summaryDateVal = document.getElementById("summary-date-value");
      const summaryTimeVal = document.getElementById("summary-timestamp-value");

      if (answer === "YES") {
        if (heading) heading.textContent = "Thank you, Zey 💗";
        if (message) {
          message.textContent =
            "Your answer has been saved. I'll cherish this day and promise to show up with sincerity, patience, and genuine care.";
        }
        if (visual) {
          visual.innerHTML =
            '<img src="./assets/images/tulip-celebration.svg" alt="Bouquet of blush tulips" width="136" height="130" class="tulip-img tulip-float">';
        }
        if (summaryDateRow && summaryDateVal && chosenDate) {
          summaryDateVal.textContent = formatCalendarDate(chosenDate);
          summaryDateRow.hidden = false;
        }
        petals.triggerYesCelebration();
      } else if (answer === "NOT_YET") {
        if (heading) heading.textContent = "Thank you for being honest, Zey 🌷";
        if (message) {
          message.textContent =
            "Your response has been saved. There's no rush at all — take all the time and space you need. I appreciate you truly.";
        }
        if (summaryDateRow) summaryDateRow.hidden = true;
      } else {
        if (heading) heading.textContent = "Thank you for your honesty, Zey 🌷";
        if (message) {
          message.textContent =
            "Your response has been saved. I genuinely respect your decision and appreciate the kindness you've shown me.";
        }
        if (summaryDateRow) summaryDateRow.hidden = true;
      }

      if (summaryTimeVal) {
        summaryTimeVal.textContent = formatTimestamp(result.submittedAt);
      }
      if (detailsBox) {
        detailsBox.hidden = false;
      }
      if (backRow) {
        backRow.hidden = true;
      }

      transitionToView("view-confirmation", heading);
    }

    // Step 3: Bind form submission handler with strict submission lock
    function wireResponseForm(formId, answerKey, getRawPayload) {
      const formEl = document.getElementById(formId);
      if (!formEl) return;

      const submitBtn = formEl.querySelector('button[type="submit"]');
      const labelSpan = submitBtn ? submitBtn.querySelector(".btn-label") : null;
      const defaultLabel = labelSpan ? labelSpan.textContent : "Send My Response";

      formEl.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Prevent accidental double submissions
        if (state.isSubmitting || state.hasSubmitted) return;

        clearErrors();

        const rawPayload = {
          her_name: "Zey",
          answer: answerKey,
          ...getRawPayload(),
        };

        // Run client-side validation immediately before locking UI
        const validation = window.ZeySupabase.validateResponsePayload(rawPayload);
        if (!validation.valid) {
          showError(answerKey, validation.error);
          return;
        }

        setFormLoading(formEl, submitBtn, true, defaultLabel);

        try {
          const result = await window.ZeySupabase.submitCourtshipResponse(rawPayload);
          // Lock permanently after Supabase confirms successful insert
          state.hasSubmitted = true;
          state.isSubmitting = false;
          showConfirmationScreen(result);
        } catch (err) {
          setFormLoading(formEl, submitBtn, false, defaultLabel);
          showError(
            answerKey,
            err && err.message
              ? err.message
              : "Something went wrong while saving your response. Please try again."
          );
        }
      });
    }

    wireResponseForm("form-yes", "YES", () => ({
      selected_courtship_date: dateInput ? dateInput.value : "",
      personal_message: document.getElementById("yes-message")
        ? document.getElementById("yes-message").value
        : "",
      reason: null,
    }));

    wireResponseForm("form-not-yet", "NOT_YET", () => ({
      selected_courtship_date: null,
      personal_message: null,
      reason: document.getElementById("not-yet-reason")
        ? document.getElementById("not-yet-reason").value
        : "",
    }));

    wireResponseForm("form-no", "NO", () => ({
      selected_courtship_date: null,
      personal_message: null,
      reason: document.getElementById("no-reason")
        ? document.getElementById("no-reason").value
        : "",
    }));
  });
})();
