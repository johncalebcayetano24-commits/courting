/**
 * ============================================================================
 * PRIVATE ADMIN DASHBOARD CONTROLLER — A Little Question for Zey
 * ============================================================================
 * Security:
 *   - Uses Supabase Auth (email + password) — zero hardcoded credentials.
 *   - Verifies membership in public.admin_users + database RLS policies.
 *   - Renders all user-submitted database text exclusively with textContent
 *     to prevent XSS injection.
 * ============================================================================
 */

(function initAdminDashboard() {
  "use strict";

  const state = {
    responses: [],
    activeFilter: "ALL",
    isLoadingResponses: false,
  };

  /* ------------------------------------------------------------------------
     Formatting Helpers
     ------------------------------------------------------------------------ */
  function formatDateTime(isoString) {
    if (!isoString) return "Unknown time";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function formatCalendarDate(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(localDate);
  }

  function getAnswerDisplay(answer) {
    switch (answer) {
      case "YES":
        return { label: "YES 💗", badgeClass: "answer-badge--yes", cardClass: "response-card--yes" };
      case "NOT_YET":
        return { label: "NOT YET", badgeClass: "answer-badge--notyet", cardClass: "" };
      case "NO":
        return { label: "NO", badgeClass: "answer-badge--no", cardClass: "" };
      default:
        return { label: String(answer || "UNKNOWN"), badgeClass: "answer-badge--no", cardClass: "" };
    }
  }

  /**
   * Safe DOM element helper using textContent only.
   */
  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  /* ------------------------------------------------------------------------
     Dashboard Rendering (100% XSS-safe via textContent)
     ------------------------------------------------------------------------ */
  function buildResponseCard(item) {
    const meta = getAnswerDisplay(item.answer);
    const card = createEl("article", `response-card ${meta.cardClass}`.trim());

    // Header: Her name + timestamp + Answer badge
    const head = createEl("div", "response-card-head");
    const identity = createEl("div");
    identity.appendChild(createEl("h2", "respondent-name", item.her_name || "Zey"));
    identity.appendChild(
      createEl("p", "response-time", `Submitted on ${formatDateTime(item.response_date)}`)
    );

    const badge = createEl("span", `answer-badge ${meta.badgeClass}`, meta.label);
    head.appendChild(identity);
    head.appendChild(badge);
    card.appendChild(head);

    // Details grid
    const grid = createEl("div", "detail-grid");

    // Selected courtship date (when available)
    if (item.selected_courtship_date) {
      const dateBox = createEl("div", "detail-box detail-box--highlight");
      dateBox.appendChild(createEl("span", "detail-label", "Selected Courtship Date"));
      dateBox.appendChild(
        createEl("p", "detail-value", formatCalendarDate(item.selected_courtship_date))
      );
      grid.appendChild(dateBox);
    }

    // Personal message (typically on YES)
    if (item.personal_message) {
      const msgBox = createEl("div", "detail-box");
      msgBox.appendChild(createEl("span", "detail-label", "Personal Message"));
      msgBox.appendChild(createEl("p", "detail-value", item.personal_message));
      grid.appendChild(msgBox);
    }

    // Optional reason (typically on NOT_YET or NO)
    if (item.reason) {
      const reasonBox = createEl("div", "detail-box");
      reasonBox.appendChild(createEl("span", "detail-label", "Message / Reason Shared"));
      reasonBox.appendChild(createEl("p", "detail-value", item.reason));
      grid.appendChild(reasonBox);
    }

    // Graceful note if neither reason nor personal_message was written
    if (!item.personal_message && !item.reason) {
      const emptyNote = createEl("div", "detail-box");
      emptyNote.appendChild(
        createEl("span", "detail-label", item.answer === "YES" ? "Personal Message" : "Optional Note")
      );
      emptyNote.appendChild(
        createEl("p", "detail-value detail-value--muted", "No additional message was written.")
      );
      grid.appendChild(emptyNote);
    }

    card.appendChild(grid);
    return card;
  }

  /* ------------------------------------------------------------------------
     Main Admin Controller
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    const configWarning = document.getElementById("config-warning");
    const loadingSection = document.getElementById("admin-loading");
    const loginSection = document.getElementById("admin-login-section");
    const dashboardSection = document.getElementById("admin-dashboard-section");

    const loginForm = document.getElementById("admin-login-form");
    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");
    const loginBtn = document.getElementById("btn-admin-login");
    const loginError = document.getElementById("login-error");

    const accountEmailEl = document.getElementById("admin-account-email");
    const refreshBtn = document.getElementById("btn-refresh");
    const logoutBtn = document.getElementById("btn-logout");

    const statTotal = document.getElementById("stat-total");
    const statYes = document.getElementById("stat-yes");
    const statNotYet = document.getElementById("stat-notyet");
    const statNo = document.getElementById("stat-no");

    const filterBtns = document.querySelectorAll(".filter-btn[data-filter]");
    const lastUpdatedEl = document.getElementById("last-updated");
    const dashboardError = document.getElementById("dashboard-error");
    const responsesLoading = document.getElementById("responses-loading");
    const responsesEmpty = document.getElementById("responses-empty");
    const emptyTitle = document.getElementById("empty-title");
    const emptyCopy = document.getElementById("empty-copy");
    const responsesList = document.getElementById("responses-list");

    function showSection(sectionName) {
      loadingSection.hidden = sectionName !== "loading";
      loginSection.hidden = sectionName !== "login";
      dashboardSection.hidden = sectionName !== "dashboard";
    }

    function setLoginError(message) {
      if (!message) {
        loginError.hidden = true;
        loginError.textContent = "";
      } else {
        loginError.textContent = message;
        loginError.hidden = false;
      }
    }

    function setDashboardError(message) {
      if (!message) {
        dashboardError.hidden = true;
        dashboardError.textContent = "";
      } else {
        dashboardError.textContent = message;
        dashboardError.hidden = false;
      }
    }

    function setLoginSubmitting(isBusy) {
      emailInput.disabled = isBusy;
      passwordInput.disabled = isBusy;
      loginBtn.disabled = isBusy;
      loginBtn.classList.toggle("is-loading", isBusy);
      const label = loginBtn.querySelector(".btn-label");
      if (label) label.textContent = isBusy ? "Signing in..." : "Sign In";
    }

    function updateStats() {
      const total = state.responses.length;
      const yesCount = state.responses.filter((r) => r.answer === "YES").length;
      const notYetCount = state.responses.filter((r) => r.answer === "NOT_YET").length;
      const noCount = state.responses.filter((r) => r.answer === "NO").length;

      statTotal.textContent = String(total);
      statYes.textContent = String(yesCount);
      statNotYet.textContent = String(notYetCount);
      statNo.textContent = String(noCount);
    }

    function renderResponses() {
      updateStats();
      responsesList.replaceChildren();

      const filtered =
        state.activeFilter === "ALL"
          ? state.responses
          : state.responses.filter((item) => item.answer === state.activeFilter);

      if (filtered.length === 0) {
        responsesEmpty.hidden = false;
        if (state.responses.length === 0) {
          emptyTitle.textContent = "No responses yet";
          emptyCopy.textContent =
            "Once Zey submits her answer, it will appear right here.";
        } else {
          emptyTitle.textContent = "No matching responses";
          emptyCopy.textContent =
            "There are currently no responses under this filter.";
        }
        return;
      }

      responsesEmpty.hidden = true;
      const fragment = document.createDocumentFragment();
      filtered.forEach((item) => {
        fragment.appendChild(buildResponseCard(item));
      });
      responsesList.appendChild(fragment);
    }

    async function loadResponses() {
      if (state.isLoadingResponses) return;
      state.isLoadingResponses = true;
      setDashboardError("");
      responsesLoading.hidden = false;
      responsesEmpty.hidden = true;
      responsesList.replaceChildren();
      refreshBtn.disabled = true;

      try {
        const data = await window.ZeySupabase.fetchCourtshipResponses();
        state.responses = data;
        responsesLoading.hidden = true;
        renderResponses();

        const nowLabel = new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date());
        lastUpdatedEl.textContent = `Updated at ${nowLabel}`;
      } catch (err) {
        responsesLoading.hidden = true;
        setDashboardError(
          err && err.message ? err.message : "Failed to load responses."
        );
      } finally {
        state.isLoadingResponses = false;
        refreshBtn.disabled = false;
      }
    }

    async function handleActiveSession(session) {
      if (!session || !session.user) {
        state.responses = [];
        responsesList.replaceChildren();
        showSection("login");
        return;
      }

      // Verify explicit administrator membership in public.admin_users
      const isAdmin = await window.ZeySupabase.verifyAdminAccess(session.user.id);
      if (!isAdmin) {
        try {
          await window.ZeySupabase.signOutAdmin();
        } catch {
          // Ignore signout error during rejection
        }
        state.responses = [];
        responsesList.replaceChildren();
        showSection("login");
        setLoginError(
          "Access denied. This account is not registered in the administrator allowlist (public.admin_users)."
        );
        return;
      }

      accountEmailEl.textContent = session.user.email || "Administrator";
      setLoginError("");
      showSection("dashboard");
      await loadResponses();
    }

    // Filter tabs
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextFilter = btn.getAttribute("data-filter") || "ALL";
        state.activeFilter = nextFilter;

        filterBtns.forEach((other) => {
          const active = other === btn;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-selected", String(active));
        });

        renderResponses();
      });
    });

    // Refresh button
    refreshBtn.addEventListener("click", () => {
      loadResponses();
    });

    // Logout button
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await window.ZeySupabase.signOutAdmin();
        state.responses = [];
        responsesList.replaceChildren();
        passwordInput.value = "";
        showSection("login");
      } catch (err) {
        setDashboardError(err && err.message ? err.message : "Could not log out.");
      } finally {
        logoutBtn.disabled = false;
      }
    });

    // Admin login form submit
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setLoginError("");

      if (!window.ZeySupabase.isSupabaseConfigured()) {
        setLoginError(
          "Please configure your Supabase Project URL and anon key in assets/js/supabase.js first."
        );
        return;
      }

      setLoginSubmitting(true);
      try {
        const data = await window.ZeySupabase.signInAdmin(
          emailInput.value,
          passwordInput.value
        );
        passwordInput.value = "";
        await handleActiveSession(data.session);
      } catch (err) {
        setLoginError(
          err && err.message ? err.message : "Unable to sign in. Please try again."
        );
      } finally {
        setLoginSubmitting(false);
      }
    });

    // Initial bootstrap
    async function bootstrap() {
      if (!window.ZeySupabase.isSupabaseConfigured()) {
        configWarning.hidden = false;
        showSection("login");
        return;
      }

      try {
        const session = await window.ZeySupabase.getAdminSession();
        await handleActiveSession(session);

        window.ZeySupabase.onAdminAuthStateChange((event, nextSession) => {
          if (event === "SIGNED_OUT") {
            state.responses = [];
            responsesList.replaceChildren();
            showSection("login");
          } else if (event === "TOKEN_REFRESHED" && nextSession) {
            accountEmailEl.textContent = nextSession.user.email || "Administrator";
          }
        });
      } catch (err) {
        console.error("[Admin Init Error]", err);
        showSection("login");
        setLoginError("Unable to verify session. Please sign in again.");
      }
    }

    bootstrap();
  });
})();
