import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight,
  ChevronLeft,
  Briefcase,
  User,
  Heart,
  TrendingUp,
  Activity,
  Calculator,
  Flame,
  Award,
  Loader2,
  Sparkles,
  Smile,
  ShieldAlert
} from "lucide-react";
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { MacroTargets } from "../types";

interface OnboardingFlowProps {
  userId: string;
  onComplete: (goals: MacroTargets) => void;
}

const COMMON_PROFESSIONS = [
  { id: "student", label: "Student", emoji: "🎓", desc: "High study strain, sitting hours, variable schedule" },
  { id: "desk", label: "Desk Employee / Office", emoji: "💼", desc: "Mainly sedentary, high screen-time boundaries" },
  { id: "dev", label: "Software Developer / IT", emoji: "💻", desc: "Long hours seated, high mental focus, night schedules" },
  { id: "med", label: "Healthcare / Nurse", emoji: "🩺", desc: "Frequent walking/standing, heavy shifts & stress" },
  { id: "labor", label: "Active Labor / Construction", emoji: "🔨", desc: "Intense daily movement, elevated calorie requirement" },
  { id: "teacher", label: "Teacher / Educator", emoji: "🏫", desc: "Active speaking, standing, classroom commute" },
  { id: "remote", label: "Remote / Work From Home", emoji: "🏡", desc: "Comfort kitchen access, lack of daily commute" },
  { id: "trainer", label: "Athlete / Fitness Coach", emoji: "🏋️", desc: "Continuous muscular performance, higher protein need" },
  { id: "creative", label: "Creative / Artist / Writer", emoji: "🎨", desc: "Prolonged sitting focus, variable creative pacing" },
];

