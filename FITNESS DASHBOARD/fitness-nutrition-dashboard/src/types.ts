export interface Meal {
  id: string;
  meal: string; // "Breakfast" | "Lunch" | "Snack" | "Dinner"
  food: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  createdAt?: string;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Habit {
  id: string;
  name: string;
  completedDates: string[]; // YYYY-MM-DD
  isCustom: boolean;
}

export interface SleepRecord {
  id: string;
  date: string; // YYYY-MM-DD
  sleepTime: string;
  wakeTime: string;
  hours: number;
  quality: "Good" | "Average" | "Poor";
}

export interface HealthInsights {
  insights: string[];
  wellnessScore: number; // 0 - 100
}

