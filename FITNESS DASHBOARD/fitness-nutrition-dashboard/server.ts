import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini SDK lazily if key is available
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

interface Meal {
  id: string;
  meal: string;
  food: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

const defaultGoals: Goals = {
  calories: 2200,
  protein: 165,
  carbs: 240,
  fats: 70
};

const starterMeals: Meal[] = [
  { id: "starter-1", meal: "Breakfast", food: "Greek yogurt bowl", serving: "1 bowl", calories: 380, protein: 31, carbs: 44, fats: 9 },
  { id: "starter-2", meal: "Lunch", food: "Chicken quinoa salad", serving: "420g", calories: 610, protein: 48, carbs: 58, fats: 18 },
  { id: "starter-3", meal: "Snack", food: "Banana and almonds", serving: "1 medium + 20g", calories: 235, protein: 7, carbs: 33, fats: 10 },
  { id: "starter-4", meal: "Dinner", food: "Salmon rice plate", serving: "1 plate", calories: 690, protein: 46, carbs: 62, fats: 27 }
];

const foodDatabase = [
  // MEATS, POULTRY & SEAFOOD
  { food: "Chicken Breast", serving: "1 piece (150g)", calories: 250, protein: 46.5, carbs: 0, fats: 5.4 },
  { food: "Chicken Thigh (Skinless)", serving: "1 piece (120g)", calories: 210, protein: 26, carbs: 0, fats: 11 },
  { food: "Beef Filet Mignon", serving: "1 steak (150g)", calories: 290, protein: 39, carbs: 0, fats: 14 },
  { food: "Ground Beef (93% Lean)", serving: "1 portion (150g)", calories: 230, protein: 31, carbs: 0, fats: 11 },
  { food: "Pork Chop (Lean)", serving: "1 chop (150g)", calories: 260, protein: 40, carbs: 0, fats: 10 },
  { food: "Salmon Fillet", serving: "1 fillet (150g)", calories: 310, protein: 34, carbs: 0, fats: 18 },
  { food: "Salmon Rice Plate", serving: "1 plate", calories: 690, protein: 46, carbs: 62, fats: 27 },
  { food: "Tuna (Canned in Water)", serving: "1 can (100g drained)", calories: 116, protein: 26, carbs: 0, fats: 1 },
  { food: "Shrimp / Prawns (Cooked)", serving: "10 medium (100g)", calories: 99, protein: 24, carbs: 0.2, fats: 0.3 },
  { food: "Turkey Breast (Sliced)", serving: "4 slices (80g)", calories: 104, protein: 20, carbs: 1.1, fats: 2 },
  
  // DAIRY, EGGS & ALTERNATIVES
  { food: "Whole Egg (Large)", serving: "1 egg", calories: 70, protein: 6, carbs: 0.6, fats: 5 },
  { food: "Egg Whites", serving: "1 cup (approx 4 eggs)", calories: 120, protein: 26, carbs: 1.5, fats: 0.5 },
  { food: "Greek Yogurt Bowl", serving: "1 bowl", calories: 380, protein: 31, carbs: 44, fats: 9 },
  { food: "Greek Yogurt (0% Fat)", serving: "1 cup (150g)", calories: 90, protein: 15, carbs: 6, fats: 0 },
  { food: "Cottage Cheese (Low Fat)", serving: "1 bowl (150g)", calories: 123, protein: 16.5, carbs: 5, fats: 3.5 },
  { food: "Whole Milk", serving: "1 glass (240ml)", calories: 149, protein: 8, carbs: 12, fats: 8 },
  { food: "Skim Milk", serving: "1 glass (240ml)", calories: 86, protein: 8, carbs: 12, fats: 0.2 },
  { food: "Almond Milk (Unsweetened)", serving: "1 glass (240ml)", calories: 30, protein: 1, carbs: 1, fats: 2.5 },
  { food: "Soy Milk (Original)", serving: "1 glass (240ml)", calories: 110, protein: 8, carbs: 9, fats: 4.5 },
  { food: "Cheddar Cheese", serving: "1 slice (28g)", calories: 113, protein: 7, carbs: 0.4, fats: 9.3 },

  // GRAINS, CARBS, BREADS
  { food: "White Rice (Cooked)", serving: "1 bowl (approx 150g)", calories: 195, protein: 4, carbs: 43, fats: 0.4 },
  { food: "Brown Rice (Cooked)", serving: "1 bowl (approx 150g)", calories: 165, protein: 3.5, carbs: 35, fats: 1.2 },
  { food: "Quinoa (Cooked)", serving: "1 bowl (150g)", calories: 180, protein: 6, carbs: 32, fats: 3 },
  { food: "Oatmeal (Cooked with Water)", serving: "1 bowl", calories: 150, protein: 5, carbs: 27, fats: 2.5 },
  { food: "Sweet Potato (Baked)", serving: "1 medium (150g)", calories: 135, protein: 3, carbs: 31, fats: 0.2 },
  { food: "Baked Potato (White)", serving: "1 medium (170g)", calories: 160, protein: 4.3, carbs: 37, fats: 0.2 },
  { food: "Whole Wheat Bread", serving: "1 slice (28g)", calories: 69, protein: 3.6, carbs: 12, fats: 0.9 },
  { food: "Sourdough Bread", serving: "1 slice (32g)", calories: 85, protein: 3, carbs: 17, fats: 0.5 },
  { food: "Pancake", serving: "1 large (single)", calories: 90, protein: 2.5, carbs: 15, fats: 2 },
  { food: "Waffle (Plain)", serving: "1 piece", calories: 120, protein: 3, carbs: 16, fats: 5 },

  // LEGUMES, BEANS & VEGAN PROTEINS
  { food: "Tofu (Firm)", serving: "1 slice (100g)", calories: 94, protein: 10, carbs: 2.3, fats: 5 },
  { food: "Tempeh", serving: "100g portion", calories: 193, protein: 19, carbs: 9, fats: 11 },
  { food: "Chickpeas / Garbanzo (Cooked)", serving: "1 bowl (150g)", calories: 240, protein: 12, carbs: 38, fats: 4 },
  { food: "Lentils (Cooked)", serving: "1 bowl (150g)", calories: 180, protein: 15, carbs: 30, fats: 0.8 },
  { food: "Black Beans (Cooked)", serving: "1 bowl (150g)", calories: 200, protein: 13, carbs: 36, fats: 0.8 },
  { food: "Hummus", serving: "2 tbsp (30g)", calories: 75, protein: 2, carbs: 4, fats: 5 },

  // FRUITS
  { food: "Banana", serving: "1 medium", calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
  { food: "Apple", serving: "1 medium", calories: 95, protein: 0.5, carbs: 25, fats: 0.3 },
  { food: "Strawberries", serving: "1 cup (150g)", calories: 49, protein: 1, carbs: 11.7, fats: 0.5 },
  { food: "Blueberries", serving: "1 cup (150g)", calories: 85, protein: 1, carbs: 21, fats: 0.5 },
  { food: "Mango", serving: "1 medium (200g)", calories: 120, protein: 1.6, carbs: 30, fats: 0.5 },
  { food: "Orange", serving: "1 medium", calories: 62, protein: 1.2, carbs: 15, fats: 0.2 },
  { food: "Grapes (Red/Green)", serving: "1 cup (150g)", calories: 104, protein: 1.1, carbs: 27, fats: 0.2 },
  { food: "Watermelon", serving: "1 slice (280g)", calories: 85, protein: 1.7, carbs: 21, fats: 0.4 },
  { food: "Peach", serving: "1 medium", calories: 59, protein: 1.4, carbs: 14, fats: 0.4 },

  // VEGETABLES & GREENS
  { food: "Broccoli (Steamed)", serving: "1 cup", calories: 35, protein: 2.8, carbs: 7, fats: 0.4 },
  { food: "Spinach (Raw)", serving: "1 cup", calories: 7, protein: 0.9, carbs: 1, fats: 0.1 },
  { food: "Mixed Salad Greens", serving: "1 bowl", calories: 15, protein: 1.3, carbs: 2.8, fats: 0.2 },
  { food: "Asparagus (Grilled)", serving: "5 spears", calories: 20, protein: 2.2, carbs: 3.7, fats: 0.2 },
  { food: "Brussels Sprouts (Roasted)", serving: "1 cup", calories: 56, protein: 4, carbs: 11, fats: 0.8 },
  { food: "Carrots (Raw)", serving: "1 medium", calories: 25, protein: 0.6, carbs: 6, fats: 0.1 },
  { food: "Cucumber", serving: "1 medium", calories: 30, protein: 1.3, carbs: 6, fats: 0.3 },
  { food: "Tomato", serving: "1 medium", calories: 22, protein: 1.1, carbs: 4.8, fats: 0.2 },
  { food: "Cauliflower (Riced)", serving: "1 cup (100g)", calories: 25, protein: 2, carbs: 5, fats: 0.3 },

  // FATS, NUTS, SEEDS & OILS
  { food: "Avocado", serving: "1/2 medium", calories: 120, protein: 1.5, carbs: 6, fats: 11 },
  { food: "Avocado Toast", serving: "1 slice", calories: 230, protein: 6, carbs: 24, fats: 12 },
  { food: "Olive Oil", serving: "1 tbsp (14ml)", calories: 119, protein: 0, carbs: 0, fats: 13.5 },
  { food: "Butter (Salted/Unsalted)", serving: "1 tbsp (14g)", calories: 102, protein: 0.1, carbs: 0, fats: 11.5 },
  { food: "Peanut Butter", serving: "1 tbsp (16g)", calories: 95, protein: 4, carbs: 3, fats: 8 },
  { food: "Almonds", serving: "1 handful (approx 15 nuts)", calories: 116, protein: 4, carbs: 4.4, fats: 10 },
  { food: "Walnuts", serving: "1 portion (28g)", calories: 185, protein: 4.3, carbs: 3.9, fats: 18.5 },
  { food: "Chia Seeds", serving: "1 tbsp (12g)", calories: 60, protein: 2, carbs: 5, fats: 4 },
  { food: "Flax Seeds (Ground)", serving: "1 tbsp (10g)", calories: 55, protein: 1.9, carbs: 3, fats: 4.3 },

  // REGIONAL, SOUTH ASIAN & WORLD SPECIALTIES
  { food: "Roti / Chapati", serving: "1 standard roti/chapati", calories: 85, protein: 3.1, carbs: 17, fats: 0.6 },
  { food: "Paneer Tikka", serving: "1 plate (5 pieces / 150g)", calories: 280, protein: 18, carbs: 6, fats: 20 },
  { food: "Dal Tadka", serving: "1 bowl", calories: 150, protein: 7, carbs: 20, fats: 4.5 },
  { food: "Idli", serving: "1 plate (2 units)", calories: 116, protein: 4.2, carbs: 24, fats: 0.4 },
  { food: "Masala Dosa", serving: "1 unit / serve", calories: 287, protein: 6, carbs: 45, fats: 9 },
  { food: "Mixed Vegetable Sabji", serving: "1 bowl", calories: 120, protein: 3, carbs: 15, fats: 6 },
  { food: "Samosa", serving: "1 unit", calories: 250, protein: 4, carbs: 32, fats: 12 },
  { food: "Butter Chicken / Murgh Makhani", serving: "1 bowl (180g)", calories: 360, protein: 24, carbs: 12, fats: 24 },
  { food: "Chicken Biryani", serving: "1 plate (350g)", calories: 548, protein: 26, carbs: 65, fats: 18 },
  { food: "Palak Paneer", serving: "1 bowl (185g)", calories: 240, protein: 12, carbs: 9, fats: 18 },
  { food: "Falafel", serving: "3 pieces", calories: 165, protein: 7, carbs: 18, fats: 9 },
  { food: "Pizza (Cheese Slice)", serving: "1 standard slice", calories: 275, protein: 12, carbs: 32, fats: 10 },
  { food: "Beef Hamburger", serving: "1 burger with bun", calories: 354, protein: 20, carbs: 30, fats: 17 },

  // SNACKS, SUPPLEMENTS & TREATS
  { food: "Whey Protein Shake", serving: "1 scoop (35g)", calories: 140, protein: 24, carbs: 3, fats: 1.5 },
  { food: "Protein Bar", serving: "1 bar (60g)", calories: 210, protein: 20, carbs: 18, fats: 7 },
  { food: "Dark Chocolate (70% Cacao)", serving: "3 squares (30g)", calories: 170, protein: 2, carbs: 15, fats: 12 },
  { food: "Potato Chips", serving: "1 small bag (30g)", calories: 152, protein: 2, carbs: 15, fats: 10 },
  { food: "Popcorn (Air-Popped)", serving: "2 cups", calories: 62, protein: 2, carbs: 12, fats: 0.7 },
  { food: "Chocolate Chip Cookie", serving: "1 cookie (average)", calories: 130, protein: 1.5, carbs: 18, fats: 6 }
];

let loggedMeals: Meal[] = [...starterMeals];
let currentGoals: Goals = { ...defaultGoals };

interface HealthHabit {
  id: string;
  name: string;
  completedDates: string[]; // YYYY-MM-DD
  isCustom: boolean;
}

interface SleepRecord {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  hours: number;
  quality: "Good" | "Average" | "Poor";
}

function getDateString(daysOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toISOString().split("T")[0];
}

let healthHabits: HealthHabit[] = [
  { id: "habit-1", name: "Drink 3L Hydration", completedDates: [getDateString(0), getDateString(1), getDateString(2), getDateString(3), getDateString(5)], isCustom: false },
  { id: "habit-2", name: "Exercise Workout", completedDates: [getDateString(1), getDateString(2), getDateString(4), getDateString(5)], isCustom: false },
  { id: "habit-3", name: "Mindful Meditation", completedDates: [getDateString(1), getDateString(3), getDateString(5)], isCustom: false },
  { id: "habit-4", name: "Sleep by 11 PM", completedDates: [getDateString(0), getDateString(1), getDateString(2), getDateString(4)], isCustom: false },
  { id: "habit-5", name: "Read 15 Mins", completedDates: [getDateString(2), getDateString(3), getDateString(6)], isCustom: false }
];

let sleepLogs: SleepRecord[] = [
  { id: "sleep-1", date: getDateString(1), sleepTime: "23:00", wakeTime: "07:00", hours: 8, quality: "Good" },
  { id: "sleep-2", date: getDateString(2), sleepTime: "22:30", wakeTime: "06:45", hours: 8.25, quality: "Good" },
  { id: "sleep-3", date: getDateString(3), sleepTime: "23:45", wakeTime: "06:15", hours: 6.5, quality: "Poor" },
  { id: "sleep-4", date: getDateString(4), sleepTime: "23:15", wakeTime: "06:45", hours: 7.5, quality: "Average" },
  { id: "sleep-5", date: getDateString(5), sleepTime: "22:00", wakeTime: "06:30", hours: 8.5, quality: "Good" },
  { id: "sleep-6", date: getDateString(6), sleepTime: "23:30", wakeTime: "06:30", hours: 7, quality: "Average" },
  { id: "sleep-7", date: getDateString(7), sleepTime: "00:15", wakeTime: "06:15", hours: 6, quality: "Poor" }
];

interface MatchingFood {
  food: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

function getSmartOfflineEstimate(query: string): MatchingFood {
  const norm = query.toLowerCase().trim();
  
  // High protein sources
  if (norm.includes("chicken") || norm.includes("meat") || norm.includes("beef") || 
      norm.includes("steak") || norm.includes("pork") || norm.includes("turkey") || 
      norm.includes("salmon") || norm.includes("tuna") || norm.includes("shrimp") || 
      norm.includes("fish") || norm.includes("egg") || norm.includes("paneer") || 
      norm.includes("lamb") || norm.includes("protein bar") || norm.includes("whey") ||
      norm.includes("shake") || norm.includes("tofu") || norm.includes("tempeh") ||
      norm.includes("lentils") || norm.includes("beans")) {
    
    let foodName = query.charAt(0).toUpperCase() + query.slice(1);
    if (!foodName.toLowerCase().includes("match") && !foodName.toLowerCase().includes("estimate")) {
      foodName += " (Offline Match)";
    }
    return {
      food: foodName,
      serving: "1 portion (150g)",
      calories: 220,
      protein: 26,
      carbs: 2,
      fats: 10
    };
  }
  
  // High carb sources
  if (norm.includes("rice") || norm.includes("roti") || norm.includes("chapati") || 
      norm.includes("bread") || norm.includes("toast") || norm.includes("wheat") || 
      norm.includes("oats") || norm.includes("oatmeal") || norm.includes("potato") || 
      norm.includes("banana") || norm.includes("apple") || norm.includes("mango") || 
      norm.includes("orange") || norm.includes("fruit") || norm.includes("pasta") || 
      norm.includes("noodle") || norm.includes("pancake") || norm.includes("cookie") ||
      norm.includes("dosa") || norm.includes("idli") || norm.includes("samosa") ||
      norm.includes("pizza") || norm.includes("burger")) {
    
    let foodName = query.charAt(0).toUpperCase() + query.slice(1);
    if (!foodName.toLowerCase().includes("match") && !foodName.toLowerCase().includes("estimate")) {
      foodName += " (Offline Match)";
    }
    return {
      food: foodName,
      serving: "1 serving",
      calories: 180,
      protein: 4,
      carbs: 38,
      fats: 1.5
    };
  }

  // Low cal / veggies
  if (norm.includes("salad") || norm.includes("broccoli") || norm.includes("spinach") || 
      norm.includes("veggie") || norm.includes("vegetable") || norm.includes("carrot") || 
      norm.includes("cucumber") || norm.includes("tomato") || norm.includes("cabbage") || 
      norm.includes("asparagus") || norm.includes("cauliflower") || norm.includes("green")) {
    
    let foodName = query.charAt(0).toUpperCase() + query.slice(1);
    if (!foodName.toLowerCase().includes("match") && !foodName.toLowerCase().includes("estimate")) {
      foodName += " (Offline Match)";
    }
    return {
      food: foodName,
      serving: "1 cup / bowl",
      calories: 35,
      protein: 1.8,
      carbs: 6,
      fats: 0.3
    };
  }

  // Fats / Nuts / Seeds
  if (norm.includes("butter") || norm.includes("oil") || norm.includes("cheese") || 
      norm.includes("avocado") || norm.includes("almond") || norm.includes("nut") || 
      norm.includes("seed") || norm.includes("walnut") || norm.includes("cashew") || 
      norm.includes("peanut") || norm.includes("chia") || norm.includes("flax")) {
    
    let foodName = query.charAt(0).toUpperCase() + query.slice(1);
    if (!foodName.toLowerCase().includes("match") && !foodName.toLowerCase().includes("estimate")) {
      foodName += " (Offline Match)";
    }
    return {
      food: foodName,
      serving: "1 tablespoon / handful",
      calories: 120,
      protein: 2.2,
      carbs: 3.5,
      fats: 11
    };
  }

  // General default fallback
  let foodName = query.charAt(0).toUpperCase() + query.slice(1);
  if (!foodName.toLowerCase().includes("match") && !foodName.toLowerCase().includes("estimate")) {
    foodName += " (Offline Match)";
  }
  return {
    food: foodName,
    serving: "1 serving (100g)",
    calories: 110,
    protein: 4.5,
    carbs: 15,
    fats: 3
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // CORS middleware for cross-origin requests from Vercel deployments
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "zenith-fitness-backend",
      timestamp: new Date().toISOString(),
      geminiConfigured: !!process.env.GEMINI_API_KEY
    });
  });

