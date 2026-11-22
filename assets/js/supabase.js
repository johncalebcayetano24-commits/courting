/**
 * ============================================================================
 * SUPABASE CLIENT, VALIDATION & DATA ACCESS LAYER
 * ============================================================================
 *
 * SETUP INSTRUCTIONS:
 *   1. Open your Supabase Dashboard -> Project Settings -> API.
 *   2. Copy your "Project URL" and your "anon" (public / publishable) key.
 *   3. Paste them into DEFAULT_SUPABASE_CONFIG below.
 *
 * SECURITY WARNING:
 *   NEVER place your Supabase "service_role" (secret) key in frontend code!
 *   The "anon" key is designed to be public in static websites (like GitHub
 *   Pages) ONLY because database access is strictly locked down by the Row
 *   Level Security (RLS) policies in database/schema.sql.
 * ============================================================================
 */

(function attachZeySupabase(globalScope) {
  "use strict";

  const DEFAULT_SUPABASE_CONFIG = {
    url: "https://kvcbgogjglivmwueoesd.supabase.co",
    anonKey: "sb_publishable_5uuBz8ixVTtUH9jDcsi_vw_U_JQIDN5",
  };

  const ALLOWED_ANSWERS = Object.freeze(["YES", "NOT_YET", "NO"]);
  const MAX_NAME_LENGTH = 100;
  const MAX_TEXT_LENGTH = 1000;

  let cachedClient = null;

  /**
   * Returns active Supabase configuration (allows optional runtime override).
   */
  function getConfig() {
    const override = globalScope.__ZEY_SUPABASE_CONFIG__;
    if (override && typeof override === "object") {
      return {
        url: String(override.url || "").trim(),
        anonKey: String(override.anonKey || "").trim(),
      };
    }
    return {
      url: DEFAULT_SUPABASE_CONFIG.url.trim(),
      anonKey: DEFAULT_SUPABASE_CONFIG.anonKey.trim(),
    };
  }

  /**
   * Checks whether valid Supabase credentials have been configured.
   */
  function isSupabaseConfigured() {
    const { url, anonKey } = getConfig();
    if (!url || !anonKey) return false;
    if (url.includes("YOUR_SUPABASE_") || anonKey.includes("YOUR_SUPABASE_")) {
      return false;
    }
    const validUrl =
      /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url);
    return validUrl && anonKey.length >= 20;
  }

  /**
   * Lazily initializes and returns the Supabase JS client singleton.
   */
  function getSupabaseClient() {
    if (cachedClient) return cachedClient;

    if (!isSupabaseConfigured()) {
      throw new Error(
        "Supabase is not configured yet. Please add your Project URL and anon key in assets/js/supabase.js."
      );
    }

    if (
      !globalScope.supabase ||
      typeof globalScope.supabase.createClient !== "function"
    ) {
      throw new Error(
        "Unable to load the Supabase client library. Please check your internet connection and refresh."
      );
    }

    const { url, anonKey } = getConfig();
    cachedClient = globalScope.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    return cachedClient;
  }

  /**
   * Strips unsafe ASCII control characters, normalizes line breaks, trims,
   * and enforces a maximum character length. Returns null when blank.
   */
  function sanitizeOptionalText(value, maxLength = MAX_TEXT_LENGTH) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength);
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Validates a YYYY-MM-DD calendar date string strictly.
   */
  function isValidCalendarDate(dateStr) {
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }
    const [year, month, day] = dateStr.split("-").map(Number);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }

  /**
   * Validates and sanitizes a response payload before database submission.
   */
  function validateResponsePayload(input) {
    const herName = sanitizeOptionalText(input.her_name || "Zey", MAX_NAME_LENGTH);
    if (!herName) {
      return { valid: false, error: "Name is required." };
    }

    const answer = String(input.answer || "").trim().toUpperCase();
    if (!ALLOWED_ANSWERS.includes(answer)) {
      return { valid: false, error: "Please select a valid response option." };
    }

    let selectedCourtshipDate = null;
    if (answer === "YES") {
      const rawDate = String(input.selected_courtship_date || "").trim();
      if (!rawDate) {
        return {
          valid: false,
          error: "Please choose the date you decided to give me this chance.",
        };
      }
      if (!isValidCalendarDate(rawDate)) {
        return {
          valid: false,
          error: "Please enter a valid calendar date.",
        };
      }
      selectedCourtshipDate = rawDate;
    }

    const reason =
      answer === "YES"
        ? null
        : sanitizeOptionalText(input.reason, MAX_TEXT_LENGTH);

    const personalMessage =
      answer === "YES"
        ? sanitizeOptionalText(input.personal_message, MAX_TEXT_LENGTH)
        : null;

    return {
      valid: true,
      payload: {
        her_name: herName,
        answer,
        reason,
        selected_courtship_date: selectedCourtshipDate,
        personal_message: personalMessage,
      },
    };
  }

  /**
   * Submits a validated response to Supabase `public.courtship_responses`.
   *
   * NOTE: We intentionally DO NOT chain `.select()` after `.insert()`, because
   * anonymous visitors are prohibited by RLS from reading back any rows.
   * PostgREST confirms the insert with HTTP 201 and `error === null`.
   */
  async function submitCourtshipResponse(rawInput) {
    const validation = validateResponsePayload(rawInput);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from("courtship_responses")
      .insert([validation.payload]);

    if (error) {
      console.error("[Supabase Insert Error]", error);
      if (error.code === "42501") {
        throw new Error(
          "Your response could not be saved because database permissions need to be configured."
        );
      }
      throw new Error(
        "Something went wrong while saving your response. Please check your connection and try again."
      );
    }

    return {
      ok: true,
      submittedAt: new Date().toISOString(),
      payload: validation.payload,
    };
  }

  /**
   * Signs in an administrator using Supabase Auth (Email + Password).
   */
  async function signInAdmin(email, password) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Please enter a valid administrator email address.");
    }
    if (!cleanPassword) {
      throw new Error("Please enter your password.");
    }

    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error) {
      throw new Error("Invalid email or password. Please try again.");
    }

    return data;
  }

  /**
   * Signs out the currently logged-in administrator.
   */
  async function signOutAdmin() {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error("Could not sign out cleanly. Please refresh and try again.");
    }
  }

  /**
   * Returns the active Supabase Auth session, or null if signed out.
   */
  async function getAdminSession() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  /**
   * Verifies that the currently authenticated user is listed in `public.admin_users`.
   */
  async function verifyAdminAccess(userId) {
    if (!userId) return false;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[Admin Verification Error]", error);
      return false;
    }
    return Boolean(data && data.user_id === userId);
  }

  /**
   * Fetches all courtship responses ordered newest-first (admin-only via RLS).
   */
  async function fetchCourtshipResponses() {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("courtship_responses")
      .select(
        "id, her_name, answer, reason, response_date, selected_courtship_date, personal_message"
      )
      .order("response_date", { ascending: false });

    if (error) {
      console.error("[Admin Fetch Error]", error);
      throw new Error(
        "Unable to load responses. Please verify your admin permissions and try again."
      );
    }

    return Array.isArray(data) ? data : [];
  }

  /**
   * Subscribes to Supabase Auth state changes.
   */
  function onAdminAuthStateChange(callback) {
    const client = getSupabaseClient();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data.subscription;
  }

  /**
   * Resets cached client (useful for testing configuration changes).
   */
  function resetClient() {
    cachedClient = null;
  }

  globalScope.ZeySupabase = Object.freeze({
    isSupabaseConfigured,
    sanitizeOptionalText,
    isValidCalendarDate,
    validateResponsePayload,
    submitCourtshipResponse,
    signInAdmin,
    signOutAdmin,
    getAdminSession,
    verifyAdminAccess,
    fetchCourtshipResponses,
    onAdminAuthStateChange,
    resetClient,
  });
})(window);
