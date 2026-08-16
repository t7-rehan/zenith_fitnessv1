import React, { useState, useEffect } from "react";
import { X, Calculator, CircleHelp, Sparkles, Scale, Info, Check, Dumbbell } from "lucide-react";
import { MacroTargets } from "../types";

interface CalorieCalculatorModalProps {
  currentGoals: MacroTargets;
  onSave: (newGoals: MacroTargets) => Promise<void>;
  onClose: () => void;
  toast: (msg: string) => void;
}

export function CalorieCalculatorModal({ currentGoals, onSave, onClose, toast }: CalorieCalculatorModalProps) {
  // Unit System state: 'metric' (kg, cm) or 'imperial' (lbs, feet & inches)
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("imperial");
  
  // Basic attributes
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState<number>(26);
  
  // Metric values
  const [weightKg, setWeightKg] = useState<number>(75);
  const [heightCm, setHeightCm] = useState<number>(175);

  // Imperial values
  const [weightLbs, setWeightLbs] = useState<number>(165);
  const [heightFeet, setHeightFeet] = useState<number>(5);
  const [heightInches, setHeightInches] = useState<number>(9);

  // Activity Levels matching standard Mifflin multipliers
  // - Sedentary (BMR * 1.2)
  // - Light Activity (BMR * 1.375)
  // - Moderate Activity (BMR * 1.55)
  // - Very Active (BMR * 1.725)
  // - Extra Active (BMR * 1.9)
  const [activityLevel, setActivityLevel] = useState<number>(1.55); // moderate default

  // Weight goal: offset calorie modifier
  // - Maintain: 0
  // - Mild Loss (-250 kcal)
  // - Standard Loss (-500 kcal)
  // - Extreme Loss (-1000 kcal)
  // - Mild Gain (+250 kcal)
  // - Standard Gain (+500 kcal)
  // - Extreme Gain (+1000 kcal)
  const [weightGoalOffset, setWeightGoalOffset] = useState<number>(0); 
  const [goalLabel, setGoalLabel] = useState<string>("maintain");

  // Macro Target split selections
  // - balanced: 40% Carb, 30% Protein, 30% Fat
  // - high_protein: 30% Carb, 40% Protein, 30% Fat
  // - low_carb: 15% Carb, 35% Protein, 50% Fat
  // - performance: 50% Carb, 25% Protein, 25% Fat
  const [macroSplit, setMacroSplit] = useState<"balanced" | "high_protein" | "low_carb" | "performance">("balanced");

  // Results computed on-the-fly
  const [computedBmr, setComputedBmr] = useState<number>(1700);
  const [computedTdee, setComputedTdee] = useState<number>(2635);
  const [targetCalories, setTargetCalories] = useState<number>(2635);
  const [targetProtein, setTargetProtein] = useState<number>(198);
  const [targetCarbs, setTargetCarbs] = useState<number>(264);
  const [targetFats, setTargetFats] = useState<number>(88);

  const [isSaving, setIsSaving] = useState(false);

  // Sync state between unit systems when changing tabs to prevent sudden extreme drops
  const toggleUnitSystem = (system: "metric" | "imperial") => {
    if (system === "metric" && unitSystem === "imperial") {
      // Imperial to Metric conversion
      const convertedKg = Math.round(weightLbs * 0.45359237);
      const totalInches = (heightFeet * 12) + heightInches;
      const convertedCm = Math.round(totalInches * 2.54);
      setWeightKg(convertedKg);
      setHeightCm(convertedCm);
    } else if (system === "imperial" && unitSystem === "metric") {
      // Metric to Imperial conversion
      const convertedLbs = Math.round(weightKg / 0.45359237);
      const totalInches = heightCm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      setWeightLbs(convertedLbs);
      setHeightFeet(feet);
      setHeightInches(inches);
    }
    setUnitSystem(system);
  };

  // Run Mifflin-St Jeor computation automatically upon input configuration updates
  useEffect(() => {
    // 1. Compute weight in kg and height in cm
    let finalWeightKg = weightKg;
    let finalHeightCm = heightCm;

    if (unitSystem === "imperial") {
      finalWeightKg = weightLbs * 0.45359237;
      const totalInches = (heightFeet * 12) + heightInches;
      finalHeightCm = totalInches * 2.54;
    }

    if (isNaN(finalWeightKg) || isNaN(finalHeightCm) || isNaN(age) || age <= 0) {
      return;
    }

    // 2. Mifflin-St Jeor formula implementation
    // Men: BMR = 10W + 6.25H - 5A + 5
    // Women: BMR = 10W + 6.25H - 5A - 161
    let bmr = (10 * finalWeightKg) + (6.25 * finalHeightCm) - (5 * age);
    if (gender === "male") {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    bmr = Math.round(bmr);
    setComputedBmr(bmr);

    // 3. TDEE = BMR * activityCoefficient
    const tdee = Math.round(bmr * activityLevel);
    setComputedTdee(tdee);

    // 4. Target Calories = TDEE + weightGoalOffset
    // Guard against dangerous calorie levels (minimum floor of 1200 kcal for safety)
    let finalCal = Math.round(tdee + weightGoalOffset);
    if (finalCal < 1200) {
      finalCal = 1200;
    }
    setTargetCalories(finalCal);

    // 5. Calculate Macros based on selected ratio splits
    // Macros calories per gram: Protein = 4 kcal, Carbs = 4 kcal, Fats = 9 kcal
    let pRatio = 0.30;
    let cRatio = 0.40;
    let fRatio = 0.30;

    switch (macroSplit) {
      case "high_protein":
        pRatio = 0.40;
        cRatio = 0.30;
        fRatio = 0.30;
        break;
      case "low_carb":
        pRatio = 0.25;
        cRatio = 0.15;
        fRatio = 0.60;
        break;
      case "performance":
        pRatio = 0.25;
        cRatio = 0.50;
        fRatio = 0.25;
        break;
      case "balanced":
      default:
        pRatio = 0.30;
        cRatio = 0.40;
        fRatio = 0.30;
        break;
    }

    const calculatedProteinGrams = Math.round((finalCal * pRatio) / 4);
    const calculatedCarbsGrams = Math.round((finalCal * cRatio) / 4);
    const calculatedFatsGrams = Math.round((finalCal * fRatio) / 9);

    setTargetProtein(calculatedProteinGrams);
    setTargetCarbs(calculatedCarbsGrams);
    setTargetFats(calculatedFatsGrams);

  }, [
    unitSystem,
    gender,
    age,
    weightKg,
    heightCm,
    weightLbs,
    heightFeet,
    heightInches,
    activityLevel,
    weightGoalOffset,
    macroSplit
  ]);

  const handleApplyGoals = async () => {
    setIsSaving(true);
    try {
      await onSave({
        calories: targetCalories,
        protein: targetProtein,
        carbs: targetCarbs,
        fats: targetFats
      });
      toast(`Success! Calories set to ${targetCalories} kcal with ${macroSplit} split.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast("Error applying calculated parameters.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="calorie-calculator-modal" className="bg-[#0b0e0a] border border-white/10 rounded-2xl w-full max-w-2xl p-5 md:p-7 relative shadow-3xl text-left flex flex-col md:max-h-[90vh]">
        
        {/* Top Header Row */}
        <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <Calculator className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                Dynamic Calorie Calculator
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-mono px-1.5 py-0.5 rounded uppercase font-semibold">Mifflin-St Jeor</span>
              </h2>
              <p className="text-[10px] md:text-xs text-white/50 mt-0.5">
                Calculate your custom daily energy expenditure and optimize physical goals.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Dynamic Multi-column body layout scrollable on small devices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:overflow-y-auto pr-0 md:pr-1 flex-1 py-1">
          
          {/* LEFT COLUMN: PARAMETER SELECTION INPUTS */}
          <div className="space-y-4">
            
            {/* Unit Toggle and Gender selection */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Unit System</span>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => toggleUnitSystem("imperial")}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                      unitSystem === "imperial"
                        ? "bg-white/10 text-white font-black"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Imperial
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleUnitSystem("metric")}
                    className={`flex-1 py-1 text-[10px] font-mono font-bold rounded-lg transition-all ${
                      unitSystem === "metric"
                        ? "bg-white/10 text-white font-black"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Metric
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Biological Sex</span>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`flex-1 py-1 text-[10px] font-mono rounded-lg transition-all ${
                      gender === "male"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "text-white/40 hover:text-white border border-transparent"
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`flex-1 py-1 text-[10px] font-mono rounded-lg transition-all ${
                      gender === "female"
                        ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                        : "text-white/40 hover:text-white border border-transparent"
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>
            </div>

            {/* Age, Weight, Height */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 bg-zinc-950 p-2.5 rounded-xl border border-white/5">
                <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Age (years)</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm mt-0.5 text-center"
                />
              </div>

              {unitSystem === "metric" ? (
                <>
                  <div className="flex flex-col gap-1 bg-zinc-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Weight (kg)</span>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Math.max(10, Number(e.target.value)))}
                      className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm mt-0.5 text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1 bg-zinc-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Height (cm)</span>
                    <input
                      type="number"
                      min="50"
                      max="270"
                      value={heightCm}
                      onChange={(e) => setHeightCm(Math.max(50, Number(e.target.value)))}
                      className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm mt-0.5 text-center"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1 bg-zinc-950 p-2.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Weight (lbs)</span>
                    <input
                      type="number"
                      min="20"
                      max="1000"
                      value={weightLbs}
                      onChange={(e) => setWeightLbs(Math.max(20, Number(e.target.value)))}
                      className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm mt-0.5 text-center"
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
                    <div className="flex-1 flex flex-col gap-1 bg-zinc-950 p-2 rounded-xl border border-white/5 relative">
                      <span className="text-[7.5px] font-mono uppercase tracking-wider text-white/40 text-center">Ft</span>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={heightFeet}
                        onChange={(e) => setHeightFeet(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm text-center"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 bg-zinc-950 p-2 rounded-xl border border-white/5 relative">
                      <span className="text-[7.5px] font-mono uppercase tracking-wider text-white/40 text-center">In</span>
                      <input
                        type="number"
                        min="0"
                        max="11"
                        value={heightInches}
                        onChange={(e) => setHeightInches(Math.max(0, Math.min(11, Number(e.target.value))))}
                        className="w-full bg-transparent border-0 text-white font-extrabold focus:outline-none focus:ring-0 text-sm text-center"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Physical Activity Selector */}
            <div className="flex flex-col gap-1 bg-zinc-950 p-3 rounded-xl border border-white/5 space-y-1.5">
              <span className="text-[8px] font-mono uppercase tracking-wider text-white/40 block">Daily Activity Index</span>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(Number(e.target.value))}
                className="w-full min-h-[38px] rounded-lg border border-white/10 bg-zinc-900 text-white px-2.5 focus:outline-none focus:border-orange-500 text-xs cursor-pointer"
              >
                <option value={1.2}>Sedentary (desk work, minimal physical exertion)</option>
                <option value={1.375}>Lightly Active (light workouts 1-3 days/week)</option>
                <option value={1.55}>Moderately Active (moderate workouts 3-5 days/week)</option>
                <option value={1.725}>Very Active (vigorous exercise 6-7 days/week)</option>
                <option value={1.9}>Extra Active (intense manual labor or competitive athletic regime)</option>
              </select>
            </div>

            {/* Weight Goal Selection & Offset */}
            <div className="flex flex-col gap-1 bg-zinc-950 p-3 rounded-xl border border-white/5 space-y-2">
              <span className="text-[8px] font-mono uppercase tracking-wider text-white/40 block">Primary Weight Goal Target</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { offset: -1000, label: "Extreme Weight Loss (-1000 kcal)", id: "extreme_loss" },
                  { offset: -500, label: "Weight Loss (-500 kcal)", id: "loss" },
                  { offset: -250, label: "Mild Weight Loss (-250 kcal)", id: "mild_loss" },
                  { offset: 0, label: "Weight Maintenance (0 kcal)", id: "maintain" },
                  { offset: 250, label: "Mild Muscle Gain (+250 kcal)", id: "mild_gain" },
                  { offset: 500, label: "Muscle Gain (+500 kcal)", id: "gain" },
                  { offset: 1000, label: "Extreme Mass Gain (+1000 kcal)", id: "extreme_gain" }
                ].map((preset) => {
                  const isCurrent = weightGoalOffset === preset.offset && goalLabel === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setWeightGoalOffset(preset.offset);
                        setGoalLabel(preset.id);
                      }}
                      className={`text-[9px] font-sans py-1.5 px-2 rounded-lg border transition-all text-left flex items-center justify-between ${
                        isCurrent
                          ? "bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold"
                          : "bg-zinc-900 border-white/5 text-white/60 hover:text-white"
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isCurrent && <Check className="w-3 h-3 text-orange-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: COMPUTED METADATA, MACROS SPLIT AND PREVIEW */}
          <div className="bg-zinc-950 p-4 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
            
            {/* Live Outputs indicators */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">Calculation Summary</span>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-orange-400 animate-pulse" />
                  <span className="text-[8px] font-mono text-orange-400 uppercase font-semibold">TDEE Adjusted Target</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-b border-white/5 pb-3">
                <div className="text-center">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">BMR</span>
                  <span className="text-sm font-black text-white block mt-0.5">{computedBmr}</span>
                  <span className="text-[7.5px] font-mono text-white/30 block mt-0.2">basal state kcal</span>
                </div>
                <div className="text-center border-x border-white/5">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">Active TDEE</span>
                  <span className="text-sm font-black text-orange-400 block mt-0.5">{computedTdee}</span>
                  <span className="text-[7.5px] font-mono text-white/30 block mt-0.2">maintenance kcal</span>
                </div>
                <div className="text-center">
                  <span className="text-[8px] font-mono text-white/40 block uppercase">Adjusted Goal</span>
                  <span className="text-sm font-black text-emerald-400 block mt-0.5">{targetCalories}</span>
                  <span className="text-[7.5px] font-mono text-white/30 block mt-0.2">target intake kcal</span>
                </div>
              </div>
            </div>

            {/* Macro Ratio Split Selector */}
            <div className="space-y-2">
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 block">Nutrition Fuel Distribution</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "balanced", label: "Balanced (30%P / 40%C / 30%F)", desc: "Daily maintenance / general fitness" },
                  { id: "high_protein", label: "High Protein (40%P / 30%C / 30%F)", desc: "Build muscle, increase thermogenesis" },
                  { id: "low_carb", label: "Ketogenic (25%P / 15%C / 60%F)", desc: "Low carb fat-oxidation focus" },
                  { id: "performance", label: "Performance (25%P / 50%C / 25%F)", desc: "Cardio athletes / glycolytic intense work" }
                ].map((split) => {
                  const isCurrent = macroSplit === split.id;
                  return (
                    <button
                      key={split.id}
                      type="button"
                      onClick={() => setMacroSplit(split.id as any)}
                      className={`text-[9px] text-left p-2 rounded-xl border transition-all flex flex-col justify-between ${
                        isCurrent 
                          ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-300" 
                          : "bg-zinc-900/50 border-white/5 hover:border-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      <strong className="text-[10px] font-bold block">{split.label}</strong>
                      <span className="text-[8px] text-white/40 block mt-0.5 leading-tight">{split.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Computed Gram targets live preview */}
            <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 space-y-2">
              <span className="text-[8px] font-mono uppercase tracking-wider text-white/40 block text-center">Calculated Macro Grams</span>
              <div className="grid grid-cols-3 gap-2">
                
                {/* Protein */}
                <div className="bg-zinc-950 p-2 rounded-lg border border-emerald-500/10 text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-emerald-400" />
                  <span className="text-[8px] font-mono text-[#9fdb8e] block uppercase font-black">Protein</span>
                  <strong className="text-base text-white font-extrabold block mt-0.5">{targetProtein}g</strong>
                  <span className="text-[8px] font-mono text-white/40 block leading-tight mt-0.2">{(targetProtein * 4)} kcal</span>
                </div>

                {/* Carbs */}
                <div className="bg-zinc-950 p-2 rounded-lg border border-amber-500/10 text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-amber-400" />
                  <span className="text-[8px] font-mono text-amber-300 block uppercase font-black">Carbs</span>
                  <strong className="text-base text-white font-extrabold block mt-0.5">{targetCarbs}g</strong>
                  <span className="text-[8px] font-mono text-white/40 block leading-tight mt-0.2">{(targetCarbs * 4)} kcal</span>
                </div>

                {/* Fats */}
                <div className="bg-zinc-950 p-2 rounded-lg border border-orange-500/10 text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-orange-400" />
                  <span className="text-[8px] font-mono text-orange-400 block uppercase font-black">Fats</span>
                  <strong className="text-base text-white font-extrabold block mt-0.5">{targetFats}g</strong>
                  <span className="text-[8px] font-mono text-white/40 block leading-tight mt-0.2">{(targetFats * 9)} kcal</span>
                </div>

              </div>
            </div>

            {/* Visual warning on targets below safe levels */}
            {targetCalories <= 1350 && (
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-bounce" />
                <p className="text-[8.5px] leading-relaxed text-amber-200">
                  <strong>Notice:</strong> Your current intake plan targets calories close to standard physiological baselines. Consult a trainer or nutrition advisor before maintaining very low calories long-term.
                </p>
              </div>
            )}

            {/* Action apply parameters buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-xl text-[10px] font-mono font-bold border border-white/10 text-white/60 hover:text-white transition-all bg-white/5 shrink-0"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleApplyGoals}
                disabled={isSaving}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-zinc-950 text-[10px] font-black tracking-tight flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-orange-500/10 font-bold transition-transform hover:scale-[1.01]"
              >
                {isSaving ? "Calculating & Syncing..." : "Apply Calorie Goals & Sync"}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