  // GET /api/food/search - Food lookup database & AI search
  app.get("/api/food/search", async (req, res) => {
    try {
      const query = req.query.q ? String(req.query.q).toLowerCase().trim() : "";
      if (!query) {
        return res.json([]);
      }

      // 1. Smart local keyword filtering & scoring
      const queryWords = query.split(/[\s,.\-\/()]+/).filter(w => w.length > 1);
      
      const localMatches = foodDatabase.map(item => {
        const nameLower = item.food.toLowerCase();
        let score = 0;
        
        if (nameLower === query) {
          score += 200; // Exact match
        } else if (nameLower.startsWith(query)) {
          score += 150; // Starts with
        } else if (nameLower.includes(query)) {
          score += 100; // Direct substring
        }
        
        let wordsMatched = 0;
        for (const word of queryWords) {
          if (nameLower.includes(word)) {
            score += 30;
            wordsMatched++;
          }
        }
        
        // Sequence/co-occurrence bonus
        if (queryWords.length > 1) {
          const allMatched = queryWords.every(word => nameLower.includes(word));
          if (allMatched) {
            score += 50;
          }
        }
        
        return { item, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(m => m.item);

      // If we find strong offline keyword matches, return them immediately to minimize API load
      if (localMatches.length > 0) {
        return res.json(localMatches.slice(0, 5));
      }

      // 2. Delegate to Gemini API if key is present
      const hasGemini = !!process.env.GEMINI_API_KEY;
      if (hasGemini) {
        try {
          const client = getGeminiClient();
          if (client) {
            const systemInstruction = `You are a precise nutrition database bot. Given a food name query, return standard nutritional information. If the food doesn't exist, generate standard nutritional estimates. CRITICAL Portion and Unit Behavior: For foods that are discrete items eaten in units/portions (such as breads like chapati/roti/tortilla, eggs, fruit like banana/apple/mango, slices, bowls of dal/sabji/soup, etc.), DO NOT use '100g' as the serving size. Instead, use natural human-friendly servings like '1 standard unit', '1 bowl', '1 plate', '1 slice', '1 cup', '1 glass', or '1 piece'. Provide the nutritional values corresponding exactly to that single unit/bowl/piece. Only use grams or weight measurement if the food item is naturally measured by weight (like nuts raw or uncooked beef). Your response format MUST be a valid JSON array of objects representing matching foods. Each object must have these exactly typed fields: "food" (string), "serving" (string), "calories" (number), "protein" (number), "carbs" (number), "fats" (number). Keep estimates precise and realistic. Max 3 matching options.`;

            const response = await client.models.generateContent({
              model: "gemini-2.5-flash",
              contents: `Return nutrition details for food query matching: "${query}"`,
              config: {
                systemInstruction,
                temperature: 0.1,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      food: { type: Type.STRING, description: "Food item name with capitalized words" },
                      serving: { type: Type.STRING, description: "Typical standard single serving size e.g. 100g, 1 piece" },
                      calories: { type: Type.INTEGER, description: "Calories per serving in kcal" },
                      protein: { type: Type.NUMBER, description: "Protein in grams per serving" },
                      carbs: { type: Type.NUMBER, description: "Carbohydrates in grams per serving" },
                      fats: { type: Type.NUMBER, description: "Fats in grams per serving" }
                    },
                    required: ["food", "serving", "calories", "protein", "carbs", "fats"]
                  }
                }
              }
            });

            const responseText = response.text?.trim() || "[]";
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return res.json(parsed);
            }
          }
        } catch (apiErr: any) {
          console.warn("Gemini query is rate-limited or exhausted (429). Switching to offline estimation engine:", apiErr.message || apiErr);
        }
      }

      // 3. Fallback smart estimate if AI is rate-limited or offline
      return res.json([getSmartOfflineEstimate(query)]);
    } catch (err: any) {
      console.warn("Silent Food Search error handler fallback triggered:", err.message || err);
      return res.json([getSmartOfflineEstimate(String(req.query.q || "Unknown Item"))]);
    }
  });

  // GET /api/meals - Return logged meals
  app.get("/api/meals", (req, res) => {
    res.json(loggedMeals);
  });

  // POST /api/meals - Add new meal log
  app.post("/api/meals", (req, res) => {
    const { meal, food, serving, calories, protein, carbs, fats } = req.body;
    if (!meal || !food || isNaN(calories)) {
      return res.status(400).json({ error: "Invalid meal data inputs" });
    }
    const newMeal: Meal = {
      id: "meal_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      meal: String(meal),
      food: String(food),
      serving: String(serving || "1 serving"),
      calories: Number(calories),
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fats: Number(fats || 0)
    };
    loggedMeals = [newMeal, ...loggedMeals];
    res.status(201).json(newMeal);
  });

  // DELETE /api/meals/:id - Remove a meal
  app.delete("/api/meals/:id", (req, res) => {
    const { id } = req.params;
    const initialLength = loggedMeals.length;
    loggedMeals = loggedMeals.filter((m) => m.id !== id);
    if (loggedMeals.length === initialLength) {
      return res.status(404).json({ error: "Meal log not found" });
    }
    res.json({ success: true, message: "Meal removed from daily timeline" });
  });

  // POST /api/meals/reset - Reset to default starter meals
  app.post("/api/meals/reset", (req, res) => {
    loggedMeals = [...starterMeals];
    res.json(loggedMeals);
  });

  // GET /api/goals - Fetch targets
  app.get("/api/goals", (req, res) => {
    res.json(currentGoals);
  });

  // POST /api/goals - Update target goals
  app.post("/api/goals", (req, res) => {
    const { calories, protein, carbs, fats } = req.body;
    if (isNaN(calories) || isNaN(protein) || isNaN(carbs) || isNaN(fats)) {
      return res.status(400).json({ error: "Invalid target values" });
    }
    currentGoals = {
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats)
    };
    res.json(currentGoals);
  });

  // ============================================
  // UNIFIED HEALTH TRACKING SYSTEM ENDPOINTS
  // ============================================

  // GET /api/health/habits - Fetch habits list
  app.get("/api/health/habits", (req, res) => {
    res.json(healthHabits);
  });

  // POST /api/health/habits - Create a custom habit
  app.post("/api/health/habits", (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Habit name is required." });
    }
    const newHabit: HealthHabit = {
      id: "habit_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name.trim(),
      completedDates: [],
      isCustom: true
    };
    healthHabits.push(newHabit);
    res.status(201).json(newHabit);
  });

  // POST /api/health/habits/toggle - Completed date toggler
  app.post("/api/health/habits/toggle", (req, res) => {
    const { habitId, date } = req.body;
    if (!habitId || !date) {
      return res.status(400).json({ error: "habitId and date are required." });
    }
    const habit = healthHabits.find(h => h.id === habitId);
    if (!habit) {
      return res.status(404).json({ error: "Habit not found." });
    }
    const index = habit.completedDates.indexOf(date);
    if (index >= 0) {
      habit.completedDates.splice(index, 1);
    } else {
      habit.completedDates.push(date);
    }
    res.json(habit);
  });

  // DELETE /api/health/habits/:id - Remove custom habit
  app.delete("/api/health/habits/:id", (req, res) => {
    const { id } = req.params;
    const exists = healthHabits.find(h => h.id === id);
    if (!exists) {
      return res.status(404).json({ error: "Habit not found" });
    }
    healthHabits = healthHabits.filter(h => h.id !== id);
    res.json({ success: true, message: "Habit deleted" });
  });

  // GET /api/health/sleep - Fetch sleep records
  app.get("/api/health/sleep", (req, res) => {
    res.json(sleepLogs);
  });

  // POST /api/health/sleep - Upsert sleep log
  app.post("/api/health/sleep", (req, res) => {
    const { date, sleepTime, wakeTime, hours, quality } = req.body;
    if (!date || !sleepTime || !wakeTime || isNaN(hours) || !quality) {
      return res.status(400).json({ error: "All sleep validation inputs are required." });
    }

    const existingIndex = sleepLogs.findIndex(s => s.date === date);
    const sleepRecord: SleepRecord = {
      id: existingIndex >= 0 ? sleepLogs[existingIndex].id : "sleep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      date,
      sleepTime,
      wakeTime,
      hours: Number(hours),
      quality
    };

    if (existingIndex >= 0) {
      sleepLogs[existingIndex] = sleepRecord;
    } else {
      sleepLogs.push(sleepRecord);
    }
    // Sort descending by date
    sleepLogs.sort((a, b) => b.date.localeCompare(a.date));
    res.status(201).json(sleepRecord);
  });

  // DELETE /api/health/sleep/:id - Delete sleep log record
  app.delete("/api/health/sleep/:id", (req, res) => {
    const { id } = req.params;
    sleepLogs = sleepLogs.filter(s => s.id !== id);
    res.json({ success: true, message: "Sleep log record deleted" });
  });

  // POST /api/health/insights - Fetch Combined Smart Health Insights (Accepts client-provided user data)
  app.post("/api/health/insights", async (req, res) => {
    try {
      const clientHabits = req.body.habits || healthHabits;
      const clientSleepLogs = req.body.sleepLogs || sleepLogs;

      const recentSleeps = [...clientSleepLogs].sort((a, b: any) => b.date.localeCompare(a.date));
      const avgSleep = recentSleeps.length > 0 
        ? recentSleeps.reduce((acc, c) => acc + c.hours, 0) / recentSleeps.length
        : 0;
      
      const goodCount = recentSleeps.filter(s => s.quality === "Good").length;

      // Habit success rates
      const totalHabits = clientHabits.length;
      let habitCompletionPercentage = 0;
      if (totalHabits > 0) {
        let totalCompletions = 0;
        for (let i = 0; i < 7; i++) {
          const checkDate = getDateString(i);
          clientHabits.forEach((h: any) => {
            if (h.completedDates && h.completedDates.includes(checkDate)) {
              totalCompletions++;
            }
          });
        }
        habitCompletionPercentage = Math.round((totalCompletions / (7 * totalHabits)) * 100);
      }

      const sleepDurationScore = Math.max(0, 100 - Math.abs(avgSleep - 8) * 18);
      const sleepQualityScore = recentSleeps.length > 0 ? (goodCount / recentSleeps.length) * 100 : 0;
      const finalSleepScore = recentSleeps.length > 0 ? (sleepDurationScore * 0.6 + sleepQualityScore * 0.4) : 0;
      
      const wellnessScore = Math.max(10, Math.min(100, Math.round((habitCompletionPercentage * 0.55) + (finalSleepScore || 70) * 0.45)));

      // Call Gemini if key is present
      const hasGemini = !!process.env.GEMINI_API_KEY;
      if (hasGemini) {
        try {
          const client = getGeminiClient();
          if (client) {
            const habitsContext = clientHabits.map((h: any) => `- Habit name: "${h.name}" completed ${h.completedDates?.length || 0} times recently`).join("\n");
            const sleepContext = recentSleeps.slice(0, 7).map((s: any) => `- Date ${s.date}: Slept ${s.hours} hours (Quality: "${s.quality}")`).join("\n");

            const promptText = `Provide exactly three actionable, professional, motivating health and sports-science insights based on:
Wellness score: ${wellnessScore}%
Habits stats:
${habitsContext}

Recent sleep history:
${sleepContext}

Identify any synergies (e.g. daily exercise leading to Good quality sleep reports, hydration status, keeping standard wake cycles, or below 7 hrs of resting time limits).

Requirements:
- Response MUST be a valid JSON array of strings: ["insight 1", "insight 2", "insight 3"]
- Keep each insight brief (under 18 words).
- DO NOT return markup, markdown block, backticks, or any outer text. Just pure string list JSON.`;

            const response = await client.models.generateContent({
              model: "gemini-2.5-flash",
              contents: promptText,
              config: {
                temperature: 0.6,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            });

            const rawText = response.text?.trim() || "[]";
            const list = JSON.parse(rawText);
            if (Array.isArray(list) && list.length > 0) {
              return res.json({
                insights: list,
                wellnessScore
              });
            }
          }
        } catch (apiErr: any) {
          console.warn("Gemini health insights POST rate-limited or exhausted (429). Proceeding with offline wellness advice generator:", apiErr.message || apiErr);
        }
      }

      // Offline rules engine as a fallback option
      const insights = [
        "Your hydration logging is improving! Keeping water levels high assists neural detox and deeper REM stages.",
        avgSleep < 7.2 
          ? `Average sleep duration (${avgSleep.toFixed(1)} hrs) is below the 7-9hr target. Consider an alarm-off wind-down.`
          : "Exceptional consistency in your night schedules to maximize muscular recovery.",
        goodCount / (recentSleeps.length || 1) < 0.5 
          ? "Deep rest score suggests light levels are high at night. Try setting a bedroom cold point."
          : "High-quality rest records confirmed! Your body's tissue rebuilding pathways are deeply active."
      ];

      res.json({
        insights,
        wellnessScore
      });
    } catch (error) {
      console.warn("Generating mock insight reports fallback:", error);
      res.json({
        insights: [
          "Synergize hydration levels with daily targets to support muscular oxygenation.",
          "Target 7.5+ hours of sleep on strenuous workout days to lower average heartbeat logs."
        ],
        wellnessScore: 82
      });
    }
  });

  // GET /api/health/insights - Fetch Combined Smart Health Insights and wellness scores (Compatibility fallback)
  app.get("/api/health/insights", async (req, res) => {
    try {
      const recentSleeps = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date));
      const avgSleep = recentSleeps.length > 0 
        ? recentSleeps.reduce((acc, c) => acc + c.hours, 0) / recentSleeps.length
        : 0;
      
      const goodCount = recentSleeps.filter(s => s.quality === "Good").length;

      // Habit success rates
      const totalHabits = healthHabits.length;
      let habitCompletionPercentage = 0;
      if (totalHabits > 0) {
        let totalCompletions = 0;
        for (let i = 0; i < 7; i++) {
          const checkDate = getDateString(i);
          healthHabits.forEach(h => {
            if (h.completedDates.includes(checkDate)) {
              totalCompletions++;
            }
          });
        }
        habitCompletionPercentage = Math.round((totalCompletions / (7 * totalHabits)) * 100);
      }

      const sleepDurationScore = Math.max(0, 100 - Math.abs(avgSleep - 8) * 18);
      const sleepQualityScore = recentSleeps.length > 0 ? (goodCount / recentSleeps.length) * 100 : 0;
      const finalSleepScore = recentSleeps.length > 0 ? (sleepDurationScore * 0.6 + sleepQualityScore * 0.4) : 0;
      
      const wellnessScore = Math.max(10, Math.min(100, Math.round((habitCompletionPercentage * 0.55) + (finalSleepScore || 70) * 0.45)));

      // Call Gemini if key is present
      const hasGemini = !!process.env.GEMINI_API_KEY;
      if (hasGemini) {
        try {
          const client = getGeminiClient();
          if (client) {
            const habitsContext = healthHabits.map(h => `- Habit name: "${h.name}" completed ${h.completedDates.length} times recently`).join("\n");
            const sleepContext = recentSleeps.slice(0, 7).map(s => `- Date ${s.date}: Slept ${s.hours} hours (Quality: "${s.quality}")`).join("\n");

            const promptText = `Provide exactly three actionable, professional, motivating health and sports-science insights based on:
Wellness score: ${wellnessScore}%
Habits stats:
${habitsContext}

Recent sleep history:
${sleepContext}

Identify any synergies (e.g. daily exercise leading to Good quality sleep reports, hydration status, keeping standard wake cycles, or below 7 hrs of resting time limits).

Requirements:
- Response MUST be a valid JSON array of strings: ["insight 1", "insight 2", "insight 3"]
- Keep each insight brief (under 18 words).
- DO NOT return markup, markdown block, backticks, or any outer text. Just pure string list JSON.`;

            const response = await client.models.generateContent({
              model: "gemini-3.5-flash",
              contents: promptText,
              config: {
                temperature: 0.6,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            });

            const rawText = response.text?.trim() || "[]";
            const list = JSON.parse(rawText);
            if (Array.isArray(list) && list.length > 0) {
              return res.json({
                insights: list,
                wellnessScore
              });
            }
          }
        } catch (apiErr: any) {
          console.warn("Gemini health insights GET rate-limited or exhausted (429). Proceeding with offline wellness advice generator:", apiErr.message || apiErr);
        }
      }

      // Offline rules engine as a fallback option
      const insights = [
        "Your hydration logging is improving! Keeping water levels high assists neural detox and deeper REM stages.",
        avgSleep < 7.2 
          ? `Average sleep duration (${avgSleep.toFixed(1)} hrs) is below the 7-9hr target. Consider an alarm-off wind-down.`
          : "Exceptional consistency in your night schedules to maximize muscular recovery.",
        goodCount / (recentSleeps.length || 1) < 0.5 
          ? "Deep rest score suggests light levels are high at night. Try setting a bedroom cold point."
          : "High-quality rest records confirmed! Your body's tissue rebuilding pathways are deeply active."
      ];

      res.json({
        insights,
        wellnessScore
      });
    } catch (error) {
      console.warn("Generating mock insight reports fallback:", error);
      res.json({
        insights: [
          "Synergize hydration levels with daily targets to support muscular oxygenation.",
          "Target 7.5+ hours of sleep on strenuous workout days to lower average heartbeat logs."
        ],
        wellnessScore: 82
      });
    }
  });

  // POST /api/assistant/ask - Chat Nutrition Specialist (Gemini API) (Supports user-specific client datasets)
  app.post("/api/assistant/ask", async (req, res) => {
    try {
      const { message, history, meals, goals } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const activeMeals = meals || loggedMeals;
      const activeGoals = goals || currentGoals;

      // Check key integration
      const apiKeyExists = !!process.env.GEMINI_API_KEY;
      const client = apiKeyExists ? getGeminiClient() : null;

      // Compose meal logs summary
      const mealsSummary = activeMeals
        .map(
          (m: any) =>
            `- [${m.meal}] ${m.food} (${m.serving}): ${m.calories} kcal (P: ${m.protein}g, C: ${m.carbs}g, F: ${m.fats}g)`
        )
        .join("\n");

      // Calculate state metrics
      const totals = activeMeals.reduce(
        (acc: any, item: any) => {
          acc.calories += item.calories;
          acc.protein += item.protein;
          acc.carbs += item.carbs;
          acc.fats += item.fats;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );

      const systemInstruction = `You are a supportive, high-energy nutrition coach and diet analyst. 
The user is tracking their daily macros.

Current Target macro goals:
- Calories limit: ${activeGoals.calories} kcal
- Protein goal: ${activeGoals.protein}g
- Carbs goal: ${activeGoals.carbs}g
- Fats goal: ${activeGoals.fats}g

Current Today's Logged Meals:
${mealsSummary || "No meals have been logged yet today."}

Current Totals Logged:
- Calories: ${totals.calories} kcal (${Math.round((totals.calories / activeGoals.calories) * 100)}% of goal)
- Protein: ${totals.protein}g / ${activeGoals.protein}g
- Carbs: ${totals.carbs}g / ${activeGoals.carbs}g
- Fats: ${totals.fats}g / ${activeGoals.fats}g

Guidelines:
1. Provide highly practical, supportive, and conversational responses.
2. Rely strictly on scientific evidence-based nutritional guidelines.
3. Be concise and scannable. Use clear bullet points if giving dietary advice.
4. If asked what to eat next, suggest foods that fill their current remaining macros (e.g. if they are low on protein, recommend Greek yogurt, egg white omelet, chicken breast).
5. Address the user directly. Keep answers under 170 words.`;

      // Build chat prompt including recent history if any
      const formattedHistory = (history || [])
        .map((msg: any) => `${msg.role === "user" ? "User" : "Coach"}: ${msg.content}`)
        .join("\n\n");

      const prompt = `${formattedHistory ? "Previous Conversation History:\n" + formattedHistory + "\n\n" : ""}User asks: "${message}"`;

      let coachResponse = "";
      if (client) {
        try {
          const response = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.7
            }
          });
          coachResponse = response.text || "";
        } catch (apiErr: any) {
          console.warn("Gemini chat coach rate-limited or exhausted (429). Generating helpful offline smart recommendations directly:", apiErr.message || apiErr);
        }
      }

      if (!coachResponse) {
        const calLeft = activeGoals.calories - totals.calories;
        const proteinLeft = activeGoals.protein - totals.protein;
        const carbsLeft = activeGoals.carbs - totals.carbs;
        const fatsLeft = activeGoals.fats - totals.fats;

        coachResponse = `Based on your logs today, you've consumed **${totals.calories} kcal** out of **${activeGoals.calories} kcal** target:\n`;
        coachResponse += `- **Protein**: ${totals.protein}g logged / ${activeGoals.protein}g goal (${proteinLeft > 0 ? `${proteinLeft}g remaining` : "Goal achieved!"})\n`;
        coachResponse += `- **Carbs**: ${totals.carbs}g logged / ${activeGoals.carbs}g goal (${carbsLeft > 0 ? `${carbsLeft}g remaining` : "Goal achieved!"})\n`;
        coachResponse += `- **Fats**: ${totals.fats}g logged / ${activeGoals.fats}g goal (${fatsLeft > 0 ? `${fatsLeft}g remaining` : "Goal achieved!"})\n\n`;
        
        coachResponse += "💡 **Nutritional Recommendations for You:**\n";
        if (proteinLeft > 15) {
          coachResponse += `• **High-Protein Options**: Try grilled chicken breast (150g ~ 46g P), egg whites with 1 yolk, 0% Greek yogurt, or a whey protein shake to fill the remaining ${proteinLeft}g protein.\n`;
        } else {
          coachResponse += "• **Protein Goal Satisfied**: Excellent job hitting your baseline protein needs! Focus on micronutrients and fiber.\n";
        }
        
        if (calLeft > 300) {
          coachResponse += `• **Energy Balance**: You have **${calLeft} kcal** remaining today. Adding a balanced portion of oats, brown rice, sweet potato, or raw almonds will comfortably fuel your daily output.\n`;
        } else if (calLeft < 0) {
          coachResponse += `• **Energy Balance**: You are currently over your calorie goal by ${Math.abs(calLeft)} kcal. Hydrate well and maintain light active walking.\n`;
        } else {
          coachResponse += "• **Energy Balance**: You are right on target for your calorie goal today! Outstanding calibration.\n";
        }
      }

      res.json({
        response: coachResponse || "I was unable to formulate a nutrition suggestion. Please check your meals data.",
        isConfigured: apiKeyExists
      });
    } catch (err: any) {
      console.error("Gemini Request Error:", err);
      res.status(500).json({ error: "Nutrition assistant had a digestion error: " + err.message });
    }
  });

  // Vite development vs production asset execution
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Fullstack Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
