// Zenith FitOS Universal API Client & Intelligent Offline Engine

export interface BackendStatus {
  connected: boolean;
  url: string;
  latencyMs?: number;
  message?: string;
  isColdStart?: boolean;
}

const STORAGE_BACKEND_KEY = "zenith_backend_url";
const STORAGE_GEMINI_KEY = "zenith_gemini_api_key";

/**
 * Get current configured backend URL.
 * Priority: 1) localStorage 2) import.meta.env.VITE_API_URL 3) empty string (relative /api)
 */
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_BACKEND_KEY);
    if (saved !== null && saved.trim() !== "") {
      return saved.trim().replace(/\/+$/, "");
    }
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "";
}

/**
 * Update backend URL in local storage.
 */
export function setBackendUrl(url: string): void {
  if (typeof window !== "undefined") {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!trimmed) {
      localStorage.removeItem(STORAGE_BACKEND_KEY);
    } else {
      localStorage.setItem(STORAGE_BACKEND_KEY, trimmed);
    }
  }
}

/**
 * Get client-side Gemini API key if provided.
 */
export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_GEMINI_KEY);
    if (saved) return saved.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  return typeof envKey === "string" ? envKey.trim() : "";
}

/**
 * Set client-side Gemini API key in local storage.
 */
export function setGeminiApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (!key.trim()) {
      localStorage.removeItem(STORAGE_GEMINI_KEY);
    } else {
      localStorage.setItem(STORAGE_GEMINI_KEY, key.trim());
    }
  }
}

/**
 * Robust API fetch wrapper with configurable timeout and error handling.
 */
export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const baseUrl = getBackendUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const fullUrl = baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsedMsg = `HTTP Error ${response.status}`;
      try {
        const json = JSON.parse(errorText);
        parsedMsg = json.error || json.message || parsedMsg;
      } catch {}
      throw new Error(parsedMsg);
    }

    return (await response.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out (Server may be cold-starting).");
    }
    throw err;
  }
}

/**
 * Test connectivity to Render or backend server.
 */
