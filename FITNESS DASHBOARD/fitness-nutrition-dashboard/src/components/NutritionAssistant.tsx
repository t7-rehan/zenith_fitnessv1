import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Sparkles, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";
import { Meal, MacroTargets, AssistantMessage } from "../types";

interface NutritionAssistantProps {
  meals: Meal[];
  goals: MacroTargets;
}

export function NutritionAssistant({ meals, goals }: NutritionAssistantProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey there! I am your AI Nutrition Coach. 🥑 I have full context of your logged meals, calorie targets, and macro score. Ask me things like:\n\n- *'Should I eat something high-protein right now?'*\n- *'Are my carbs and fats balanced?'*\n- *'Give me an actionable dinner recommendation.'*",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: AssistantMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-5), // Send last few messages for core conversation context tracking
          meals,
          goals
        })
      });

      const data = await response.json();
      
      const assistantMsg: AssistantMessage = {
        id: `assist_${Date.now()}`,
        role: "assistant",
        content: data.response || "I was unable to formulate nutrition recommendations. Please try again soon.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI Assistant network error:", error);
      const errorMsg: AssistantMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "Sorry, I can't reach the server right now. Please verify your internet connection or dev server.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (question: string) => {
    handleSend(question);
  };

  const suggestions = [
    "Should I eat something high-protein?",
    "Am I on track for my calorie goals?",
    "Recommend a healthy snack based on my macros"
  ];

  return (
    <div className="flex flex-col h-[520px] bg-zinc-900/60 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl">
      {/* Mini AI Banner Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">AI Nutrition Assistant</h3>
            <span className="text-[10px] text-white/50 block">Powered by Gemini 3.5 Flash</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 relative flex">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          </span>
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Live</span>
        </div>
      </div>

      {/* Messages Layout */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
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
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                  msg.role === "user"
                    ? "bg-orange-500/20 text-orange-200 rounded-tr-none border border-orange-500/30"
                    : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-white/5"
                }`}
              >
                {/* Parse Markdown representation roughly */}
                <div className="whitespace-pre-line space-y-1">
                  {msg.content.split("\n\n").map((para, i) => (
                    <p key={i}>
                      {para.split("*").map((chunk, j) => {
                        // Highlight alternates
                        if (j % 2 === 1) {
                          return <strong key={j} className="text-amber-400 font-bold">{chunk}</strong>;
                        }
                        return chunk;
                      })}
                    </p>
                  ))}
                </div>
              </div>
              <span className="text-[9px] text-white/30 font-mono mt-1 px-1">
                {msg.timestamp}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Coach thoughts */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 "
          >
            <div className="bg-zinc-800 border border-white/5 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-2.5">
              <RefreshCw className="animate-spin w-3.5 h-3.5 text-orange-400" />
              <span className="text-[11px] font-mono text-zinc-300">Evaluating macro balances...</span>
            </div>
          </motion.div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Preset Suggestions Row */}
      {messages.length < 3 && !isLoading && (
        <div className="px-4 py-2 flex flex-col gap-1.5 border-t border-white/5 bg-zinc-950/10">
          <span className="text-[9px] uppercase tracking-wider font-mono text-white/30">Suggestions Quick Tap</span>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestion(suggestion)}
                className="text-left text-[11px] text-white/70 hover:text-orange-300 bg-white/5 hover:bg-white/10 border border-white/5 py-1 px-2.5 rounded-lg transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message Sender Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(inputText);
        }}
        className="p-3 border-t border-white/5 bg-zinc-950/20 flex gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Coach... (e.g. recommend some snacks)"
          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl border border-white/10 text-white placeholder-white/30 bg-zinc-900 focus:outline-none focus:border-orange-500/50 text-xs transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="min-h-[38px] px-4 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold transition-all flex items-center justify-center cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