export function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [transitionDirection, setTransitionDirection] = useState(1); // 1 = forward, -1 = backward

  // --- Profile States ---
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<string>("Male");
  const [height, setHeight] = useState<number>(175);
  const [weight, setWeight] = useState<number>(72);

  // --- Professional States ---
  const [profession, setProfession] = useState<string>("");
  const [customProfession, setCustomProfession] = useState<string>("");

  // --- Goal & Activity States ---
  const [activityLevel, setActivityLevel] = useState<string>("moderate");
  const [dietGoal, setDietGoal] = useState<string>("maintain");

  // --- Submit loading ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Live Calculations ---
  const calculations = useMemo(() => {
    // 1. Calculate BMR (Mifflin-St Jeor Equation)
    let bmr = 0;
    if (gender === "Male") {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else if (gender === "Female") {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 78; // average / non-binary preset
    }

    // Round BMR
    bmr = Math.round(bmr);

    // 2. Activity Multiplier
    let multiplier = 1.2;
    if (activityLevel === "sedentary") multiplier = 1.2;
    else if (activityLevel === "light") multiplier = 1.375;
    else if (activityLevel === "moderate") multiplier = 1.55;
    else if (activityLevel === "active") multiplier = 1.725;

    // Calculate TDEE (Total Daily Energy Expenditure)
    const tdee = Math.round(bmr * multiplier);

    // 3. Goal Adjustment
    let targetCalories = tdee;
    if (dietGoal === "lose") {
      targetCalories = tdee - 500;
    } else if (dietGoal === "gain") {
      targetCalories = tdee + 350;
    }

    // Ensure safe calorie floors
    if (targetCalories < 1200) {
      targetCalories = 1200;
    }

    // 4. Calculate Macros
    // Protein target: 2g of protein per kg of bodyweight
    const proteinGrams = Math.round(weight * 2.0);
    const proteinCalories = proteinGrams * 4;

    // Fats target: 25% of total calories
    const fatCalories = Math.round(targetCalories * 0.25);
    const fatGrams = Math.round(fatCalories / 9);

    // Carbs target: remaining calories
    const carbCalories = targetCalories - proteinCalories - fatCalories;
    const carbGrams = Math.round(carbCalories / 4);

    return {
      bmr,
      tdee,
      calories: targetCalories,
      protein: proteinGrams,
      carbs: Math.max(carbGrams, 50), // prevent too low carbs
      fats: Math.max(fatGrams, 30), // prevent too low fats
    };
  }, [age, gender, height, weight, activityLevel, dietGoal]);

  const handleNext = () => {
    if (step === 2 && !profession && !customProfession.trim()) {
      // Prompt selection or type
      setProfession("student");
    }
    setTransitionDirection(1);
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setTransitionDirection(-1);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCompleteSetup = async () => {
    setIsSubmitting(true);
    try {
      const finalProfession = profession === "custom" || !profession 
        ? (customProfession.trim() || "Independent Professional") 
        : profession;

      const macroTargets: MacroTargets = {
        calories: calculations.calories,
        protein: calculations.protein,
        carbs: calculations.carbs,
        fats: calculations.fats
      };

      // 1. Store the goals document with onboarding info
      const goalsRef = doc(db, "users", userId, "goals", "daily");
      try {
        await setDoc(goalsRef, {
          userId,
          calories: calculations.calories,
          protein: calculations.protein,
          carbs: calculations.carbs,
          fats: calculations.fats,
          age,
          gender,
          height,
          weight,
          profession: finalProfession,
          activityLevel,
          dietGoal,
          onboarded: true,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}/goals/daily`);
      }

      // 2. STAGE: User requested all existing user data like meal logs, etc. be completely empty for a new user!
      // This gives them a pristine, high-fidelity experience to track fresh meals after calculation.
      const batch = writeBatch(db);
      
      // Wipe starter meals collection so it is completely empty
      const mealsCol = collection(db, "users", userId, "meals");
      const mealsSnapshot = await getDocs(mealsCol);
      mealsSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // Clear sleep logs too for a perfectly clean slate
      const sleepCol = collection(db, "users", userId, "sleep");
      const sleepSnapshot = await getDocs(sleepCol);
      sleepSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // Reset habits completions to empty trackers
      const habitsCol = collection(db, "users", userId, "habits");
      const habitsSnapshot = await getDocs(habitsCol);
      habitsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        batch.set(docSnap.ref, {
          ...data,
          completedDates: []
        });
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}/batch_init`);
      }

      // Trigger standard client state update callback
      onComplete(macroTargets);
    } catch (err) {
      console.error("Critical onboarding saving failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stepper UI
  const stepsDef = [
    { num: 1, title: "Bio Stats" },
    { num: 2, title: "Profession" },
    { num: 3, title: "Lifestyle & Aim" },
    { num: 4, title: "Metabolic Baseline" },
  ];

  return (
    <div className="min-h-screen bg-[#080d07] text-[#f7f5ed] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Immersive high fidelity decorative background light */}
      <div className="absolute top-[-20%] left-[-10%] w-[550px] h-[550px] bg-emerald-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[480px] h-[480px] bg-orange-950/15 rounded-full blur-[130px] pointer-events-none" />

      {/* Grid line overlay */}
      <div 
        className="absolute inset-0 bg-transparent opacity-10 pointer-events-none z-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }}
      />

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Header / Intro */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[10px] uppercase font-mono tracking-widest mb-3 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" /> Initialize Athletic OS profile
          </div>
          <h1 className="text-3xl font-black tracking-widest text-[#f7f5ed] uppercase">
            Metabolic <span className="text-emerald-400">Onboarding</span>
          </h1>
          <p className="text-xs text-white/50 font-mono mt-1 select-none">
            Welcome to Zenith. Let's calibrate your exact caloric expenditure & target goals.
          </p>
        </div>

        {/* Master Card Frame */}
        <div className="bg-black/85 border border-white/[0.08] backdrop-blur-3xl rounded-3xl p-6.5 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-orange-500 to-purple-500 opacity-60"></div>

          {/* Stepper HUD */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-6 mb-7 select-none">
            {stepsDef.map((s, idx) => (
              <div key={idx} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
                    step === s.num 
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 border-orange-500 shadow-md shadow-orange-500/10 scale-110' 
                      : step > s.num
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-950 text-white/30 border-white/10'
                  }`}>
                    {s.num}
                  </div>
                  <span className={`text-[9px] uppercase tracking-widest text-center mt-2.5 font-bold transition-colors ${
                    step === s.num ? 'text-white' : 'text-white/30'
                  }`}>
                    {s.title}
                  </span>
                </div>
                {idx < stepsDef.length - 1 && (
                  <div className={`w-12 sm:w-20 md:w-24 h-[1px] mx-2 self-start mt-4 transition-all duration-500 ${
                    step > s.num ? 'bg-emerald-500/50' : 'bg-white/10'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Core Body Container with animate presence sliders */}
          <div className="min-h-[340px] flex flex-col justify-between relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: transitionDirection * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -transitionDirection * 40 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full h-full text-left flex-1"
              >
                {/* STEP 1: BIO STATS */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="border-b border-white/5 pb-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-orange-400" />
                        Physical Biometrics
                      </h2>
                      <p className="text-xs text-white/40 mt-1 font-mono">
                        These physical metrics dictate your Resting Metabolic Rate (BMR) prior to load activities.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      {/* Gender Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Biological Genotype / Gender
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {["Male", "Female", "Neutral"].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGender(g)}
                              className={`py-3.5 px-2 rounded-xl text-xs font-bold text-center capitalize transition-all border cursor-pointer ${
                                gender === g
                                  ? "bg-orange-500/10 border-orange-500 text-orange-400 shadow-sm"
                                  : "bg-zinc-950 border-white/15 text-white/50 hover:border-white/30"
                              }`}
                            >
                              {g === "Male" ? "♂ Male" : g === "Female" ? "♀ Female" : "⚦ Other"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Age Field */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Current Age (Years)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="15"
                            max="100"
                            value={age}
                            onChange={(e) => setAge(Math.max(15, Math.min(100, Number(e.target.value) || 25)))}
                            className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-lime-400 font-mono font-bold focus:outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">yrs old</span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="85"
                          value={age}
                          onChange={(e) => setAge(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500 mt-2"
                        />
                      </div>

                      {/* Height Field */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Height Metric (Centimeters)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="100"
                            max="250"
                            value={height}
                            onChange={(e) => setHeight(Math.max(100, Math.min(250, Number(e.target.value) || 170)))}
                            className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">cm</span>
                        </div>
                        <input
                          type="range"
                          min="130"
                          max="220"
                          value={height}
                          onChange={(e) => setHeight(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500 mt-2"
                        />
                      </div>

                      {/* Weight Field */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Total Bodyweight (Kilograms)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="30"
                            max="250"
                            value={weight}
                            onChange={(e) => setWeight(Math.max(30, Math.min(250, Number(e.target.value) || 70)))}
                            className="w-full h-12 bg-zinc-950 border border-white/10 rounded-xl px-4 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-orange-500"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30">kg ({(weight * 2.20462).toFixed(0)} lbs)</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="160"
                          value={weight}
                          onChange={(e) => setWeight(Number(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500 mt-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: PROFESSIONAL LIFESTYLE */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="border-b border-white/5 pb-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-orange-400" />
                        Professional Lifestyle
                      </h2>
                      <p className="text-xs text-white/40 mt-1 font-mono">
                        Your career profession provides critical parameters on base activity habits, posture trends, and caloric burn.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-2.5 custom-scrollbar my-2">
                      {COMMON_PROFESSIONS.map((prof) => (
                        <button
                          key={prof.id}
                          type="button"
                          onClick={() => {
                            setProfession(prof.label);
                            setCustomProfession("");
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 relative select-none ${
                            profession === prof.label
                              ? "bg-orange-500/10 border-orange-500 text-orange-400"
                              : "bg-zinc-950/60 border-white/5 text-white/70 hover:border-white/20 hover:bg-zinc-900/60"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm font-bold truncate pr-1">{prof.label}</span>
                            <span className="text-sm">{prof.emoji}</span>
                          </div>
                          <span className="text-[9px] text-white/35 font-mono line-clamp-2 mt-1 leading-tight">
                            {prof.desc}
                          </span>
                        </button>
                      ))}

                      {/* Custom Profession card trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setProfession("custom");
                          setCustomProfession("");
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center h-20 ${
                          profession === "custom"
                            ? "bg-orange-500/10 border-orange-500 text-orange-400"
                            : "bg-zinc-950/60 border-white/5 text-white/70 hover:border-white/20 hover:bg-zinc-900/60"
                        }`}
                      >
                        <span className="text-xs font-black uppercase text-center block w-full tracking-wider">
                          ✍️ Custom Profession
                        </span>
                      </button>
                    </div>

                    {/* Custom type-in input form */}
                    {profession === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-zinc-950/40 border border-white/5 rounded-2xl"
                      >
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest font-mono block mb-1">
                          Define Custom Occupation
                        </label>
                        <input
                          type="text"
                          value={customProfession}
                          onChange={(e) => setCustomProfession(e.target.value)}
                          placeholder="e.g. Architect, Graphic Designer, Photographer..."
                          className="w-full h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-xs text-white placeholder-white/25 focus:outline-none focus:border-orange-500 font-bold"
                          autoFocus
                        />
                      </motion.div>
                    )}

                    {/* Current Choice Indicator */}
                    <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl text-xs flex justify-between items-center select-none">
                      <span className="text-[#9fdb8e] font-bold">Selected Occupation Profile:</span>
                      <strong className="text-white font-mono bg-zinc-950 px-3 py-1 rounded-md border border-white/15">
                        {profession === "custom"
                          ? (customProfession.trim() || "Type Occupation Above")
                          : (profession || "Verify Occupation Selection")}
                      </strong>
                    </div>
                  </div>
                )}

                {/* STEP 3: LIFESTYLE & AIM */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="border-b border-white/5 pb-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-400" />
                        Athletic Activity & Metabolic Goals
                      </h2>
                      <p className="text-xs text-white/40 mt-1 font-mono">
                        These coefficients multiply your BMR base to calculate total daily metabolic expenditure.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      {/* Activity Selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Physical Activity Coefficient
                        </label>
                        <div className="flex flex-col gap-2">
                          {[
                            { id: "sedentary", title: "Sedentary Desk Life", mult: "1.20x", desc: "Little or no structural movement/workouts." },
                            { id: "light", title: "Light Activity", mult: "1.37x", desc: "Light exercise / walks 1-3 days per week." },
                            { id: "moderate", title: "Moderate Workout", mult: "1.55x", desc: "Moderate gym training or sports 3-5 days." },
                            { id: "active", title: "Very High Athletics", mult: "1.72x", desc: "Hard, strenuous workouts 6-7 days/week." },
                          ].map((act) => (
                            <button
                              key={act.id}
                              type="button"
                              onClick={() => setActivityLevel(act.id)}
                              className={`p-2.5 rounded-xl border text-left flex items-start justify-between gap-1 cursor-pointer transition-all ${
                                activityLevel === act.id
                                  ? "bg-orange-500/10 border-orange-500 text-orange-400"
                                  : "bg-zinc-950 border-white/5 text-white/60 hover:border-white/25"
                              }`}
                            >
                              <div className="truncate min-w-0 pr-1.5">
                                <span className="text-xs font-black block">{act.title}</span>
                                <span className="text-[9px] text-white/35 font-mono line-clamp-1 leading-tight mt-0.5">{act.desc}</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-zinc-950 border border-white/10 px-2 py-0.5 rounded text-white italic">
                                {act.mult}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Goal Selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Physiological Body Goal
                        </label>
                        <div className="flex flex-col gap-2">
                          {[
                            { id: "lose", title: "Caloric Deficit (Fat Loss)", factor: "-500 kcal", desc: "Promotes steady fat burn and tight conditioning." },
                            { id: "maintain", title: "Metabolic Balance (TDEE)", factor: "+0 kcal", desc: "Maintain current tissue weight & organic balance." },
                            { id: "gain", title: "Lean Mass Gain (Bulk)", factor: "+350 kcal", desc: "Promotes lean muscle loading & tissue synthesis." },
                          ].map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setDietGoal(g.id)}
                              className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-1 cursor-pointer transition-all ${
                                dietGoal === g.id
                                  ? "bg-orange-500/10 border-orange-500 text-orange-400"
                                  : "bg-zinc-950 border-white/5 text-white/60 hover:border-white/25"
                              }`}
                            >
                              <div className="truncate min-w-0 pr-1.5">
                                <span className="text-xs font-black block">{g.title}</span>
                                <span className="text-[9px] text-white/35 font-mono line-clamp-1 leading-tight mt-0.5">{g.desc}</span>
                              </div>
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded text-center shrink-0 uppercase tracking-wide ${
                                g.id === "lose" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                g.id === "gain" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                "bg-white/5 text-white/55 border border-white/15"
                              }`}>
                                {g.factor}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: METABOLIC BASIL SUMMARY */}
                {step === 4 && (
                  <div className="space-y-5">
                    <div className="border-b border-white/5 pb-2">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-orange-400 animate-pulse" />
                        Metabolic Baseline Targets
                      </h2>
                      <p className="text-xs text-white/40 mt-1 font-mono">
                        This summarizes your calibrated daily metabolic budgets.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1.5 select-none">
                      {/* Left Block TDEE HUD */}
                      <div className="md:col-span-5 bg-zinc-950/80 border border-white/10 rounded-2xl p-5 text-center flex flex-col justify-center relative overflow-hidden select-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full" />
                        
                        <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest block mb-2">
                          Resting Energetics
                        </span>
                        <div className="font-mono text-xs text-white/60 space-y-1">
                          <p>BMR: <strong className="text-amber-400">{calculations.bmr} kcal</strong></p>
                          <p>TDEE: <strong className="text-purple-400">{calculations.tdee} kcal</strong></p>
                        </div>

                        <div className="my-4 border-t border-white/10 w-1/2 mx-auto" />

                        <span className="text-[9px] font-bold text-[#9fdb8e] uppercase tracking-widest block">
                          Caloric Budget Target
                        </span>
                        <strong className="text-3xl text-orange-400 font-extrabold font-mono tracking-tight mt-1 animate-pulse">
                          {calculations.calories}
                          <span className="text-xs text-white/40 font-normal font-sans ml-1">kcal/day</span>
                        </strong>

                        <span className="text-[8px] text-[#9fdb8e] font-mono mt-1 w-full bg-emerald-500/5 py-1 px-1 border border-emerald-500/10 rounded uppercase tracking-wider block">
                          {dietGoal === "lose" ? "💥 Steady Deficit Rate" : dietGoal === "gain" ? "💪 Positive Tissue Load" : "⚖️ Core Sustained Level"}
                        </span>
                      </div>

                      {/* Right Block Macros Split */}
                      <div className="md:col-span-7 bg-zinc-950/30 border border-white/5 rounded-2xl p-4.5 space-y-3 flex flex-col justify-between">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest font-mono block">
                          Target Macronutrient Splitting Ratio
                        </span>

                        <div className="space-y-2.5">
                          {/* Protein item bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-[#9fdb8e] font-black flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5" />
                                Protein (2g per kg)
                              </span>
                              <strong className="text-white text-sm">{calculations.protein}g <span className="text-[10px] text-white/40 font-normal">{calculations.protein * 4} kcal</span></strong>
                            </div>
                            <div className="w-full bg-zinc-950 rounded-full h-1.5 relative overflow-hidden">
                              <div className="bg-[#9fdb8e] h-full rounded-full" style={{ width: `${Math.min(100, (calculations.protein * 4 / calculations.calories) * 100)}%` }} />
                            </div>
                          </div>

                          {/* Fats item bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-amber-400 font-black flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5" />
                                Lipids / Fats (25%)
                              </span>
                              <strong className="text-white text-sm">{calculations.fats}g <span className="text-[10px] text-white/40 font-normal">{calculations.fats * 9} kcal</span></strong>
                            </div>
                            <div className="w-full bg-zinc-950 rounded-full h-1.5 relative overflow-hidden">
                              <div className="bg-amber-400 h-full rounded-full" style={{ width: `25%` }} />
                            </div>
                          </div>

                          {/* Carbs item bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-[#9fd4ff] font-black flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" />
                                Carbohydrates
                              </span>
                              <strong className="text-white text-sm">{calculations.carbs}g <span className="text-[10px] text-white/40 font-normal">{calculations.carbs * 4} kcal</span></strong>
                            </div>
                            <div className="w-full bg-zinc-950 rounded-full h-1.5 relative overflow-hidden">
                              <div className="bg-[#9fd4ff] h-full rounded-full" style={{ width: `${100 - 25 - ((calculations.protein * 4 / calculations.calories) * 100)}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Note about empty database */}
                        <div className="p-2 border border-orange-500/10 bg-orange-500/[0.03] rounded-xl flex items-start gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                          <p className="text-[9px] text-orange-300 font-mono leading-normal">
                            Note: Agreeing setup clears pre-populated test data. You will log a completely clean, empty personal feed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center justify-between border-t border-white/[0.04] pt-5 mt-6 relative z-10 select-none">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 1 || isSubmitting}
                className="h-11 bg-zinc-900 border border-white/5 hover:border-white/15 text-white disabled:opacity-30 rounded-xl px-4 text-xs font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="h-11 bg-zinc-950 border border-orange-500/20 hover:border-orange-500/50 text-orange-400 rounded-xl px-5 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={isSubmitting}
                  className="h-11 bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-bold hover:from-orange-600 hover:to-amber-600 rounded-xl border border-white/10 px-5 text-xs font-mono uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-orange-500/10"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" /> Synchronizing Profile...
                    </>
                  ) : (
                    <>
                      <Smile className="w-4.5 h-4.5" /> Initialize & Clear Workspace
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
