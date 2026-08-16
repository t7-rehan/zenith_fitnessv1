import React, { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { MacroTargets } from "../types";

interface QuickGoalsModalProps {
  currentGoals: MacroTargets;
  onSave: (newGoals: MacroTargets) => Promise<void>;
  onClose: () => void;
}

export function QuickGoalsModal({ currentGoals, onSave, onClose }: QuickGoalsModalProps) {
  const [calories, setCalories] = useState(currentGoals.calories);
  const [protein, setProtein] = useState(currentGoals.protein);
  const [carbs, setCarbs] = useState(currentGoals.carbs);
  const [fats, setFats] = useState(currentGoals.fats);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats)
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden relative shadow-2xl animate-cardIn">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white tracking-tight">Adjust Calorie & Macro Goals</h2>
          <p className="text-xs text-white/50 mt-1">
            Setting your goals dictates how macro charts, balances, and AI comments evaluate your progress.
          </p>
        </div>

        {/* Setting Inputs Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
                Daily Calories (kcal)
              </label>
              <input
                type="number"
                min="500"
                max="10000"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="min-h-[38px] px-3 rounded-xl border border-white/10 text-white bg-zinc-950 focus:outline-none focus:border-amber-400 text-xs text-center"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
                Daily Protein (g)
              </label>
              <input
                type="number"
                min="10"
                max="500"
                value={protein}
                onChange={(e) => setProtein(Number(e.target.value))}
                className="min-h-[38px] px-3 rounded-xl border border-white/10 text-white bg-zinc-950 focus:outline-none focus:border-emerald-400 text-xs text-center"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
                Daily Carbs (g)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={carbs}
                onChange={(e) => setCarbs(Number(e.target.value))}
                className="min-h-[38px] px-3 rounded-xl border border-white/10 text-white bg-zinc-950 focus:outline-none focus:border-amber-400 text-xs text-center"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/60 font-mono uppercase tracking-wider">
                Daily Fats (g)
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={fats}
                onChange={(e) => setFats(Number(e.target.value))}
                className="min-h-[38px] px-3 rounded-xl border border-white/10 text-white bg-zinc-950 focus:outline-none focus:border-orange-400 text-xs text-center"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[38px] rounded-xl border border-white/10 text-white transition-opacity text-xs hover:bg-white/5 active:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 min-h-[38px] rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold transition-all text-xs text-zinc-950 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="animate-spin w-3.5 h-3.5" />
                  Updating...
                </>
              ) : (
                "Save Goals"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
