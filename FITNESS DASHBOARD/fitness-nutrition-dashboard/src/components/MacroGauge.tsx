import { motion } from "motion/react";
import { Meal, MacroTargets } from "../types";

export interface MacroGaugeProps {
  meals: Meal[];
  goals: MacroTargets;
}

export function MacroGauge({ meals, goals }: MacroGaugeProps) {
  // 1. Calculate nutrient totals
  const totals = meals.reduce(
    (acc, meal) => {
      acc.calories += Number(meal.calories || 0);
      acc.protein += Number(meal.protein || 0);
      acc.carbs += Number(meal.carbs || 0);
      acc.fats += Number(meal.fats || 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  // 2. Proportions
  const macroCals = {
    protein: totals.protein * 4,
    carbs: totals.carbs * 4,
    fats: totals.fats * 9
  };

  const macroSum = macroCals.protein + macroCals.carbs + macroCals.fats || 1;
  const proteinShare = macroCals.protein / macroSum;
  const carbsShare = macroCals.carbs / macroSum;
  const fatsShare = macroCals.fats / macroSum;

  // Standard target splits: 30% Protein, 45% Carbs, 25% Fats
  const targetSplit = { protein: 0.30, carbs: 0.45, fats: 0.25 };

  // Combined deviation
  const deviation =
    Math.abs(proteinShare - targetSplit.protein) +
    Math.abs(carbsShare - targetSplit.carbs) +
    Math.abs(fatsShare - targetSplit.fats);

  // Calorie alignment
  const goalCalories = goals.calories || 2200;
  const goalFit = 1 - Math.abs(totals.calories - goalCalories) / goalCalories;
  
  // Calculate final score
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  const normalizedGoalFit = clamp(goalFit, 0, 1);
  const balance = totals.calories > 0
    ? Math.round(clamp((1 - deviation) * 70 + normalizedGoalFit * 30, 0, 100))
    : 0;

  // Needle angle: -45 deg to +45 deg mapped to 0% - 100%
  const needleAngle = (balance / 100) * 90 - 45;

  // Feedback Content
  let title = "Log meals to evaluate";
  let copy = "Add breakfast, lunch, dinner or recovery snacks to see how your macros align with high-performance splits.";
  let badgeColor = "bg-zinc-800 text-zinc-300";

  if (totals.calories > 0) {
    if (balance >= 80) {
      title = "Excellent Energy & Recovery";
      copy = "Your current nutrient partition aligns perfectly with a premium recovery split. Keep up this momentum!";
      badgeColor = "bg-emerald-950/80 text-emerald-400 border border-emerald-500/20";
    } else if (balance >= 55) {
      title = "Balanced Nutrition State";
      copy = "Good alignment observed. Consider slightly boosting lean proteins to refine macro distribution.";
      badgeColor = "bg-amber-950/80 text-amber-400 border border-amber-500/20";
    } else {
      title = "Needs Micro Adjustments";
      copy = "Significant macros gap detected. Try incorporating healthy fats or clean complex carbs to recover.";
      badgeColor = "bg-rose-950/80 text-rose-400 border border-rose-500/20";
    }
  }

  return (
    <div className="flex flex-col h-full justify-between gap-4">
      {/* Dynamic visual indicator row */}
      <div className="flex justify-between items-center px-1" aria-hidden="true">
        {["P", "C", "F", "K", "W", "G"].map((letter) => (
          <span
            key={letter}
            className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-mono font-bold bg-[#141813] border border-white/10 text-white/70"
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Speedometer Gauge Dial Canvas */}
      <div className="relative w-full max-w-[200px] mx-auto aspect-[1.5] mt-6 flex flex-col items-center justify-end select-none">
        {/* Speedometer Arc and Needle container */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: "ellipse(100% 100% at 50% 100%)" }}>
          <div className="absolute inset-0 bg-[#1d231b] opacity-80" />
          
          {/* Main conic sweep resembling multi-zone meter: Red -> Gold -> Green */}
          <div 
            className="absolute inset-0"
            style={{
              background: "conic-gradient(from 270deg at 50% 100%, #ff6b6b 0deg, #ffc247 54deg, #9fdb8e 108deg, rgba(255,255,255,0.08) 108deg 180deg, transparent 180deg)",
              maskImage: "radial-gradient(circle at 50% 100%, transparent 58%, black 59%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 100%, transparent 58%, black 59%)"
            }}
          />
        </div>

        {/* Rotatable Needle Element */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-[82%] bg-white origin-bottom z-10 rounded-full"
          style={{ 
            transform: `translateX(-50%) rotate(${needleAngle}deg)`,
            transition: "transform 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
            boxShadow: "0 0 10px rgba(255,255,255,0.7)"
          }}
        />

        {/* High-Contrast Percent Readout */}
        <div className="relative flex flex-col items-center z-10 translate-y-2">
          <span className="text-3xl font-sans tracking-tight font-extrabold text-white">
            {balance}%
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider text-white/50">
            Split Balance
          </span>
        </div>
      </div>

      {/* Textual descriptions corresponding to scores */}
      <div className="flex flex-col items-center text-center mt-3 gap-1">
        <h3 className="text-sm font-sans font-bold text-white tracking-tight leading-snug">
          {title}
        </h3>
        <p className="text-xs text-white/70 line-clamp-3 px-1 leading-normal">
          {copy}
        </p>
        {totals.calories > 0 && (
          <span className={`inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-full ${badgeColor}`}>
            Active Evaluation
          </span>
        )}
      </div>
    </div>
  );
}
