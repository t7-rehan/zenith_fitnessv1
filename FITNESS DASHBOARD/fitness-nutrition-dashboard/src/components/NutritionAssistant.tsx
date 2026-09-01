import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Sparkles,
  RefreshCw,
  Server,
  Settings,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Trash2,
  Zap,
  Flame,
  Dumbbell,
  Moon,
  ChevronRight,
  ShieldCheck,
  Info
} from "lucide-react";
import { Meal, MacroTargets, AssistantMessage, Habit, SleepRecord } from "../types";
import {
  apiFetch,
  getBackendUrl,
  setBackendUrl,
  testBackendConnection,
  generateSmartLocalCoachResponse,
  BackendStatus
} from "../lib/api";

interface NutritionAssistantProps {
  meals: Meal[];
  goals: MacroTargets;
  habits?: Habit[];
  sleepRecords?: SleepRecord[];
  athleteName?: string;
}

export function NutritionAssistant({
  meals,
  goals,
  habits = [],
  sleepRecords = [],
  athleteName = "Athlete"
}: NutritionAssistantProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hey ${athleteName}! 🥑 I am your Zenith Athletic AI Coach, calibrated to your metabolic blueprint.\n\nI have live context of your logged meals today, target macros, hydration habits, and recovery logs.\n\nTap a quick workout/macro chip below or ask me anything!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Backend connection status state
  const [showSettings, setShowSettings] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(getBackendUrl());
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
    url: getBackendUrl() || "Auto (Render / Vercel)"
  });
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [engineMode, setEngineMode] = useState<"gemini" | "smart-local">("gemini");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Initial check on backend connectivity
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async (customUrl?: string) => {
    setIsTestingConn(true);
    try {
      const status = await testBackendConnection(customUrl);
      setBackendStatus(status);
      if (status.connected) {
        setEngineMode("gemini");
      }
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleSaveSettings = () => {
    setBackendUrl(backendUrlInput);
    checkConnection(backendUrlInput);
    setShowSettings(false);
  };

  // Calculate live macro stats for quick coach HUD
  const totals = meals.reduce(
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

  // Text to Speech
  const handleSpeak = (id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`•-]/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Copy to clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: AssistantMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      // 1. Attempt call to fullstack backend (Render / Vercel API)
      const data = await apiFetch<{ response: string; isConfigured?: boolean }>(
        "/api/assistant/ask",
        {
          method: "POST",
          body: JSON.stringify({
            message: textToSend,
            history: messages.slice(-5),
            meals,
            goals,
            habits,
            sleepLogs: sleepRecords,
            athleteName
          })
        },
        12000 // 12s timeout
      );

      const assistantMsg: AssistantMessage = {
        id: `assist_${Date.now()}`,
        role: "assistant",
        content: data.response || "Nutritional recommendation formulated.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setEngineMode("gemini");
      setBackendStatus((prev) => ({ ...prev, connected: true, message: "Connected" }));
    } catch (error: any) {
      console.warn("Backend unavailable or cold-starting, executing Smart Offline Coach engine:", error);

      // 2. Intelligent Sports-Science fallback engine
      const localResponse = generateSmartLocalCoachResponse({
        message: textToSend,
        meals,
        goals,
        habits,
        sleepLogs: sleepRecords
      });

      const assistantMsg: AssistantMessage = {
        id: `assist_local_${Date.now()}`,
        role: "assistant",
        content: localResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setEngineMode("smart-local");
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    {
      label: "🥩 High Protein Snack (<250 kcal)",
      query: "Recommend high-protein snacks under 250 calories to help hit my daily goal."
    },
    {
      label: "⚖️ Macro Balance Analysis",
      query: "Analyze my remaining calories and macros today and tell me what to focus on."
    },
    {
      label: "🍽️ Actionable Dinner Idea",
      query: "Suggest a healthy, delicious dinner tailored to my remaining calories and macros."
    },
    {
      label: "⚡ Pre-Workout Fueling",
      query: "What should I eat 60-90 minutes before my workout for peak energy and recovery?"
    },
    {
      label: "💧 Hydration & Sleep Synergy",
      query: "How does my sleep and hydration affect my muscle building and fat loss today?"
    }
  ];

  return (
    <div className="flex flex-col h-[600px] bg-zinc-900/70 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-2xl shadow-2xl relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Zenith Athletic AI Coach</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                Gemini 2.5 Flash
              </span>
            </div>
            <span className="text-[11px] text-white/50 block">
              Sports-Science & Metabolic Performance Assistant
            </span>
          </div>
        </div>

        {/* Status Pill & Settings trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border transition-all cursor-pointer ${
              backendStatus.connected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
            }`}
            title="Configure Backend Connection URL"
          >
            <span className="w-2 h-2 rounded-full relative flex">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  backendStatus.connected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  backendStatus.connected ? "bg-emerald-500" : "bg-amber-500"
                }`}
              ></span>
            </span>
            <span>{backendStatus.connected ? "Render Live" : "Smart Engine"}</span>
            <Settings className="w-3 h-3 ml-0.5 opacity-60 hover:opacity-100" />
          </button>

          {messages.length > 2 && (
            <button
              onClick={() => {
                if (window.confirm("Clear conversation history?")) {
                  setMessages([
                    {
                      id: "welcome_reset",
                      role: "assistant",
                      content: `Fresh session initialized for **${athleteName}**. How can I assist your athletic routine?`,
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    }
                  ]);
                }
              }}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer"
              title="Clear Chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Backend Settings Modal / Drawer */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-white/10 bg-zinc-950/90 px-5 py-4 space-y-3 z-20 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Server className="w-4 h-4 text-orange-400" />
                <span>Backend Connection Configuration</span>
              </div>
              <span className="text-[10px] text-white/40 font-mono">
                {backendStatus.message || "Checking status..."}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-white/60 block">
                Render Backend URL (e.g. <code className="text-orange-400 font-mono">https://your-service.onrender.com</code>):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder="https://zenith-fitnessv1.onrender.com (or leave empty for relative /api)"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  disabled={isTestingConn}
                  onClick={() => checkConnection(backendUrlInput)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isTestingConn ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Ping Test"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-white/40 bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <span>
                <strong>Render Free Tier Note:</strong> Render free tier instances take ~30–50s to wake up from idle.
                When waking up or offline, the Coach seamlessly uses its built-in sports-science algorithmic engine so you get instant answers.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Athlete Metric Snapshot Pill Bar */}
      <div className="px-5 py-2.5 bg-zinc-950/20 border-b border-white/5 flex items-center justify-between text-xs overflow-x-auto custom-scrollbar gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" />
            Remaining:
          </span>
          <span className={`font-mono font-bold ${calLeft >= 0 ? "text-orange-300" : "text-red-400"}`}>
            {calLeft} kcal
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 flex items-center gap-1">
            <Dumbbell className="w-3 h-3 text-emerald-400" />
            Protein:
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {totals.protein}g <span className="text-white/40 font-normal">/ {goals.protein}g</span>
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-mono text-white/40 flex items-center gap-1">
            <Moon className="w-3 h-3 text-sky-400" />
            Recovery:
          </span>
          <span className="font-mono font-bold text-sky-300">
            {sleepRecords?.[0]?.hours ? `${sleepRecords[0].hours} hrs` : "Logged"}
          </span>
        </div>
      </div>

      {/* Messages Layout */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] px-4 py-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-lg transition-all ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-orange-500/25 to-amber-500/20 text-orange-100 rounded-tr-none border border-orange-500/30"
                    : "bg-zinc-800/90 text-zinc-100 rounded-tl-none border border-white/10"
                }`}
              >
                {/* Formatted Markdown Content */}
                <div className="whitespace-pre-line space-y-1.5">
                  {msg.content.split("\n\n").map((para, i) => (
                    <p key={i} className="leading-relaxed">
                      {para.split("**").map((chunk, j) => {
                        if (j % 2 === 1) {
                          return (
                            <strong key={j} className="text-amber-300 font-bold">
                              {chunk}
                            </strong>
                          );
                        }
                        return chunk;
                      })}
                    </p>
                  ))}
                </div>

                {/* Assistant Message Actions (TTS & Copy) */}
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/5 text-white/40">
                    <span className="text-[9px] font-mono text-white/30">
                      {msg.timestamp}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                          speakingId === msg.id ? "text-orange-400 animate-pulse" : "text-white/40 hover:text-white"
                        }`}
                        title={speakingId === msg.id ? "Stop voice" : "Read out loud"}
                      >
                        {speakingId === msg.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {msg.role === "user" && (
                  <div className="text-right text-[9px] font-mono text-orange-200/50 mt-1">
                    {msg.timestamp}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <div className="bg-zinc-800 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-3 shadow-lg">
              <RefreshCw className="animate-spin w-4 h-4 text-orange-400" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">AI Coach is calibrating response...</span>
                <span className="text-[10px] font-mono text-white/40">Evaluating macronutrients & metabolic burn</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick Action Chips Drawer */}
      {!isLoading && (
        <div className="px-4 py-2 border-t border-white/5 bg-zinc-950/30 flex gap-2 overflow-x-auto custom-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p.query)}
              className="shrink-0 text-left text-[11px] text-white/80 hover:text-orange-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 py-1.5 px-3 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>{p.label}</span>
              <ChevronRight className="w-3 h-3 opacity-40" />
            </button>
          ))}
        </div>
      )}

      {/* Message Sender Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputText);
        }}
        className="p-4 border-t border-white/10 bg-zinc-950/40 flex gap-2.5"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Coach... (e.g., 'What high-protein snack can I have right now?')"
          className="flex-1 min-h-[44px] px-4 py-2 rounded-2xl border border-white/10 text-white placeholder-white/30 bg-zinc-900/90 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs transition-all shadow-inner"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="min-h-[44px] px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-orange-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
