import { motion } from "motion/react";

export function MealRhythmChart() {
  return (
    <div className="relative w-full h-[100px] mt-2 select-none">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 220 82" role="img" aria-label="Weekly meal rhythm">
        {/* Grid Lines */}
        <line x1="10" y1="66" x2="210" y2="66" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
        <line x1="10" y1="42" x2="210" y2="42" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />
        <line x1="10" y1="18" x2="210" y2="18" stroke="rgba(255, 255, 255, 0.07)" strokeWidth="1" />

        {/* Ambient curves with responsive stroke dash alignment */}
        <motion.path
          d="M10 66 C35 66,35 28,60 28 S84 58,108 42 130 20,152 24 170 14,210 14"
          fill="none"
          stroke="#ffc247"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        <motion.path
          d="M10 68 C32 68,38 50,62 50 S86 22,110 26 124 58,150 40 168 30,210 30"
          fill="none"
          stroke="#9fdb8e"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
}

export function WellnessWaveChart() {
  return (
    <div className="relative w-full h-[110px] mt-2 select-none">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 420 110" role="img" aria-label="Nutrition score trend">
        {/* Wave background curves representing dynamic metabolic levels */}
        <motion.path
          d="M0 60 C40 20,70 90,110 54 S180 10,220 52 290 96,330 56 385 28,420 62"
          fill="none"
          stroke="rgba(247, 245, 237, 0.24)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        <motion.path
          d="M0 74 C42 94,70 42,116 72 S184 98,220 66 288 22,330 48 382 88,420 66"
          fill="none"
          stroke="#e8ac61"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, ease: "easeInOut", delay: 0.1 }}
        />

        <motion.path
          d="M0 72 C46 52,74 80,118 46 S180 32,220 58 286 86,330 62 382 44,420 72"
          fill="none"
          stroke="#f06565"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.4, ease: "easeInOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
}
