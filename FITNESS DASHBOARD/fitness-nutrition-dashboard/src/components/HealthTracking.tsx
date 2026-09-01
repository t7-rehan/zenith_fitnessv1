import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Activity, 
  Moon, 
  Plus, 
  Trash2, 
  Check, 
  Clock, 
  Brain, 
  Sparkle,
  TrendingUp,
  Award,
  Heart,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react";
import { Habit, SleepRecord, HealthInsights } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { apiFetch } from "../lib/api";

interface HealthTrackingProps {
  toast: (msg: string) => void;
}

export function HealthTracking({ toast }: HealthTrackingProps) {
  // Database States
  const [habits, setHabits] = useState<Habit[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [wellnessScore, setWellnessScore] = useState<number>(0);
  
  // Interactive UI States
  const [activeDate, setActiveDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [newHabitName, setNewHabitName] = useState("");
  const [isAddingHabit, setIsAddingHabit] = useState(false);

  // Sleep Logger form states
  const [sleepTime, setSleepTime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");
  const [sleepQuality, setSleepQuality] = useState<"Good" | "Average" | "Poor">("Good");
  const [isLoggingSleep, setIsLoggingSleep] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load all tracking data from Firestore in real-time
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1. Subscribe to habits
    const habitsCol = collection(db, "users", currentUser.uid, "habits");
    const unsubHabits = onSnapshot(habitsCol, (snapshot) => {
      const habitsData: Habit[] = [];
      snapshot.forEach((docSnap) => {
        habitsData.push({ id: docSnap.id, ...docSnap.data() } as Habit);
      });
      setHabits(habitsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser?.uid}/habits`);
    });

    // 2. Subscribe to sleep logs
    const sleepCol = collection(db, "users", currentUser.uid, "sleep");
    const unsubSleep = onSnapshot(sleepCol, (snapshot) => {
      const sleepData: SleepRecord[] = [];
      snapshot.forEach((docSnap) => {
        sleepData.push({ id: docSnap.id, ...docSnap.data() } as SleepRecord);
      });
      sleepData.sort((a, b) => b.date.localeCompare(a.date));
      setSleepRecords(sleepData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser?.uid}/sleep`);
    });

    return () => {
      unsubHabits();
      unsubSleep();
    };
  }, []);

  // Compute Combined Smart Health Insights inside a React hook listening to database changes
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const resData = await apiFetch<{ insights: string[]; wellnessScore: number }>("/api/health/insights", {
          method: "POST",
          body: JSON.stringify({
            habits,
            sleepLogs: sleepRecords
          })
        });
        if (resData) {
          setInsights(resData.insights || []);
          setWellnessScore(resData.wellnessScore || 0);
        }
      } catch (err) {
        console.warn("Using smart local wellness calculation:", err);
        // Smart client-side wellness calculation fallback
        const goodSleeps = sleepRecords.filter((s) => s.quality === "Good").length;
        const avgHours = sleepRecords.length ? sleepRecords.reduce((a, b) => a + b.hours, 0) / sleepRecords.length : 7.5;
        const calculatedScore = Math.min(98, Math.max(65, Math.round((goodSleeps / (sleepRecords.length || 1)) * 40 + (avgHours / 8) * 50)));
        setWellnessScore(calculatedScore);
        setInsights([
          "Hydration consistency directly fuels muscle protein synthesis and cellular energy balance.",
          avgHours >= 7.5 ? "Solid sleep duration confirmed! Optimal anabolic recovery window unlocked." : "Aim for 7.5-8.5 hrs sleep tonight to optimize daily growth hormone release.",
          "Consistency in daily movement routines accelerates metabolic fat oxidation."
        ]);
      }
    };

    if (habits.length > 0 || sleepRecords.length > 0) {
      fetchInsights();
    }
  }, [habits, sleepRecords]);

  // Sync sleep form standard preset if activeDate changes
  useEffect(() => {
    const existingRecord = sleepRecords.find(r => r.date === activeDate);
    if (existingRecord) {
      setSleepTime(existingRecord.sleepTime);
      setWakeTime(existingRecord.wakeTime);
      setSleepQuality(existingRecord.quality);
    } else {
      // Default guess
      setSleepTime("22:30");
      setWakeTime("06:30");
      setSleepQuality("Good");
    }
  }, [activeDate, sleepRecords]);

  // Helper date calculators
  const getDayOffsetString = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().split("T")[0];
  };

  const getWeekDays = () => {
    const days = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateStr: d.toISOString().split("T")[0],
        dayName: weekdays[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 0
      });
    }
    return days;
  };

  const activeDateFormatted = () => {
    const d = new Date(activeDate + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  };

  // 1. Action: Toggle Habit Checkbox in Firestore
  const handleToggleHabit = async (habitId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const habitObj = habits.find((h) => h.id === habitId);
      if (!habitObj) return;

      const completedDates = [...(habitObj.completedDates || [])];
      const dateIndex = completedDates.indexOf(activeDate);

      if (dateIndex >= 0) {
        completedDates.splice(dateIndex, 1);
      } else {
        completedDates.push(activeDate);
      }

      const habitRef = doc(db, "users", currentUser.uid, "habits", habitId);
      await setDoc(habitRef, { completedDates }, { merge: true });
      toast(`Updated "${habitObj.name}"!`);
    } catch (err) {
      console.error(err);
      toast("Failed to toggle habit in database.");
    }
  };

  // 2. Action: Create New Custom Habit in Firestore
  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser || !newHabitName.trim()) return;

    try {
      setIsAddingHabit(true);
      const generatedId = `habit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const habitRef = doc(db, "users", currentUser.uid, "habits", generatedId);

      await setDoc(habitRef, {
        id: generatedId,
        userId: currentUser.uid,
        name: newHabitName.trim(),
        completedDates: [],
        isCustom: true,
        createdAt: new Date()
      });

      setNewHabitName("");
      toast(`Habit "${newHabitName.trim()}" created!`);
    } catch (err) {
      console.error(err);
      toast("Failed to save habit to database.");
    } finally {
      setIsAddingHabit(false);
    }
  };

  // 3. Action: Delete Custom Habit in Firestore
  const handleDeleteHabit = async (id: string, name: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "habits", id));
      toast(`Deleted habit "${name}".`);
    } catch (err) {
      console.error(err);
      toast("Error deleting habit.");
    }
  };

  // Calculate sleeping difference duration hours
  const calculateSleepDuration = (sleep: string, wake: string): number => {
    const [sH, sM] = sleep.split(":").map(Number);
    const [wH, wM] = wake.split(":").map(Number);
    let diffMins = (wH * 60 + wM) - (sH * 60 + sM);
    if (diffMins < 0) {
      diffMins += 24 * 60; // crossed midnight
    }
    return Math.round((diffMins / 60) * 10) / 10;
  };

  const calculatedHours = calculateSleepDuration(sleepTime, wakeTime);

  // 4. Action: Save/Upsert Sleep Log in Firestore
  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      setIsLoggingSleep(true);
      const sleepId = `sleep_${activeDate}`;
      const sleepRef = doc(db, "users", currentUser.uid, "sleep", sleepId);

      await setDoc(sleepRef, {
        id: sleepId,
        userId: currentUser.uid,
        date: activeDate,
        sleepTime,
        wakeTime,
        hours: calculatedHours,
        quality: sleepQuality,
        createdAt: new Date()
      });

      toast(`Saved sleep stats for ${activeDate}!`);
    } catch (err) {
      console.error(err);
      toast("Failed to log sleep duration.");
    } finally {
      setIsLoggingSleep(false);
    }
  };

  // Calculate Streak Counts dynamically
  const calculateStreak = (completedDates: string[]): number => {
    if (!completedDates || completedDates.length === 0) return 0;
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayStr = getDayOffsetString(1);

    let currentStreak = 0;
    let startOffset = 0;

    const hasToday = completedDates.includes(todayStr);
    const hasYesterday = completedDates.includes(yesterdayStr);

    if (!hasToday && !hasYesterday) {
      return 0;
    }

    startOffset = hasToday ? 0 : 1;

    while (true) {
      const checkDateStr = getDayOffsetString(startOffset);
      if (completedDates.includes(checkDateStr)) {
        currentStreak++;
        startOffset++;
      } else {
        break;
      }
      if (startOffset > 100) break; // safety
    }
    return currentStreak;
  };

  // Metrics calculators
  const weekDays = getWeekDays();
  const completedHabitsTodayCount = habits.filter(h => h.completedDates.includes(activeDate)).length;
  const habitsCompletionRatePercent = habits.length > 0 
    ? Math.round((completedHabitsTodayCount / habits.length) * 100) 
    : 0;

  // Sleep history average
  const totalSleepHistoryDays = sleepRecords.length;
  const avgSleepDurationHours = totalSleepHistoryDays > 0
    ? sleepRecords.reduce((sum, r) => sum + r.hours, 0) / totalSleepHistoryDays
    : 0;

  const activeDateSleepLog = sleepRecords.find(r => r.date === activeDate);

  // SVG parameters for Overall Wellness ring
  const circleRadius = 45;
  const circleStrokeDash = 2 * Math.PI * circleRadius;
  const strokeOffset = circleStrokeDash - (wellnessScore / 100) * circleStrokeDash;

  return (
    <div className="space-y-6">
      
      {/* Date Navigation Strip Widget */}
      <div className="bg-zinc-900/40 rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row justify-between items-center gap-4 select-none">
        <div className="text-left">
          <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest block">Operational Calendar</span>
          <h1 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            Health Status for <span className="text-orange-400">{activeDateFormatted()}</span>
            {activeDate === new Date().toISOString().split("T")[0] && (
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 leading-none">Today</span>
            )}
          </h1>
        </div>

        {/* Horizontal Calendar list selectors */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button 
            onClick={() => {
              const d = new Date(activeDate + "T12:00:00");
              d.setDate(d.getDate() - 1);
              setActiveDate(d.toISOString().split("T")[0]);
            }}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex gap-1">
            {weekDays.map(day => {
              const isActive = day.dateStr === activeDate;
              // Habit completion rate on this check day
              const dayCompletions = habits.filter(h => h.completedDates.includes(day.dateStr)).length;
              const hasSleepLog = sleepRecords.some(s => s.date === day.dateStr);

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setActiveDate(day.dateStr)}
                  className={`px-3 py-1.5 rounded-xl border flex flex-col items-center min-w-[50px] transition-all cursor-pointer ${
                    isActive
                      ? "bg-white border-white text-zinc-950 scale-105 shadow-xl font-bold"
                      : "bg-[#141813]/60 border-white/5 text-white/50 hover:border-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-[8px] uppercase tracking-tighter leading-none">{day.dayName}</span>
                  <span className="text-sm font-extrabold font-mono leading-none mt-1">{day.dayNum}</span>
                  
                  {/* Indicators */}
                  <div className="flex gap-0.5 mt-1">
                    {dayCompletions > 0 && (
                      <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-600" : "bg-emerald-400"}`} />
                    )}
                    {hasSleepLog && (
                      <span className={`w-1 h-1 rounded-full ${isActive ? "bg-purple-600" : "bg-purple-400"}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => {
              const d = new Date(activeDate + "T12:00:00");
              d.setDate(d.getDate() + 1);
              const maxDate = new Date().toISOString().split("T")[0];
              if (d.toISOString().split("T")[0] <= maxDate) {
                setActiveDate(d.toISOString().split("T")[0]);
              } else {
                toast("Future calendar tracking logged inactive.");
              }
            }}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Wellness & Dual tracking dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left">
        
        {/* Left widget: Overall Health stats & AI Insights */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Circular Wellness Score metric card */}
          <article className="bg-gradient-to-br from-[#121811] to-[#0a0d0a] border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-5 select-none text-emerald-500 font-bold pointer-events-none">
              <Heart className="w-32 h-32" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Heart className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Wellness Consistency</h3>
                <span className="text-[9px] text-white/40 font-mono">Habits + Sleep scoring matrix</span>
              </div>
            </div>

            <div className="flex items-center justify-center my-6 gap-6">
              {/* SVG Ring */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r={circleRadius}
                    className="stroke-zinc-850 fill-none"
                    strokeWidth="8"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r={circleRadius}
                    className="stroke-gradient fill-none transition-all duration-700 ease-out"
                    strokeWidth="8"
                    strokeDasharray={circleStrokeDash}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    stroke="url(#wellnessGrad)"
                  />
                  <defs>
                    <linearGradient id="wellnessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold text-white font-mono leading-none tracking-tighter">
                    {wellnessScore}
                  </span>
                  <span className="text-[8px] text-white/40 tracking-widest font-mono uppercase mt-0.5">% index</span>
                </div>
              </div>

              {/* Aggregated details panel */}
              <div className="space-y-2 select-none">
                <div>
                  <span className="text-[9/px] font-bold text-white/50 block font-mono">HABIT COMPLETIONS</span>
                  <strong className="text-sm font-extrabold text-[#9fdb8e] font-mono">{habitsCompletionRatePercent}%</strong>
                </div>
                <div>
                  <span className="text-[9/px] font-bold text-white/50 block font-mono">SLEEP AVERAGING</span>
                  <strong className="text-sm font-extrabold text-[#9fd4ff] font-mono">
                    {avgSleepDurationHours > 0 ? `${avgSleepDurationHours.toFixed(1)} hrs` : "N/A"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2.5 text-[10px] text-white/50">
              <span className="text-white font-bold block mb-0.5">Biometric Synopsis:</span>
              Your index aggregates overall habit streak multipliers and sleep depth consistency. Maintain 7.5+ sleep hours to secure a premium tier log.
            </div>
          </article>

          {/* AI Insights reporting box */}
          <article className="bg-[#121612] border border-[#233523]/30 rounded-2xl p-5 shadow-sm text-left flex flex-col justify-between flex-1">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-orange-400">Combined Health Insights</h3>
                </div>
                <span className="text-[8px] uppercase tracking-widest font-mono bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-400/20">AI Advisory</span>
              </div>
              <p className="text-[10px] text-white/40 mt-1">Holistic correlation analyses based on athletic sleep patterns and customized habits.</p>
            </div>

            <div className="my-4 space-y-3.5 flex-1 justify-center flex flex-col">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full bg-orange-400/10 text-orange-400 shrink-0 flex items-center justify-center mt-0.5">
                    <Sparkle className="w-2.5 h-2.5" />
                  </div>
                  <p className="text-xs text-white/80 font-medium leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-[#9fdb8e]/60 bg-emerald-950/10 rounded-xl p-2.5 border border-emerald-500/10 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Recommendations update dynamically on checking habits. Upgrade custom secrets key to trigger precision metabolic feedback.</span>
            </div>
          </article>

        </div>

        {/* Right workspace: split columns for Habits Checklist & Sleep entry logs */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* HABIT TRACKING INTERACTIVE PANEL */}
            <section className="bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between min-h-[460px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Habit checklist</h3>
                    <p className="text-[10px] text-white/40 block mt-0.5">Complete your active goals for today</p>
                  </div>
                  <div className="text-right font-mono text-xs text-white">
                    <span className="text-[#9fdb8e] font-extrabold">{completedHabitsTodayCount}</span>/{habits.length}
                    <span className="text-[9px] text-white/30 block tracking-tight">Completed</span>
                  </div>
                </div>

                {/* Progress line */}
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden relative border border-white/5 my-3">
                  <div 
                    className="h-full bg-[#10b981] rounded-full transition-all duration-500"
                    style={{ width: `${habitsCompletionRatePercent}%` }}
                  />
                </div>

                {/* Core checklist items */}
                <div className="space-y-2 mt-4 max-h-[220px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {habits.map((habit) => {
                      const isDone = habit.completedDates.includes(activeDate);
                      const habitStreak = calculateStreak(habit.completedDates);

                      return (
                        <motion.div
                          key={habit.id}
                          layout
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isDone 
                              ? "bg-emerald-500/5 border-emerald-500/20 text-white" 
                              : "bg-zinc-950/40 border-white/5 text-white/75"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Stylish Check Circular Trigger */}
                            <button
                              onClick={() => handleToggleHabit(habit.id)}
                              className={`w-5.5 h-5.5 rounded-full flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                                isDone 
                                  ? "bg-emerald-500 border-emerald-500 text-zinc-950" 
                                  : "border-white/20 hover:border-white/40 bg-zinc-900"
                              }`}
                            >
                              {isDone && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                            </button>

                            <div className="text-left min-w-0 pr-2">
                              <span className={`text-xs block font-semibold truncate ${isDone ? "line-through text-white/40 font-normal" : "text-white"}`}>
                                {habit.name}
                              </span>
                              
                              {/* Streak value badge */}
                              {habitStreak > 0 && (
                                <span className="text-[9px] font-mono text-orange-400 font-bold bg-orange-400/10 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                                  🔥 {habitStreak} Day Streak
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delete capability if custom created habit */}
                          {habit.isCustom && (
                            <button
                              onClick={() => handleDeleteHabit(habit.id, habit.name)}
                              className="w-7 h-7 rounded-full bg-white/5 border border-white/5 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete habit"
                            >
                              <Trash2 className="w-3" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Form to append custom habits */}
              <form onSubmit={handleCreateHabit} className="border-t border-white/5 pt-4 mt-4 space-y-2.5">
                <label className="text-[9px] uppercase tracking-wider text-white/40 block font-mono">Create Custom Daily Habit</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="e.g. Limit Caffeine... No Screen after 10..."
                    disabled={isAddingHabit}
                    className="flex-1 bg-zinc-950 text-white rounded-lg border border-white/10 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                    maxLength={35}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isAddingHabit}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-zinc-950 font-extrabold text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </form>
            </section>

            {/* SLEEP TRACKER INTERACTIVE PANEL */}
            <section className="bg-zinc-900/60 border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between min-h-[460px]">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sleep logger</h3>
                    <p className="text-[10px] text-white/40 block mt-0.5">Define your sleep schedules and rest quality</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Moon className="w-4.5 h-4.5 text-purple-400" />
                  </div>
                </div>

                {/* Main active layout */}
                {activeDateSleepLog ? (
                  <div className="bg-purple-950/10 border border-purple-500/10 rounded-xl p-3.5 my-3.5 text-left">
                    <span className="text-[8px] font-mono uppercase bg-purple-400/10 text-purple-400 px-2 py-0.5 rounded-all border border-purple-400/20 leading-none inline-block">Registered Session</span>
                    
                    <div className="flex justify-between items-end mt-2.5">
                      <div>
                        <strong className="text-3xl font-extrabold text-white font-mono leading-none tracking-tighter">
                          {activeDateSleepLog.hours}
                        </strong>
                        <span className="text-[10px] text-white/50 block font-normal mt-1">
                          hours recorded ({activeDateSleepLog.sleepTime} - {activeDateSleepLog.wakeTime})
                        </span>
                      </div>

                      <div className="text-sm">
                        <span className="text-[8px] text-white/40 font-mono tracking-widest block uppercase text-right">QUALITY</span>
                        <span className={`text-xs font-bold font-mono uppercase ${
                          activeDateSleepLog.quality === "Good" ? "text-emerald-400" : activeDateSleepLog.quality === "Average" ? "text-amber-300" : "text-rose-400"
                        }`}>
                          {activeDateSleepLog.quality}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-4 my-3.5 text-center text-white/40 text-xs">
                    No sleep session logged for this date. Declare hours below to chart weekly performance.
                  </div>
                )}

                {/* Sleep Logger Form element */}
                <form onSubmit={handleSaveSleep} className="space-y-3.5 mt-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 text-left">Sleep Time</label>
                      <input
                        type="time"
                        value={sleepTime}
                        onChange={(e) => setSleepTime(e.target.value)}
                        className="w-full bg-zinc-950 text-white rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-left cursor-pointer focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-white/50 text-left">Wake Time</label>
                      <input
                        type="time"
                        value={wakeTime}
                        onChange={(e) => setWakeTime(e.target.value)}
                        className="w-full bg-zinc-950 text-white rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-left cursor-pointer focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Calculated sleep hours bubble read only */}
                  <div className="bg-zinc-950 border border-white/5 p-2 rounded-xl flex justify-between items-center px-3">
                    <span className="text-[10px] text-white/50 font-semibold font-mono flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" /> CALCULATED TOTAL DURATION
                    </span>
                    <strong className="text-xs font-bold text-[#9fd4ff] font-mono">{calculatedHours} hrs</strong>
                  </div>

                  {/* Quality buttons select */}
                  <div>
                    <label className="text-[9px] font-mono uppercase tracking-wider text-white/40 block text-left mb-1.5">Sleep Quality</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["Good", "Average", "Poor"] as const).map(q => {
                        const isSel = sleepQuality === q;
                        const col = q === "Good" 
                          ? isSel ? "bg-[#10b981] text-zinc-950" : "bg-white/5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 border-white/5" 
                          : q === "Average" 
                          ? isSel ? "bg-amber-400 text-zinc-950" : "bg-white/5 hover:bg-amber-400/10 text-amber-300 hover:text-amber-200 border-white/5"
                          : isSel ? "bg-rose-500 text-zinc-950" : "bg-white/5 hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 border-white/5";
                        
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setSleepQuality(q)}
                            className={`py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${col}`}
                          >
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingSleep}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-zinc-950 hover:text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Moon className="w-3.5 h-3.5 inline" /> Save Sleep Session
                  </button>
                </form>

              </div>
            </section>

          </div>

          {/* SLEEP TREND ANALYTICS BAR CHART WIDGET */}
          <article className="bg-[#101211]/60 border border-white/5 rounded-2xl p-5 text-left">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-purple-400" /> Sleep trend history
                </h3>
                <span className="text-[10px] text-white/40 block">Last 7 nights sleep duration and relative quality</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-widest font-mono text-white/40 block">WEEKLY AVERAGE</span>
                <strong className="text-md font-extrabold text-[#9fd4ff] font-mono">
                  {avgSleepDurationHours > 0 ? `${avgSleepDurationHours.toFixed(1)} hrs/night` : "N/A"}
                </strong>
              </div>
            </div>

            {/* Custom Responsive SVG Chart Bar */}
            <div className="h-28 mt-6 flex justify-between items-end relative px-2.5 mt-2 select-none select-none select-none">
              
              {/* Reference Grid lines */}
              <div className="absolute inset-x-0 top-0 h-full border-b border-white/[0.03] pointer-events-none flex flex-col justify-between">
                <div className="border-b border-white/[0.04] w-full text-[7px] text-white/20 font-mono text-right pr-1">8h</div>
                <div className="border-b border-white/[0.04] w-full text-[7px] text-white/20 font-mono text-right pr-1">6h</div>
                <div className="border-b border-white/[0.04] w-full text-[7px] text-white/20 font-mono text-right pr-1">4h</div>
                <div className="w-full text-[7px] text-white/20 font-mono text-right pr-1">0h</div>
              </div>

              {/* Day Bars relative */}
              {weekDays.map((day, idx) => {
                const record = sleepRecords.find(r => r.date === day.dateStr);
                const hrs = record ? record.hours : 0;
                // Height ratio from 10 hours max
                const heightPercent = record ? Math.min((record.hours / 10) * 100, 100) : 0;
                
                const barColor = !record 
                  ? "bg-zinc-800/40" 
                  : record.quality === "Good" 
                  ? "bg-gradient-to-t from-purple-800 to-emerald-400" 
                  : record.quality === "Average" 
                  ? "bg-gradient-to-t from-purple-800 to-amber-300" 
                  : "bg-gradient-to-t from-purple-800 to-rose-400";

                return (
                  <div 
                    key={day.dateStr}
                    onClick={() => setActiveDate(day.dateStr)}
                    className="flex-1 flex flex-col items-center h-full gap-2 group z-10 cursor-pointer relative"
                    title={record ? `${day.dateStr}: ${record.hours}h (${record.quality} quality)` : `${day.dateStr}: No records logged`}
                  >
                    {/* Tooltip bubble on hover */}
                    <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-zinc-950 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-mono text-white text-center pointer-events-none z-50 shadow-2xl leading-tight">
                      {record ? (
                        <>
                          <strong className="text-white block">{record.hours} hrs</strong>
                          <span className="text-white/40 uppercase font-bold text-[8px]">{record.quality} Rest</span>
                        </>
                      ) : (
                        <span className="text-white/40 italic">Not Logged</span>
                      )}
                    </div>

                    {/* Bar track */}
                    <div className="w-4 sm:w-6 h-20 bg-zinc-950/40 rounded-t-sm group-hover:bg-zinc-850 transition-colors relative flex items-end">
                      {hrs > 0 && (
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-700 ${barColor}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      )}
                    </div>

                    <span className={`text-[8px] tracking-tight font-mono uppercase leading-none ${day.isToday ? "text-orange-400 font-bold" : "text-white/40"}`}>
                      {day.dayName}
                    </span>
                  </div>
                );
              })}

            </div>
          </article>

        </div>

      </div>

    </div>
  );
}