export async function testBackendConnection(customUrl?: string): Promise<BackendStatus> {
  const targetUrl = (customUrl !== undefined ? customUrl.trim() : getBackendUrl()).replace(/\/+$/, "");
  const pingUrl = targetUrl ? `${targetUrl}/api/health` : "/api/health";

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(pingUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      return {
        connected: true,
        url: targetUrl || "Same Origin (Proxy)",
        latencyMs,
        message: `Connected (${latencyMs}ms)`
      };
    } else {
      return {
        connected: false,
        url: targetUrl || "Same Origin (Proxy)",
        message: `HTTP ${res.status} - ${res.statusText}`
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    return {
      connected: false,
      url: targetUrl || "Same Origin (Proxy)",
      isColdStart: isTimeout,
      message: isTimeout ? "Server is waking up (cold start)..." : (err.message || "Unreachable")
    };
  }
}

/**
 * High-Intelligence Sports-Science Offline Rules Engine
 * Provides instant, rich, tailored coaching when backend is spinning up or offline.
 */
export function generateSmartLocalCoachResponse({
  message,
  meals,
  goals,
  habits = [],
  sleepLogs = []
}: {
  message: string;
  meals: any[];
  goals: any;
  habits?: any[];
  sleepLogs?: any[];
}): string {
  const norm = message.toLowerCase().trim();

  // 1. Calculate Live Intake Metrics
  const totals = (meals || []).reduce(
    (acc, m) => {
      acc.calories += Number(m.calories) || 0;
      acc.protein += Number(m.protein) || 0;
      acc.carbs += Number(m.carbs) || 0;
      acc.fats += Number(m.fats) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const calLeft = (goals?.calories || 2200) - totals.calories;
  const proteinLeft = (goals?.protein || 165) - totals.protein;
  const carbsLeft = (goals?.carbs || 240) - totals.carbs;
  const fatsLeft = (goals?.fats || 70) - totals.fats;

  // Hydration & sleep check
  const hydrationHabit = habits.find((h) => h.name.toLowerCase().includes("drink") || h.name.toLowerCase().includes("water") || h.name.toLowerCase().includes("hydration"));
  const todayStr = new Date().toISOString().split("T")[0];
  const waterDoneToday = hydrationHabit?.completedDates?.includes(todayStr);

  const recentSleep = sleepLogs?.[0];

  // Specific Query Matchers:
  
  // High Protein recommendation
  if (norm.includes("protein") || norm.includes("should i eat") || norm.includes("high-protein") || norm.includes("snack")) {
    let out = `⚡ **High-Protein Recommendation Analysis**\n\n`;
    out += `Your current protein progress: **${totals.protein}g / ${goals.protein}g** (${proteinLeft > 0 ? `${proteinLeft}g remaining` : "Goal surpassed! 🔥"})\n\n`;
    
    if (proteinLeft > 30) {
      out += `You have substantial protein room remaining. Optimal dense protein meals:\n`;
      out += `• **Grilled Chicken Breast (180g)**: ~300 kcal | 54g Protein | 0g Carbs | 6g Fats\n`;
      out += `• **Egg White Scramble + 1 Whole Egg**: ~190 kcal | 32g Protein | 2g Carbs | 5g Fats\n`;
      out += `• **Whey Protein Shake (1.5 scoops)**: ~210 kcal | 36g Protein | 4g Carbs | 2g Fats\n`;
    } else if (proteinLeft > 0) {
      out += `You're very close to your target! Quick light protein toppers:\n`;
      out += `• **0% Greek Yogurt (1 cup / 170g)**: ~100 kcal | 18g Protein | 6g Carbs | 0g Fats\n`;
      out += `• **Cottage Cheese (150g)**: ~125 kcal | 17g Protein | 5g Carbs | 3g Fats\n`;
      out += `• **Handful Boiled Edamame (100g)**: ~120 kcal | 11g Protein | 9g Carbs | 5g Fats\n`;
    } else {
      out += `🏆 **Protein target achieved!** Focus your remaining intake on high-fiber complex carbohydrates (sweet potato, oats, berries) and anti-inflammatory healthy fats (avocado, walnuts).\n`;
    }
    return out;
  }

  // Pre-Workout / Post-Workout Energy
  if (norm.includes("workout") || norm.includes("pre-workout") || norm.includes("post-workout") || norm.includes("energy")) {
    let out = `🏋️ **Workout Timing & Fueling Strategy**\n\n`;
    out += `• **60–90 Mins Pre-Workout**: 30–45g fast-digesting complex carbs + 15g lean protein (e.g. 1 medium banana + 1 slice whole wheat toast with light peanut butter, or oatmeal with berries).\n`;
    out += `• **Post-Workout Recovery Window**: Re-synthesize glycogen and repair myofibrils with 25–40g rapid protein + 40g carbs (e.g. Whey shake + rice cakes or chicken quinoa bowl).\n\n`;
    out += `💧 **Hydration Status**: ${waterDoneToday ? "Hydration logged for today! Outstanding." : "Make sure you drink 500ml water prior to training for maximum muscle pump & cognitive alertness."}`;
    return out;
  }

  // Dinner / Low Calorie Meal
  if (norm.includes("dinner") || norm.includes("meal") || norm.includes("lunch") || norm.includes("breakfast")) {
    let out = `🍽️ **Actionable Meal Blueprint**\n\n`;
    out += `Based on your remaining **${calLeft > 0 ? `${calLeft} kcal` : "0 kcal"}** allocation:\n`;
    if (calLeft > 500) {
      out += `• **Option 1 (Balanced Power Plate)**: Pan-seared Salmon (150g) + Steamed Jasmine Rice (150g) + Roasted Asparagus | ~560 kcal (P: 38g, C: 45g, F: 18g)\n`;
      out += `• **Option 2 (High-Volume Lean Cut)**: Ground Turkey / Beef 93% (180g) + Baked Sweet Potato (150g) + Broccoli | ~490 kcal (P: 42g, C: 38g, F: 12g)\n`;
    } else if (calLeft > 200) {
      out += `• **Option 1 (Lean Protein Salad)**: Grilled Chicken (150g) over massive mixed greens, cucumbers, cherry tomatoes, and 1 tbsp light balsamic | ~280 kcal (P: 46g, C: 8g, F: 6g)\n`;
      out += `• **Option 2 (Savory Omelette)**: 3 Egg whites + 1 Whole Egg with mushrooms, spinach, and 20g low-fat feta | ~230 kcal (P: 25g, C: 4g, F: 11g)\n`;
    } else {
      out += `• You have reached your calorie threshold today! If still hungry, stick to high-volume zero-guilt items: hot peppermint green tea, crisp sliced cucumbers with pink salt, or sugar-free electrolyte broth.\n`;
    }
    return out;
  }

  // Calorie / Macro Balance & Overview
  if (norm.includes("balance") || norm.includes("track") || norm.includes("goal") || norm.includes("macros") || norm.includes("deficit") || norm.includes("today") || norm.includes("breakdown")) {
    const calPct = Math.round((totals.calories / (goals.calories || 1)) * 100);
    let out = `📊 **Daily Metabolic Calibration Summary**\n\n`;
    out += `• **Calories**: **${totals.calories}** / ${goals.calories} kcal (${calPct}% completed, **${calLeft > 0 ? `${calLeft} kcal left` : `${Math.abs(calLeft)} kcal surplus`}**)\n`;
    out += `• **Protein**: **${totals.protein}g** / ${goals.protein}g (${proteinLeft > 0 ? `${proteinLeft}g remaining` : "Met!"})\n`;
    out += `• **Carbohydrates**: **${totals.carbs}g** / ${goals.carbs}g (${carbsLeft > 0 ? `${carbsLeft}g remaining` : "Met!"})\n`;
    out += `• **Fats**: **${totals.fats}g** / ${goals.fats}g (${fatsLeft > 0 ? `${fatsLeft}g remaining` : "Met!"})\n\n`;
    
    if (recentSleep) {
      out += `😴 **Recovery**: Last sleep logged was **${recentSleep.hours}h** (${recentSleep.quality} quality). Your metabolic burn rate is well-primed.`;
    }
    return out;
  }

  // General conversational greeting or fallback
  let out = `👋 **Hello Athlete!** I am your Zenith Athletic AI Coach.\n\n`;
  out += `Here is your quick status snapshot for today:\n`;
  out += `• **Energy Ingested**: **${totals.calories} kcal** (${calLeft > 0 ? `${calLeft} kcal remaining` : "Target satisfied"})\n`;
  out += `• **Protein Target**: **${totals.protein}g** / ${goals.protein}g (${proteinLeft > 0 ? `${proteinLeft}g to goal` : "Goal achieved! 🎯"})\n\n`;
  out += `💡 *Ask me anything specific like: "What should I eat for dinner?", "Suggest a 35g protein snack", or "Am I hitting my macros today?"*`;
  return out;
}
