import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Flame,
  Sparkles,
  RotateCcw,
  Check,
  Loader2,
  Apple,
  Dumbbell,
  Target,
  Calculator,
  Sparkle,
  UtensilsCrossed,
  Info,
  Activity,
  Heart,
  Brain,
  Moon,
  Clock,
  TrendingUp,
  Award
} from "lucide-react";

import { Meal, MacroTargets, Habit, SleepRecord } from "./types";
import { Sidebar } from "./components/Sidebar";
import { MealRhythmChart, WellnessWaveChart } from "./components/Charts";
import { MacroGauge } from "./components/MacroGauge";
import { NutritionAssistant } from "./components/NutritionAssistant";
import { CalorieCalculatorModal } from "./components/CalorieCalculatorModal";
import { HealthTracking } from "./components/HealthTracking";

// Firebase Integration
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, writeBatch, query, orderBy } from "firebase/firestore";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingFlow } from "./components/OnboardingFlow";

const QUICK_FOOD_Shortcuts = [
  { label: "🫓 Chapati", food: "Roti / Chapati", serving: "1 standard roti/chapati", calories: 85, protein: 3.1, carbs: 17, fats: 0.6 },
  { label: "🥣 Dal Tadka", food: "Dal Tadka", serving: "1 bowl", calories: 150, protein: 7, carbs: 20, fats: 4.5 },
  { label: "🍚 White Rice", food: "White Rice (Cooked)", serving: "1 bowl (approx 150g)", calories: 195, protein: 4, carbs: 43, fats: 0.4 },
  { label: "🥚 Whole Egg", food: "Whole Egg (Large)", serving: "1 egg", calories: 70, protein: 6, carbs: 0.6, fats: 5 },
  { label: "🍌 Banana", food: "Banana", serving: "1 medium", calories: 105, protein: 1.3, carbs: 27, fats: 0.3 },
  { label: "🥛 Milk", food: "Whole Milk", serving: "1 glass (240ml)", calories: 149, protein: 8, carbs: 12, fats: 8 },
  { label: "🍗 Chicken Breast", food: "Chicken Breast", serving: "1 piece (150g)", calories: 250, protein: 46.5, carbs: 0, fats: 5.4 },
  { label: "🥪 Avocado Toast", food: "Avocado Toast", serving: "1 slice", calories: 230, protein: 6, carbs: 24, fats: 12 },
  { label: "🥣 Oats Bowl", food: "Oatmeal (Cooked with Water)", serving: "1 bowl", calories: 150, protein: 5, carbs: 27, fats: 2.5 }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [goals, setGoals] = useState<MacroTargets>({
    calories: 2200,
    protein: 165,
    carbs: 240,
    fats: 70
  });

  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [dashboardSubTab, setDashboardSubTab] = useState<"overview" | "log" | "timeline">("overview");
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  
  // Shared health states for Dashboard widget syncing
  const [habits, setHabits] = useState<Habit[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  
  // Quick Add Meal state
  const [mealType, setMealType] = useState("Breakfast");
  const [foodName, setFoodName] = useState("");
  const [servingSize, setServingSize] = useState("");
  const [calories, setCalories] = useState<number | "">("");
  const [protein, setProtein] = useState<number | "">("");
  const [carbs, setCarbs] = useState<number | "">("");
  const [fats, setFats] = useState<number | "">("");

  // Portion/Unit Scaling State Trackers
  const [originalFoodItem, setOriginalFoodItem] = useState<{
    food: string;
    serving: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>("bowl");
  const [selectedQuantity, setSelectedQuantity] = useState<number | "">(1);

  // 1.4 Calculate highly interactive suggestions from user's historical database
  const userFrequentFoods = React.useMemo(() => {
    if (!meals || meals.length === 0) return [];
    
    // Count exact frequency of each unique food name
    const counts: Record<string, { count: number; nameStr: string; lastSeen: number; item: Meal }> = {};
    
    meals.forEach((m, index) => {
      if (!m.food) return;
      const key = m.food.toLowerCase().trim();
      const timestamp = m.createdAt ? new Date(m.createdAt).getTime() : (meals.length - index);
      
      if (!counts[key]) {
        counts[key] = {
          count: 1,
          nameStr: m.food,
          lastSeen: timestamp,
          item: m
        };
      } else {
        counts[key].count += 1;
        if (timestamp > counts[key].lastSeen) {
          counts[key].lastSeen = timestamp;
          counts[key].item = m; // update to keep latest serving size/macros
        }
      }
    });

    // Sort by count (frequency) descending, and then by lastSeen (recency) descending
    return Object.values(counts)
      .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
      .slice(0, 4); // Limit to top 4 for perfect layout styling
  }, [meals]);
  
  // Analytics calculators for habits and sleep
  const habitsAnalytics = React.useMemo(() => {
    if (!habits || habits.length === 0) return null;

    const streakCalculator = (dates: string[]) => {
      if (!dates || dates.length === 0) return 0;
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let streak = 0;
      let offset = 0;

      const hasToday = dates.includes(todayStr);
      const hasYesterday = dates.includes(yesterdayStr);

      if (!hasToday && !hasYesterday) return 0;
      offset = hasToday ? 0 : 1;

      while (true) {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        const dateStr = d.toISOString().split("T")[0];
        if (dates.includes(dateStr)) {
          streak++;
          offset++;
        } else {
          break;
        }
        if (offset > 100) break; // safety
      }
      return streak;
    };

    const habitsWithStreaks = habits.map(h => ({
      ...h,
      streak: streakCalculator(h.completedDates),
      completionCount: h.completedDates.length
    }));

    const totalCompletions = habits.reduce((sum, h) => sum + h.completedDates.length, 0);
    const maxStreak = Math.max(...habitsWithStreaks.map(h => h.streak), 0);

    return {
      habitsWithStreaks,
      totalCompletions,
      maxStreak,
      totalCount: habits.length
    };
  }, [habits]);

  const sleepAnalytics = React.useMemo(() => {
    if (!sleepRecords || sleepRecords.length === 0) return null;

    const totalDays = sleepRecords.length;
    const avgHrs = sleepRecords.reduce((sum, r) => sum + r.hours, 0) / totalDays;
    
    let goodCount = 0;
    let averageCount = 0;
    let poorCount = 0;

    sleepRecords.forEach(r => {
      if (r.quality === "Good") goodCount++;
      else if (r.quality === "Average") averageCount++;
      else if (r.quality === "Poor") poorCount++;
    });

    return {
      totalDays,
      avgHrs: Math.round(avgHrs * 10) / 10,
      goodCount,
      averageCount,
      poorCount,
      goodPercent: Math.round((goodCount / totalDays) * 100),
      averagePercent: Math.round((averageCount / totalDays) * 100),
      poorPercent: Math.round((poorCount / totalDays) * 100)
    };
  }, [sleepRecords]);

  const defaultWholesomeFoods = [
    { food: "Whole Egg (Boiled)", serving: "2 units (Large)", calories: 140, protein: 12, carbs: 1.2, fats: 10, meal: "Breakfast" },
    { food: "Roti with Dal bowl", serving: "1 plate", calories: 235, protein: 10.1, carbs: 37, fats: 5.1, meal: "Lunch" },
    { food: "Greek Yogurt", serving: "1 cup (150g)", calories: 120, protein: 15, carbs: 6, fats: 3, meal: "Snack" },
    { food: "Grilled Chicken Salad", serving: "1 bowl", calories: 260, protein: 32, carbs: 8, fats: 11, meal: "Dinner" },
  ];

  // Helper to parse serving text into quantity and unit
  const parseServing = (servingStr: string) => {
    const clean = (servingStr || "").trim();
    const match = clean.match(/^([\d\.]+)\s*(.*)$/);
    if (match) {
      const qty = parseFloat(match[1]);
      const unit = match[2].trim() || "serving";
      return { qty: isNaN(qty) ? 1 : qty, unit };
    }
    return { qty: 1, unit: clean || "serving" };
  };

  const handleServingChange = (qty: number | "", unit: string) => {
    setSelectedQuantity(qty);
    setSelectedUnit(unit);

    let newServing = "";
    if (qty !== "") {
      newServing = `${qty} ${unit}`;
    } else {
      newServing = unit;
    }
    setServingSize(newServing);

    // Scale macro values if there is a base food item selected!
    if (originalFoodItem && qty !== "") {
      const parsedBase = parseServing(originalFoodItem.serving);
      const ratio = Number(qty) / parsedBase.qty;
      if (!isNaN(ratio) && isFinite(ratio)) {
        setCalories(Math.round(originalFoodItem.calories * ratio));
        setProtein(Number((originalFoodItem.protein * ratio).toFixed(1)));
        setCarbs(Number((originalFoodItem.carbs * ratio).toFixed(1)));
        setFats(Number((originalFoodItem.fats * ratio).toFixed(1)));
      }
    }
  };

  // Food autocomplete search states
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Loading and user feedbacks
  const [isMealsLoading, setIsMealsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Trigger brief alert toasts
  const toast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Monitor Auth Changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to user Firestore data in real-time
  useEffect(() => {
    if (!currentUser) {
      setMeals([]);
      setHabits([]);
      setSleepRecords([]);
      return;
    }

    setIsMealsLoading(true);

    // 1. Subscribe to Meals
    const mealsQuery = query(collection(db, "users", currentUser.uid, "meals"), orderBy("createdAt", "desc"));
    const unsubMeals = onSnapshot(mealsQuery, (snapshot) => {
      const mealsData: Meal[] = [];
      snapshot.forEach((docSnap) => {
        mealsData.push({ id: docSnap.id, ...docSnap.data() } as Meal);
      });
      setMeals(mealsData);
      setIsMealsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/meals`);
      setIsMealsLoading(false);
    });

    // 2. Subscribe to Goals doc
    const goalsDocRef = doc(db, "users", currentUser.uid, "goals", "daily");
    const unsubGoals = onSnapshot(goalsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const goalsData = docSnap.data();
        setGoals({
          calories: Number(goalsData.calories || 2200),
          protein: Number(goalsData.protein || 165),
          carbs: Number(goalsData.carbs || 240),
          fats: Number(goalsData.fats || 70)
        });
        setIsOnboarded(goalsData.onboarded === true);
      } else {
        setGoals({
          calories: 2200,
          protein: 165,
          carbs: 240,
          fats: 70
        });
        setIsOnboarded(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}/goals/daily`);
      setIsOnboarded(false);
    });

    // 3. Subscribe to Habits for Dashboard quick count syncing
    const habitsCol = collection(db, "users", currentUser.uid, "habits");
    const unsubHabits = onSnapshot(habitsCol, (snapshot) => {
      const habitsData: Habit[] = [];
      snapshot.forEach((docSnap) => {
        habitsData.push({ id: docSnap.id, ...docSnap.data() } as Habit);
      });
      setHabits(habitsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/habits`);
    });

    // 4. Subscribe to Sleep records
    const sleepCol = collection(db, "users", currentUser.uid, "sleep");
    const unsubSleep = onSnapshot(sleepCol, (snapshot) => {
      const sleepData: SleepRecord[] = [];
      snapshot.forEach((docSnap) => {
        sleepData.push({ id: docSnap.id, ...docSnap.data() } as SleepRecord);
      });
      sleepData.sort((a,b) => b.date.localeCompare(a.date));
      setSleepRecords(sleepData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/sleep`);
    });

    return () => {
      unsubMeals();
      unsubGoals();
      unsubHabits();
      unsubSleep();
    };
  }, [currentUser]);

  // 1.5 Autocomplete database lookup for food item names
  useEffect(() => {
    if (!foodName.trim() || foodName.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(foodName)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Error searching food database", err);
      } finally {
        setIsSearching(false);
      }
    }, 450); // 450ms debounce window

    return () => clearTimeout(timer);
  }, [foodName]);

  // 2. Action: Log Meal
  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!foodName.trim() || calories === "") return;

    try {
      const mealId = `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const mealDocRef = doc(db, "users", currentUser.uid, "meals", mealId);
      
      await setDoc(mealDocRef, {
        id: mealId,
        userId: currentUser.uid,
        meal: mealType,
        food: foodName,
        serving: servingSize || "1 serving",
        calories: Number(calories),
        protein: Number(protein || 0),
        carbs: Number(carbs || 0),
        fats: Number(fats || 0),
        createdAt: new Date().toISOString()
      });

      toast(`Successfully logged ${foodName} to ${mealType}!`);

      // Reset logger fields
      setFoodName("");
      setServingSize("");
      setSelectedQuantity(1);
      setSelectedUnit("bowl");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFats("");
      setOriginalFoodItem(null);
    } catch (err) {
      console.error(err);
      toast("Failed to log food entry. Check database connection.");
    }
  };

  // 3. Action: Delete Log
  const handleDeleteMeal = async (id: string, name: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "meals", id));
      toast(`Removed "${name}" from logged entries.`);
    } catch (err) {
      console.error(err);
      toast("Failed to remove logged food.");
    }
  };

  // 4. Action: Reset to Starter Baseline
  const handleResetMeals = async () => {
    if (!currentUser) return;
    try {
      setIsRefreshing(true);
      
      // Delete old meals from user subcollection
      const mealsCol = collection(db, "users", currentUser.uid, "meals");
      const mealsSnap = await getDocs(mealsCol);
      const batch = writeBatch(db);
      
      mealsSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      const baselineMeals = [
        { id: "meal_" + Date.now() + "_1", meal: "Breakfast", food: "Greek yogurt bowl", serving: "1 bowl", calories: 380, protein: 31, carbs: 44, fats: 9 },
        { id: "meal_" + Date.now() + "_2", meal: "Lunch", food: "Chicken quinoa salad", serving: "420g", calories: 610, protein: 48, carbs: 58, fats: 18 },
        { id: "meal_" + Date.now() + "_3", meal: "Snack", food: "Banana and almonds", serving: "1 medium + 20g", calories: 235, protein: 7, carbs: 33, fats: 10 },
        { id: "meal_" + Date.now() + "_4", meal: "Dinner", food: "Salmon rice plate", serving: "1 plate", calories: 690, protein: 46, carbs: 62, fats: 27 }
      ];

      baselineMeals.forEach((meal) => {
        const mealRef = doc(db, "users", currentUser.uid, "meals", meal.id);
        batch.set(mealRef, {
          ...meal,
          userId: currentUser.uid,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast("Nutrition dashboard reset to Zenith daytime baseline meals.");
    } catch (err) {
      console.error(err);
      toast("Failed to reset values.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // 5. Action: Save Calorie & Macro Goals
  const handleSaveGoals = async (newGoals: MacroTargets) => {
    if (!currentUser) return;
    try {
      const goalsRef = doc(db, "users", currentUser.uid, "goals", "daily");
      await setDoc(goalsRef, {
        userId: currentUser.uid,
        calories: Number(newGoals.calories),
        protein: Number(newGoals.protein),
        carbs: Number(newGoals.carbs),
        fats: Number(newGoals.fats),
        updatedAt: new Date().toISOString()
      });
      toast("Nutrition parameters recalculated!");
    } catch (err) {
      console.error(err);
      toast("Failed to save goals in database.");
    }
  };

  // Calculations for dashboard indicators
  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += Number(m.calories || 0);
      acc.protein += Number(m.protein || 0);
      acc.carbs += Number(m.carbs || 0);
      acc.fats += Number(m.fats || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const totalCaloriesFormatted = new Intl.NumberFormat("en-US").format(totals.calories);
  const targetCaloriesFormatted = new Intl.NumberFormat("en-US").format(goals.calories);
  const calorieProgressPercent = Math.min((totals.calories / goals.calories) * 100, 100);
  const remainingCalories = Math.max(goals.calories - totals.calories, 0);

  // Micro macro values height weights for layout bars
  const mealCaloriesBreakdown = ["Breakfast", "Lunch", "Snack", "Dinner"].map((mType) => ({
    type: mType,
    val: meals.filter((item) => item.meal === mType).reduce((sum, item) => sum + Number(item.calories || 0), 0)
  }));
  const maxMealCaloriesVal = Math.max(...mealCaloriesBreakdown.map((b) => b.val), 1);

  // Helper template: Quick Preset add meals trigger
  const triggerQuickAddSnack = async (food: string, cal: number, p: number, c: number, f: number) => {
    if (!currentUser) return;
    try {
      const mealId = `meal_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const mealRef = doc(db, "users", currentUser.uid, "meals", mealId);
      
      await setDoc(mealRef, {
        id: mealId,
        userId: currentUser.uid,
        meal: "Snack",
        food,
        serving: "1 serving",
        calories: cal,
        protein: p,
        carbs: c,
        fats: f,
        createdAt: new Date().toISOString()
      });
      toast(`Logged Quick Snack: ${food}!`);
    } catch (err) {
      console.error(err);
    }
  };

  if (isAuthLoading || (currentUser && isOnboarded === null)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-3" />
        <p className="text-xs font-mono text-slate-400 tracking-wider">BOOTING ATHLETIC OS...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={() => {}} />;
  }

  if (isOnboarded === false) {
    return (
      <OnboardingFlow
        userId={currentUser.uid}
        onComplete={(calculatedGoals) => {
          setGoals(calculatedGoals);
          setIsOnboarded(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0e120c] font-sans text-[#f7f5ed] flex items-center justify-center p-0 md:p-6 select-none relative overflow-x-hidden">
      
      {/* Decorative Blur Ambient circles mimicking the original photo layout */}
      <div className="absolute top-[10%] left-[25%] w-[450px] h-[450px] bg-emerald-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[10%] w-[380px] h-[380px] bg-orange-950/10 rounded-full blur-[120px] pointer-events-none" />
 
      {/* Main shell layout container */}
      <main className="w-full max-w-[1140px] min-h-0 md:min-h-[820px] pb-20 md:pb-0 bg-black/80 md:rounded-3xl border border-white/[0.06] shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-[82px_1fr] md:backdrop-blur-3xl">

        {/* Desktop sidebar rails navigation */}
        <div className="bg-zinc-950/40 border-b md:border-b-0 md:border-r border-white/[0.04]">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            openGoalsModal={() => setIsGoalsModalOpen(true)}
          />
        </div>

        {/* Dashboard workspace core */}
        <section className="p-4 md:p-7 pb-24 md:pb-7 flex flex-col justify-between gap-5 relative min-w-0">
          
          {/* Top banner overlay image effect of the athletic model */}
          <div className="absolute inset-x-0 top-0 h-[115px] md:h-[260px] cursor-pointer" onClick={() => setActiveTab("coaching")}>
            {/* Soft gradient wash */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-[#0e120c] z-[2]" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80 z-[2]" />
            <div 
              className="absolute inset-0 opacity-15 saturate-75 bg-cover bg-center mix-blend-luminosity z-[1]" 
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1200&auto=format&fit=crop')" }}
            />
            {/* Aesthetic Grid lines */}
            <div 
              className="absolute inset-0 bg-transparent z-[2]"
              style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                backgroundSize: "32px 32px"
              }}
            />
          </div>
 
          {/* Topbar headers holding interactive query search */}
          <header className="flex flex-col md:flex-row justify-between items-center gap-4 relative z-10 w-full mb-4">
            
            {/* Elegant User Welcome greeting replacing the old central text-center coaching box */}
            <div className="flex flex-col text-center md:text-left py-1">
              <span className="text-[10px] font-mono tracking-widest text-[#9fdb8e] uppercase block font-semibold">PREMIUM FITNESS WORKSPACE</span>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-0.5">
                Welcome, <span className="text-orange-400">{currentUser.email?.split("@")[0] || "Athlete"}</span>
              </h1>
              <p className="text-xs text-white/50 font-medium mt-1">Ready to optimize your metabolic and fitness goals today?</p>
            </div>
 
            {/* Profile widget bar info */}
            <div className="hidden md:flex items-center gap-3 bg-zinc-900/30 py-1.5 pl-3 pr-4 rounded-full border border-white/5 backdrop-blur-md">
              <button 
                onClick={() => {
                  setMealType("Snack");
                  setFoodName("Pre-workout Banana");
                  setCalories(105);
                  setProtein(1.3);
                  setCarbs(27);
                  setFats(0.3);
                  toast("Pre-workout meal filled! Save to log.");
                }}
                className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-lg cursor-pointer transition-colors"
                title="Pre-fill workout snack preset"
              >
                +
              </button>
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" 
                alt="Account Holder Avatar" 
                className="w-9 h-9 rounded-full object-cover border border-white/20"
              />
              <div className="text-left flex flex-col justify-center">
                <strong className="text-xs font-bold text-white block">
                  {currentUser.displayName || currentUser.email?.split("@")[0] || "Zenith Athlete"}
                </strong>
                <span className="text-[9px] uppercase tracking-wider font-mono text-emerald-400">Authenticated Athlete</span>
              </div>
            </div>
          </header>

          {/* Action Toolbar elements */}
          <div className="flex flex-wrap justify-center md:justify-end items-center gap-2.5 relative z-10 w-full mb-1">
            <button 
              onClick={() => setIsGoalsModalOpen(true)}
              className="glass-button text-xs font-bold bg-[#141813] hover:bg-zinc-800 px-3 py-1.5 rounded-full border border-orange-500/20 text-orange-400 flex items-center gap-1.5 transition-all cursor-pointer hover:border-orange-500/40"
            >
              <Calculator className="w-3.5 h-3.5 animate-pulse" /> Calorie Calculator
            </button>
            <button 
              onClick={handleResetMeals}
              disabled={isRefreshing}
              className="glass-button text-xs font-medium hover:text-orange-400 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Reset dashboard"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> 
              Restore Daytime
            </button>
          </div>

          {/* Segmented Mobile select buttons to mimic native premium health apps with 1-tap selectors */}
          {activeTab === "dashboard" && (
            <div className="flex md:hidden relative z-10 bg-zinc-950/80 p-1 rounded-2xl border border-white/[0.06] mb-2.5 w-full self-center">
              <button
                onClick={() => setDashboardSubTab("overview")}
                className={`flex-1 py-2 rounded-xl text-center text-[10px] font-bold font-mono transition-all duration-200 ${
                  dashboardSubTab === "overview"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-black shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                📊 OVERVIEW
              </button>
              <button
                onClick={() => setDashboardSubTab("log")}
                className={`flex-1 py-2 rounded-xl text-center text-[10px] font-bold font-mono transition-all duration-200 ${
                  dashboardSubTab === "log"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-black shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                ✍️ QUICK LOG
              </button>
              <button
                onClick={() => setDashboardSubTab("timeline")}
                className={`flex-1 py-2 rounded-xl text-center text-[10px] font-bold font-mono transition-all duration-200 ${
                  dashboardSubTab === "timeline"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-black shadow-md"
                    : "text-white/60 hover:text-white"
                }`}
              >
                📋 MEALS ({meals.length})
              </button>
            </div>
          )}

          {/* Tab contents layouts switcher container */}
          <div className="relative z-10 w-full flex-1">
            <AnimatePresence mode="wait">

              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2.5 w-full"
                >
                  {/* AI Assistant Banner / relocated coaching button */}
                  <div 
                    onClick={() => setActiveTab("coaching")}
                    className={`md:col-span-12 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-white/5 hover:border-orange-500/15 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-all hover:scale-[1.005] select-none ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shadow-md">
                        <Sparkle className="w-5 h-5 text-orange-400 animate-pulse" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                          Need metabolic guidance? <span className="text-[9px] bg-orange-500/20 text-orange-400 font-mono px-1 pb-0.5 rounded uppercase font-semibold">AI Coach</span>
                        </h3>
                        <p className="text-[10px] text-white/50 mt-0.5">Click to chat instantly with your custom calorie targets and AI suggestions.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/5">
                      <span className="text-[10px] font-mono text-orange-400 font-bold border-r border-white/10 pr-2 pb-0.5 animate-pulse">
                        Ask me anything
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    </div>
                  </div>

                  {/* Stat-card: Daily Calories limit summary */}
                  <article className={`stat-card md:col-span-3 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[190px] ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <Flame className="w-4.5 h-4.5 text-orange-400" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-xs font-bold text-white/90">Daily Calories</h2>
                        <span className="text-[10px] text-white/40 block font-mono">Real-time Count</span>
                      </div>
                    </div>

                    <div className="my-3 text-left">
                      <strong className="text-3xl font-extrabold text-white tracking-tight leading-none block">
                        {totalCaloriesFormatted}
                      </strong>
                      <span className="text-[11px] text-white/50 block mt-1">
                        of <b className="text-[#9fdb8e]">{targetCaloriesFormatted}</b> kcal goal
                      </span>
                    </div>

                    {/* Progress tracking line */}
                    <div>
                      <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden relative border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-[#9fdb8e] rounded-full transition-all duration-500"
                          style={{ width: `${calorieProgressPercent}%` }}
                        />
                      </div>
                      
                      {/* Mini meal summary breakdown metrics bars */}
                      <div className="flex justify-between items-end h-8 mt-3 gap-1 px-1">
                        {mealCaloriesBreakdown.map((bar) => {
                          const barHeight = Math.max((bar.val / maxMealCaloriesVal) * 100, 6);
                          return (
                            <div 
                              key={bar.type} 
                              className="flex-1 flex flex-col items-center cursor-pointer group"
                              title={`${bar.type}: ${bar.val} kcal`}
                            >
                              <div className="w-full bg-zinc-800/80 group-hover:bg-zinc-700 rounded-t-sm relative h-5 flex items-end overflow-hidden">
                                <div 
                                  className="w-full bg-orange-400 transition-all duration-500"
                                  style={{ height: `${barHeight}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-white/30 tracking-tight font-mono uppercase mt-0.5 select-none">
                                {bar.type[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </article>

                  {/* Stat-card: Meal Rhythm tracking */}
                  <article className={`stat-card md:col-span-3 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[190px] ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <Apple className="w-4.5 h-4.5 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-xs font-bold text-white/90">Meal Rhythm</h2>
                        <span className="text-[10px] text-white/40 block font-mono">Density Index</span>
                      </div>
                    </div>

                    <div className="my-2 text-left">
                      <strong className="text-2xl font-extrabold text-white tracking-tight block">
                        {meals.length} items
                      </strong>
                      <span className="text-[11px] text-white/40 leading-none mt-1 block">
                        logged across {new Set(meals.map((m) => m.meal)).size} meal periods
                      </span>
                    </div>

                    {/* Vector spline curves path container */}
                    <div className="h-16 flex items-end">
                      <MealRhythmChart />
                    </div>
                  </article>

                  {/* Stat-card: Nutrient macro bars indicators */}
                  <article className={`stat-card md:col-span-3 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[190px] ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Dumbbell className="w-4.5 h-4.5 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-xs font-bold text-white/90">Macro Hits (g)</h2>
                        <span className="text-[10px] text-white/40 block font-mono">Aggregated Splits</span>
                      </div>
                    </div>

                    {/* Compact layout representing Protein, Carbs, Fats ratios */}
                    <div className="flex justify-around items-end h-16 my-3 bg-zinc-950/20 rounded-xl p-2 border border-white/5">
                      {/* Protein */}
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-[#9fdb8e] mb-1 leading-none">{Math.round(totals.protein)}g</span>
                        <div className="w-3.5 h-10 bg-zinc-900 rounded-sm relative overflow-hidden flex items-end">
                          <div 
                            className="w-full bg-[#9fdb8e] transition-all duration-500" 
                            style={{ height: `${Math.min((totals.protein / (goals.protein || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-white/40 font-mono tracking-tighter mt-1">PRO</span>
                      </div>

                      {/* Carbs */}
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-[#ffc247] mb-1 leading-none">{Math.round(totals.carbs)}g</span>
                        <div className="w-3.5 h-10 bg-zinc-900 rounded-sm relative overflow-hidden flex items-end">
                          <div 
                            className="w-full bg-[#ffc247] transition-all duration-500" 
                            style={{ height: `${Math.min((totals.carbs / (goals.carbs || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-white/40 font-mono tracking-tighter mt-1">CARB</span>
                      </div>

                      {/* Fats */}
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-[#ff7040] mb-1 leading-none">{Math.round(totals.fats)}g</span>
                        <div className="w-3.5 h-10 bg-zinc-900 rounded-sm relative overflow-hidden flex items-end">
                          <div 
                            className="w-full bg-[#ff7040] transition-all duration-500" 
                            style={{ height: `${Math.min((totals.fats / (goals.fats || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-white/40 font-mono tracking-tighter mt-1">FAT</span>
                      </div>
                    </div>

                    <div className="text-left flex items-center justify-between text-[11px] text-white/50 px-1 select-none">
                      <span>Limits:</span>
                      <span className="font-mono text-white/70">
                        {goals.protein}p • {goals.carbs}c • {goals.fats}f
                      </span>
                    </div>
                  </article>

                  {/* Stat-card: Macro speedometer index dial gauge */}
                  <article className={`stat-card md:col-span-3 bg-gradient-to-b from-[#182a17]/90 to-[#0c120a]/90 border border-[#2b4c2b]/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between min-h-[190px] ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}>
                    <MacroGauge meals={meals} goals={goals} />
                  </article>

                  {/* Unified Health Tracker Overview Dashboard Banner */}
                  <article className={`stat-card md:col-span-12 bg-gradient-to-r from-[#171a17]/90 via-[#0e120c]/90 to-[#12161b]/90 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 text-left ${dashboardSubTab === "overview" ? "flex" : "hidden md:flex"}`}>
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                        <Activity className="w-6.5 h-6.5 text-[#9fdb8e]" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Health Tracking</h2>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#60a5fa] border border-[#3b82f6]/20 font-bold">New Suite</span>
                        </div>
                        <p className="text-xs text-white/60 mt-1 leading-relaxed max-w-2xl">
                          Track daily sleep and custom habits to gain intelligent, unified health insights. Maintaining regular hydration and bedtime targets increases rest quality.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 w-full md:w-auto shrink-0 select-none">
                      {/* Micro stats summary */}
                      <div className="flex gap-4 bg-zinc-950/45 px-4 py-2 border border-white/5 rounded-xl font-mono text-xs">
                        <div>
                          <span className="text-[8px] text-white/40 block leading-tight">TODAY'S HABITS</span>
                          <strong className="text-emerald-400 font-extrabold text-xs">
                            {habits.filter(h => h.completedDates.includes(new Date().toISOString().split("T")[0])).length} Completed
                          </strong>
                        </div>
                        <div className="border-l border-white/10 pl-4">
                          <span className="text-[8px] text-white/40 block leading-tight">LATEST REST</span>
                          <strong className="text-[#9fd4ff] font-extrabold text-xs">
                            {sleepRecords.length > 0 ? `${sleepRecords[0].hours} hrs (${sleepRecords[0].quality})` : "No logs yet"}
                          </strong>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab("health")}
                        className="w-full md:w-auto px-4.5 py-2.5 bg-white hover:bg-emerald-400 text-zinc-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1 leading-none shadow-md"
                      >
                        Launch Health Suite &gt;
                      </button>
                    </div>
                  </article>

                  {/* Primary interactive data details log entries row */}
                  <section className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-3 mt-1.5 w-full">
                    
                    {/* Log forms input section */}
                    <div className={`md:col-span-4 bg-zinc-900/40 rounded-2xl border border-white/5 p-4 flex flex-col justify-between text-left ${dashboardSubTab === "log" ? "block" : "hidden md:flex"}`}>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-white/90">Macro Entry Engine</h2>
                        <p className="text-[10px] text-white/40 mt-1 leading-tight">
                          Select the meal category and declare calories, servings and macros below.
                        </p>
                      </div>

                      <form onSubmit={handleAddMeal} className="space-y-3 mt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50">Meal Class</label>
                            <select
                              value={mealType}
                              onChange={(e) => setMealType(e.target.value)}
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white px-2 focus:outline-none focus:border-orange-500 text-xs cursor-pointer"
                            >
                              <option>Breakfast</option>
                              <option>Lunch</option>
                              <option>Snack</option>
                              <option>Dinner</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50">Servings (Qty)</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={selectedQuantity}
                              onChange={(e) => {
                                const valStr = e.target.value;
                                if (valStr === "") {
                                  handleServingChange("", selectedUnit);
                                } else {
                                  const val = parseFloat(valStr);
                                  handleServingChange(isNaN(val) ? "" : val, selectedUnit);
                                }
                              }}
                              placeholder="e.g. 1, 1.5"
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white px-2.5 focus:outline-none focus:border-orange-500 text-xs font-mono font-bold"
                              required
                            />
                            {/* Fast Unit presets */}
                            <div className="flex flex-wrap gap-1 mt-1 justify-start select-none">
                              {["bowl", "g", "Unit", "serve"].map((unitPreset) => (
                                <button
                                  key={unitPreset}
                                  type="button"
                                  onClick={() => {
                                    handleServingChange(selectedQuantity || 1, unitPreset);
                                    toast(`Set unit to ${unitPreset}`);
                                  }}
                                  className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                    selectedUnit.toLowerCase() === unitPreset.toLowerCase()
                                      ? "bg-orange-500/25 text-orange-400 border-orange-500/40" 
                                      : "bg-white/5 hover:bg-white/10 text-white/50 border-white/5"
                                  }`}
                                >
                                  {unitPreset}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Serving Unit and Dynamic Preview Engine */}
                        <div id="portion-multiplier-field" className="bg-zinc-950/60 p-3 rounded-xl border border-white/10 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-mono uppercase tracking-wider text-orange-400 font-bold block">Dynamic Serving Preview</span>
                            {selectedQuantity !== 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleServingChange(1, selectedUnit);
                                  toast("Portion restored to 1x");
                                }}
                                className="text-[9px] font-mono text-zinc-400 hover:text-white transition-colors underline"
                              >
                                Restore 1x
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 bg-zinc-950 px-3 py-2 rounded-lg border border-white/5">
                            <span className="text-[9px] text-white/40 uppercase font-mono">Calculated Serving Size:</span>
                            <span className="text-xs font-extrabold text-orange-400 font-mono">
                              {selectedQuantity === "" ? "—" : selectedQuantity} {selectedUnit || "units"}
                            </span>
                          </div>

                          {/* Quick Quantity adjustment buttons */}
                          <div className="grid grid-cols-4 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof selectedQuantity === "number" ? selectedQuantity : 1;
                                handleServingChange(Math.max(0.1, parseFloat((current - 0.5).toFixed(2))), selectedUnit);
                              }}
                              className="px-2 py-1 text-[10px] font-mono border border-white/5 hover:bg-white/5 text-white/60 hover:text-white rounded transition-all"
                            >
                              -0.5
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof selectedQuantity === "number" ? selectedQuantity : 1;
                                handleServingChange(Math.max(0.1, parseFloat((current - 0.1).toFixed(2))), selectedUnit);
                              }}
                              className="px-2 py-1 text-[10px] font-mono border border-white/5 hover:bg-white/5 text-white/60 hover:text-white rounded transition-all"
                            >
                              -0.1
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof selectedQuantity === "number" ? selectedQuantity : 1;
                                handleServingChange(parseFloat((current + 0.1).toFixed(2)), selectedUnit);
                              }}
                              className="px-2 py-1 text-[10px] font-mono border border-white/5 hover:bg-white/5 text-white/60 hover:text-white rounded transition-all"
                            >
                              +0.1
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const current = typeof selectedQuantity === "number" ? selectedQuantity : 1;
                                handleServingChange(parseFloat((current + 0.5).toFixed(2)), selectedUnit);
                              }}
                              className="px-2 py-1 text-[10px] font-mono border border-white/5 hover:bg-white/5 text-white/60 hover:text-white rounded transition-all"
                            >
                              +0.5
                            </button>
                          </div>
                        </div>



                        <div className="flex flex-col gap-1 relative">
                          <div className="flex justify-between items-center w-full">
                            <label className="text-[9px] font-mono uppercase tracking-wider text-white/50">Food Name</label>
                            {isSearching ? (
                              <span className="text-[8px] text-orange-400 font-mono animate-pulse flex items-center gap-1">
                                <Loader2 className="w-2 h-2 animate-spin text-orange-400" /> Searching database & AI...
                              </span>
                            ) : foodName.trim().length >= 2 ? (
                              <span className="text-[8px] text-[#9fdb8e] font-mono">Found database results</span>
                            ) : (
                              <span className="text-[8px] text-white/30 font-mono">Type to search DB & AI</span>
                            )}
                          </div>
                          
                          <input
                            type="text"
                            value={foodName}
                            onChange={(e) => {
                              setFoodName(e.target.value);
                              setShowDropdown(true);
                            }}
                            onFocus={() => {
                              if (searchResults.length > 0) setShowDropdown(true);
                            }}
                            onBlur={() => {
                              // Small timeout to allow click event on suggestion button to trigger first
                              setTimeout(() => setShowDropdown(false), 200);
                            }}
                            placeholder="e.g. Chicken Breast, Greek Yogurt..."
                            className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white px-2.5 focus:outline-none focus:border-orange-500 text-xs text-left"
                            required
                          />

                          {/* Autocomplete Suggestions Box */}
                          {showDropdown && searchResults.length > 0 && (
                            <div className="absolute top-[52px] left-0 w-full bg-zinc-950/95 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 max-h-[170px] overflow-y-auto backdrop-blur-md">
                              {searchResults.map((item, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onMouseDown={() => {
                                    // Using onMouseDown so that it fires before input's onBlur hides the dropdown
                                    setFoodName(item.food);
                                    setServingSize(item.serving || "1 serving");
                                    setCalories(item.calories);
                                    setProtein(item.protein || 0);
                                    setCarbs(item.carbs || 0);
                                    setFats(item.fats || 0);
                                    setOriginalFoodItem({
                                      food: item.food,
                                      serving: item.serving || "1 serving",
                                      calories: item.calories,
                                      protein: item.protein || 0,
                                      carbs: item.carbs || 0,
                                      fats: item.fats || 0
                                    });
                                    const parsed = parseServing(item.serving || "1 serving");
                                    setSelectedQuantity(parsed.qty);
                                    setSelectedUnit(parsed.unit);
                                    setShowDropdown(false);
                                    toast(`Imported macros for ${item.food}!`);
                                  }}
                                  className="w-full p-2.5 text-left hover:bg-white/5 transition-colors flex justify-between items-start cursor-pointer group"
                                >
                                  <div className="flex flex-col min-w-0 pr-1 text-left">
                                    <strong className="text-xs text-white group-hover:text-orange-400 truncate transition-colors block">
                                      {item.food}
                                    </strong>
                                    <span className="text-[9px] text-white/40 block mt-0.5">{item.serving}</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-mono text-orange-400 font-bold block">
                                      {item.calories} <span className="text-[9px] font-normal text-white/30">kcal</span>
                                    </span>
                                    <span className="text-[8px] font-mono text-[#9fdb8e] block mt-0.5">
                                      {item.protein}p • {item.carbs}c • {item.fats}f
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono text-center text-white/40">CAL (kcal)</label>
                            <input
                              type="number"
                              min="0"
                              value={calories}
                              onChange={(e) => setCalories(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="180"
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white text-center focus:outline-none focus:border-orange-500 text-xs font-mono"
                              required
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono text-center text-[#9fdb8e]/80">PRO (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={protein}
                              onChange={(e) => setProtein(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="12"
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white text-center focus:outline-none focus:border-emerald-500 text-xs font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono text-center text-[#ffc247]/80">CARB (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={carbs}
                              onChange={(e) => setCarbs(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="25"
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white text-center focus:outline-none focus:border-amber-400 text-xs font-mono"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-mono text-center text-[#ff7040]/80">FAT (g)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={fats}
                              onChange={(e) => setFats(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="4"
                              className="w-full min-h-[34px] rounded-lg border border-white/10 bg-zinc-950 text-white text-center focus:outline-none focus:border-orange-500 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full min-h-[38px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl font-bold text-xs text-zinc-950 transition-all shadow-md transform active:scale-[0.98] mt-3 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-4 h-4 text-zinc-950" /> Log Meal Item
                        </button>
                      </form>

                      {/* Frequently / Recently Eaten foods section - Premium database suggestion utility */}
                      <div className="mt-5 pt-4.5 border-t border-white/[0.06] w-full text-left">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                            <Sparkle className="w-3 h-3 text-orange-400 animate-pulse" />
                            {meals.length > 0 ? "Frequent From History" : "Wholesome Starters"}
                          </span>
                          <span className="text-[8px] font-mono uppercase bg-zinc-950 px-2 py-0.5 rounded text-white/40 border border-white/5">
                            {meals.length > 0 ? "User Database" : "System Presets"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2">
                          {(meals.length > 0 ? userFrequentFoods : defaultWholesomeFoods).map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setFoodName(item.food);
                                setServingSize(item.serving || "1 serving");
                                setCalories(item.calories);
                                setProtein(item.protein || 0);
                                setCarbs(item.carbs || 0);
                                setFats(item.fats || 0);
                                setOriginalFoodItem({
                                  food: item.food,
                                  serving: item.serving || "1 serving",
                                  calories: item.calories,
                                  protein: item.protein || 0,
                                  carbs: item.carbs || 0,
                                  fats: item.fats || 0
                                });
                                const parsed = parseServing(item.serving || "1 serving");
                                setSelectedQuantity(parsed.qty);
                                setSelectedUnit(parsed.unit);
                                if (item.meal) {
                                  setMealType(item.meal);
                                }
                                toast(`Pre-filled: ${item.food}!`);
                              }}
                              className="w-full text-left bg-zinc-950/40 hover:bg-zinc-950/80 px-3 py-2.5 rounded-xl border border-white/[0.03] hover:border-orange-500/20 transition-all duration-200 cursor-pointer flex justify-between items-center group relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/0 group-hover:bg-orange-500/[0.02] blur-xl rounded-full transition-colors pointer-events-none" />
                              <div className="truncate min-w-0 pr-2">
                                <div className="text-xs font-bold text-white group-hover:text-orange-400 truncate transition-colors">
                                  {item.food}
                                </div>
                                <div className="text-[9px] text-white/40 font-mono mt-0.5 flex items-center gap-1 truncate">
                                  <span>{item.serving}</span>
                                  <span className="text-white/20">•</span>
                                  <span className="text-[#9fdb8e]/80 uppercase font-bold tracking-wider">{item.meal || "Snack"}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xs font-black text-orange-400 font-mono">
                                  {item.calories} <span className="text-[8px] text-white/30 font-normal font-sans">kcal</span>
                                </div>
                                <div className="text-[8px] text-[#9fdb8e] font-mono mt-0.5">
                                  {item.protein}p • {item.carbs}c
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Log list active output items timeline */}
                    <div className={`md:col-span-8 bg-gradient-to-br from-zinc-900/40 via-zinc-900/25 to-zinc-950/50 rounded-2xl border border-white/[0.06] p-5 flex flex-col justify-start min-h-[500px] text-left relative overflow-hidden backdrop-blur-md shadow-xl ${dashboardSubTab === "timeline" ? "block" : "hidden md:flex"}`}>
                      {/* Premium card subtle glow accent */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] rounded-full pointer-events-none" />
                      
                      <div className="flex justify-between items-center pb-2.5 border-b border-white/5 relative z-10">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">Daily Meal Timeline</h2>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <p className="text-[10px] text-white/40 block mt-0.5">Chronological records of nutrition goals captured in current daylight window</p>
                        </div>
                        <span className="text-[10px] font-mono bg-zinc-950 px-3 py-1 rounded-full text-zinc-300 font-bold border border-white/5 shadow-inner">
                          {meals.length} {meals.length === 1 ? 'Log' : 'Logs'} Saved
                        </span>
                      </div>

                      {/* Log core list */}
                      <div className="flex-1 overflow-y-auto mt-4 min-h-[450px] pr-2.5 custom-scrollbar relative z-10 self-stretch">
                        {meals.length > 0 && (
                          /* High-fidelity vertical connection thread line */
                          <div className="absolute left-[13px] top-4 bottom-4 w-[1.5px] bg-gradient-to-b from-amber-500/20 via-[#9fdb8e]/30 to-purple-500/15 pointer-events-none" />
                        )}
                        <AnimatePresence initial={false}>
                          {meals.length === 0 ? (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="h-full flex flex-col items-center justify-center text-center py-10"
                            >
                              <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center text-white/20 mb-2">
                                <UtensilsCrossed className="w-5 h-5" />
                              </div>
                              <span className="text-[11px] font-bold text-white/70">Daily plate is empty</span>
                              <span className="text-[10px] text-white/40 mt-0.5 max-w-sm">Log a meal or restore standard baseline starters to begin tracking.</span>
                            </motion.div>
                          ) : (
                            <div className="space-y-3.5">
                              {meals.map((item) => {
                                let nodeBorder = "border-orange-500";
                                let dotColor = "bg-orange-400";
                                let glowColor = "bg-orange-500/10";
                                let bgBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                                
                                const mLower = (item.meal || "").toLowerCase();
                                if (mLower.includes("break")) {
                                  nodeBorder = "border-amber-400";
                                  dotColor = "bg-amber-300";
                                  glowColor = "bg-amber-400/10";
                                  bgBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                                } else if (mLower.includes("lunch")) {
                                  nodeBorder = "border-sky-400";
                                  dotColor = "bg-sky-300";
                                  glowColor = "bg-sky-400/10";
                                  bgBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                                } else if (mLower.includes("snack")) {
                                  nodeBorder = "border-orange-500";
                                  dotColor = "bg-orange-400";
                                  glowColor = "bg-orange-500/10";
                                  bgBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                                } else if (mLower.includes("din")) {
                                  nodeBorder = "border-purple-400";
                                  dotColor = "bg-purple-300";
                                  glowColor = "bg-purple-400/10";
                                  bgBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                                }

                                return (
                                  <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 12 }}
                                    className="relative pl-7 group text-left"
                                  >
                                    {/* Timeline interactive pulse node bullet */}
                                    <div className="absolute left-[8px] top-1/2 -translate-y-1/2 flex items-center justify-center">
                                      <div className={`w-3 h-3 rounded-full bg-zinc-950 border-2 ${nodeBorder} flex items-center justify-center relative z-10 box-content shadow-md shadow-black/40 group-hover:scale-110 transition-transform`}>
                                        <span className={`w-1 h-1 rounded-full ${dotColor}`} />
                                      </div>
                                      <span className={`absolute w-4 h-4 rounded-full ${glowColor} animate-ping opacity-60 pointer-events-none`} />
                                    </div>

                                    {/* Custom Styled Meal Log row card with hover micro-glow */}
                                    <div className="flex justify-between items-center bg-zinc-950/40 hover:bg-zinc-900/60 p-3 rounded-xl border border-white/[0.03] hover:border-white/[0.08] transition-all duration-200">
                                      <div className="flex-1 min-w-0 pr-3 text-left">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`text-[8px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${bgBadge} leading-none tracking-wider`}>
                                            {item.meal}
                                          </span>
                                          <strong className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-none group-hover:text-orange-400 transition-colors">
                                            {item.food}
                                          </strong>
                                        </div>
                                        <div className="text-[10px] text-white/50 mt-1 block">
                                          Serving size: <span className="text-white/80 font-medium">{item.serving}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <strong className="text-sm font-extrabold text-white font-mono block">
                                            {item.calories} <span className="text-[9px] text-white/40 font-normal font-sans">kcal</span>
                                          </strong>
                                          <span className="text-[9px] text-[#9fdb8e] font-mono leading-none block mt-0.5">
                                            {item.protein}p <span className="text-white/30">•</span> {item.carbs}c <span className="text-white/30">•</span> {item.fats}f
                                          </span>
                                        </div>

                                        <button
                                          onClick={() => handleDeleteMeal(item.id, item.food)}
                                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 border border-white/5 flex items-center justify-center text-white/30 hover:text-white transition-all cursor-pointer"
                                          title="Delete logged entry"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                  </section>
                </motion.div>
              )}

              {activeTab === "meals" && (
                <motion.div
                  key="meals-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="bg-zinc-900/40 rounded-2xl border border-white/5 p-5 min-h-[460px] text-left flex flex-col justify-between"
                >
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">Full Entries Registry</h2>
                    <p className="text-xs text-white/40 mt-1 block">Full breakdown layout representing nutrient density percentages for each active entry logged today.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto mt-5 space-y-2.5 max-h-[460px] pr-2 custom-scrollbar">
                    {meals.map((item) => {
                      const totalCals = item.protein * 4 + item.carbs * 4 + item.fats * 9 || 1;
                      const pRatio = Math.round(((item.protein * 4) / totalCals) * 100);
                      const cRatio = Math.round(((item.carbs * 4) / totalCals) * 100);
                      const fRatio = Math.round(((item.fats * 9) / totalCals) * 100);

                      return (
                        <div key={item.id} className="bg-zinc-950/40 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                          <div className="text-left">
                            <span className="text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded border border-white/10 text-white/70 block w-max uppercase mb-1.5 font-bold">
                              {item.meal}
                            </span>
                            <strong className="text-sm font-bold text-white block">{item.food}</strong>
                            <span className="text-xs text-white/50">Portion size: {item.serving}</span>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Visual balance line for single meal ratio */}
                            <div className="hidden sm:flex flex-col gap-1 w-28 text-[9px] font-mono text-white/50">
                              <span className="text-right">Macro ratio:</span>
                              <div className="h-2 rounded-full overflow-hidden flex bg-zinc-900 border border-white/5">
                                <div className="bg-[#9fdb8e]" style={{ width: `${pRatio}%` }} title={`Protein: ${pRatio}%`} />
                                <div className="bg-[#ffc247]" style={{ width: `${cRatio}%` }} title={`Carbs: ${cRatio}%`} />
                                <div className="bg-[#ff7040]" style={{ width: `${fRatio}%` }} title={`Fats: ${fRatio}%`} />
                              </div>
                            </div>

                            <div className="text-right flex flex-col justify-center min-w-[70px]">
                              <strong className="text-base font-extrabold text-[#ff8054] block font-mono">{item.calories} kcal</strong>
                              <span className="text-[10px] text-white/40 font-mono">
                                {item.protein}p • {item.carbs}c • {item.fats}f
                              </span>
                            </div>

                            <button
                              onClick={() => handleDeleteMeal(item.id, item.food)}
                              className="w-8 h-8 rounded-full hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-white/55 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {activeTab === "analytics" && (
                <motion.div
                  key="analytics-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3"
                >
                  {/* Wellness trend spline */}
                  <article className="stat-card md:col-span-6 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between min-h-[220px]">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Wellness Score</h2>
                        <span className="text-[10px] text-white/40 block">Nutrition quality estimates</span>
                      </div>
                      <strong className="text-3xl font-extrabold text-orange-400 leading-none">87</strong>
                    </div>

                    <div className="my-2 h-24">
                      <WellnessWaveChart />
                    </div>

                    {/* Horizontal stats metric */}
                    <div className="grid grid-cols-3 gap-1 bg-zinc-950/20 border border-white/5 rounded-xl p-2.5 text-center leading-closed mt-2 select-none">
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-base text-orange-400 font-mono">
                          {meals.length ? Math.round(totals.calories / meals.length) : 0}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Avg Meal (kcal)</span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 border-x border-white/10">
                        <strong className="text-base text-[#9fdb8e] font-mono">
                          {meals.length ? Math.round(((totals.protein * 4) / (totals.calories || 1)) * 100) : 0}%
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">PRO Ratio</span>
                      </div>

                      <div className="flex flex-col gap-0.5 font-mono">
                        <strong className="text-base text-[#ff7040]">
                          {remainingCalories}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 block font-sans">Remaining (kcal)</span>
                      </div>
                    </div>
                  </article>

                  {/* Weekly metrics progress */}
                  <article className="stat-card md:col-span-6 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between min-h-[220px]">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Weekly Progress</h2>
                        <span className="text-[10px] text-white/40 block">Macro limits consistency streak</span>
                      </div>
                      <strong className="text-3xl font-extrabold text-amber-300 leading-none">73</strong>
                    </div>

                    <div className="flex justify-between items-end h-20 bg-zinc-950/20 rounded-xl p-3 border border-white/5 my-4 select-none">
                      {/* Weekly progress bars static mimicking history */}
                      {[0.72, 0.86, 0.68, 0.94, 0.79, 1.05, calorieProgressPercent / 100].map((val, idx) => {
                        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
                        const isToday = idx === 6;
                        const height = Math.min(Math.max(val * 100, 10), 100);
                        const barColor = isToday ? "bg-orange-500" : val > 0.9 ? "bg-[#9fdb8e]" : "bg-white/20";
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full gap-1.5 cursor-pointer">
                            <div className="w-2.5 h-full bg-zinc-900/60 rounded-full relative overflow-hidden flex items-end">
                              <div className={`w-full rounded-full ${barColor}`} style={{ height: `${height}%` }} />
                            </div>
                            <span className={`text-[8px] font-mono ${isToday ? "text-orange-400 font-bold" : "text-white/40"}`}>
                              {days[idx]}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-zinc-950/20 border border-white/5 rounded-xl p-2.5 text-center leading-closed select-none">
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-base text-[#ffc247] font-mono">
                          {meals.length ? Math.round(((totals.carbs * 4) / (totals.calories || 1)) * 100) : 0}%
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Carbs Ratio</span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 border-x border-white/10">
                        <strong className="text-base text-[#ff7040] font-mono">
                          {meals.length ? Math.round(((totals.fats * 9) / (totals.calories || 1)) * 100) : 0}%
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Fats Ratio</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <strong className="text-base text-[#9fd4ff] font-mono">42 min</strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 block font-sans text-center">Meal Prep</span>
                      </div>
                    </div>
                  </article>

                  {/* Habits Consistency Analytics */}
                  <article className="stat-card md:col-span-6 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between min-h-[300px]">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Award className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Habits Analytics</h2>
                            <span className="text-[10px] text-white/40 block">Routine tracking & consistency</span>
                          </div>
                        </div>
                        {habitsAnalytics && (
                          <div className="text-right">
                            <span className="text-[20px] font-extrabold text-[#9fdb8e] leading-none">
                              {habitsAnalytics.maxStreak}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Max Streak</span>
                          </div>
                        )}
                      </div>

                      {habitsAnalytics ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1.5 custom-scrollbar mt-3">
                          {habitsAnalytics.habitsWithStreaks.map((h, i) => {
                            const todayStr = new Date().toISOString().split("T")[0];
                            const doneToday = h.completedDates.includes(todayStr);
                            return (
                              <div key={i} className="flex justify-between items-center bg-zinc-950/20 border border-white/5 rounded-xl p-2.5">
                                <div className="truncate min-w-0 pr-2">
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                                    <span className={`w-1.5 h-1.5 rounded-full ${doneToday ? 'bg-emerald-400 animate-pulse' : 'bg-white/15'}`} />
                                    {h.name}
                                  </div>
                                  <span className="text-[9px] font-mono text-white/40 block">
                                    Total checkins: {h.completionCount}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {h.streak > 0 ? (
                                    <span className="text-[9px] font-mono text-orange-400 font-bold bg-orange-400/10 px-2 py-0.5 rounded border border-orange-500/15 animate-pulse">
                                      🔥 {h.streak}d streak
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-mono text-white/35 bg-white/5 px-2 py-0.5 rounded">
                                      No active streak
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-zinc-950/30 border border-white/5 rounded-xl p-6 text-center text-white/40 text-xs my-4">
                          No active habits found. Use the Health tab checklist to establish healthy daily routines!
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1 bg-zinc-950/20 border border-white/5 rounded-xl p-2.5 text-center leading-closed mt-4 select-none">
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-base text-[#9fdb8e] font-mono">
                          {habitsAnalytics ? habitsAnalytics.totalCount : 0}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Active Habits</span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 border-l border-white/10">
                        <strong className="text-base text-orange-400 font-mono">
                          {habitsAnalytics ? habitsAnalytics.totalCompletions : 0}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Tot. Check-ins</span>
                      </div>
                    </div>
                  </article>

                  {/* Sleep & Rest Quality metrics */}
                  <article className="stat-card md:col-span-6 bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between min-h-[300px]">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Moon className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Sleep Consistency</h2>
                            <span className="text-[10px] text-white/40 block">Rest depth ratios & history</span>
                          </div>
                        </div>
                        {sleepAnalytics && (
                          <div className="text-right">
                            <span className="text-[20px] font-extrabold text-[#9fd4ff] leading-none">
                              {sleepAnalytics.avgHrs}h
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Avg rest</span>
                          </div>
                        )}
                      </div>

                      {sleepAnalytics ? (
                        <div className="space-y-3 mt-3 my-2">
                          <div className="text-[10px] text-white/50 block font-mono">
                            QUALITY CLASSIFICATION DISTRIBUTION
                          </div>
                          
                          <div className="space-y-1.5">
                            {/* Good Rest Row */}
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Good quality rest
                              </span>
                              <div className="flex items-center gap-2 w-1/2 justify-end">
                                <div className="w-20 bg-zinc-950 rounded-full h-1 relative overflow-hidden">
                                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${sleepAnalytics.goodPercent}%` }} />
                                </div>
                                <span className="text-white text-right w-8">{sleepAnalytics.goodPercent}%</span>
                              </div>
                            </div>

                            {/* Average Rest Row */}
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-amber-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                Average level rest
                              </span>
                              <div className="flex items-center gap-2 w-1/2 justify-end">
                                <div className="w-20 bg-zinc-950 rounded-full h-1 relative overflow-hidden">
                                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${sleepAnalytics.averagePercent}%` }} />
                                </div>
                                <span className="text-white text-right w-8">{sleepAnalytics.averagePercent}%</span>
                              </div>
                            </div>

                            {/* Poor Rest Row */}
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-rose-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-400" />
                                Poor quality rest
                              </span>
                              <div className="flex items-center gap-2 w-1/2 justify-end">
                                <div className="w-20 bg-zinc-950 rounded-full h-1 relative overflow-hidden">
                                  <div className="bg-rose-400 h-full rounded-full" style={{ width: `${sleepAnalytics.poorPercent}%` }} />
                                </div>
                                <span className="text-white text-right w-8">{sleepAnalytics.poorPercent}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-950/30 border border-white/5 rounded-xl p-6 text-center text-white/40 text-xs my-4">
                          No sleep sessions logged. Record sleeping schedules in the Health tab to unlock circadian sleep consistency stats!
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1 bg-zinc-950/20 border border-white/5 rounded-xl p-2.5 text-center leading-closed mt-4 select-none">
                      <div className="flex flex-col gap-0.5">
                        <strong className="text-base text-purple-400 font-mono">
                          {sleepAnalytics ? sleepAnalytics.totalDays : 0}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Logged Nights</span>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 border-l border-white/10">
                        <strong className="text-base text-[#9fd4ff] font-mono">
                          {sleepAnalytics ? `${Math.round(sleepAnalytics.avgHrs * sleepAnalytics.totalDays)}h` : "0h"}
                        </strong>
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono block">Total Rest Rec.</span>
                      </div>
                    </div>
                  </article>
                </motion.div>
              )}

              {activeTab === "coaching" && (
                <motion.div
                  key="coaching-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <NutritionAssistant meals={meals} goals={goals} />
                </motion.div>
              )}

              {activeTab === "health" && (
                <motion.div
                  key="health-tracking-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <HealthTracking toast={toast} />
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer visual indicators of sync */}
          <footer className="mt-6 pt-3 border-t border-white/[0.04] text-center flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="text-[10px] text-white/30 tracking-tight flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-white/30" />
              Nutritional targets calculated dynamically against premium metabolic targets.
            </span>
            <div className="flex gap-2">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-white/50 border border-white/[0.04]">
                Server Persistence: ON
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-[#9fdb8e] border border-[#2b4c2b]/20">
                Gemini Client Ready
              </span>
            </div>
          </footer>
        </section>

      </main>

      {/* Floating brief alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 bg-zinc-950 border border-white/15 px-4.5 py-3 rounded-2xl flex items-center gap-2.5 shadow-2xl backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <div className="w-4.5 h-4.5 rounded-full bg-orange-500 flex items-center justify-center text-zinc-950 font-bold">
              <Check className="w-3.5 h-3.5 text-zinc-950 stroke-[3px]" />
            </div>
            <span className="text-xs font-medium text-[#f7f5ed] pr-2 shadow-sm">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target goals editor overlay modal with Calorie Calculator */}
      {isGoalsModalOpen && (
        <CalorieCalculatorModal
          currentGoals={goals}
          onSave={handleSaveGoals}
          onClose={() => setIsGoalsModalOpen(false)}
          toast={toast}
        />
      )}

      {/* Persistent App-Like Bottom Navigation Tab Bar (Thumb-friendly UX for Mobile) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-[#070906]/95 border-t border-white/[0.08] backdrop-blur-lg px-3 py-2 z-50 flex justify-around items-center h-[64px] shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
        <button 
          onClick={() => setActiveTab("dashboard")} 
          className={`flex flex-col items-center gap-0.5 justify-center flex-1 transition-all ${activeTab === "dashboard" ? "text-orange-400 scale-105 font-bold" : "text-white/40"}`}
        >
          <Flame className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Board</span>
        </button>
        <button 
          onClick={() => setActiveTab("meals")} 
          className={`flex flex-col items-center gap-0.5 justify-center flex-1 transition-all ${activeTab === "meals" ? "text-orange-400 scale-105 font-bold" : "text-white/40"}`}
        >
          <UtensilsCrossed className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Logs</span>
        </button>
        <button 
          onClick={() => setActiveTab("analytics")} 
          className={`flex flex-col items-center gap-0.5 justify-center flex-1 transition-all ${activeTab === "analytics" ? "text-orange-400 scale-105 font-bold" : "text-white/40"}`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Trends</span>
        </button>
        <button 
          onClick={() => setActiveTab("health")} 
          className={`flex flex-col items-center gap-0.5 justify-center flex-1 transition-all ${activeTab === "health" ? "text-orange-400 scale-105 font-bold" : "text-white/40"}`}
        >
          <Heart className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Health</span>
        </button>
        <button 
          onClick={() => setActiveTab("coaching")} 
          className={`flex flex-col items-center gap-0.5 justify-center flex-1 transition-all ${activeTab === "coaching" ? "text-orange-400 scale-105 font-bold" : "text-white/40"}`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[10px] font-mono tracking-tight">Coach</span>
        </button>
      </div>

    </div>
  );
}
