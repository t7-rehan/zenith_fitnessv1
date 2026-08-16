import { Home, Apple, BarChart3, Settings, Milestone, Activity, LogOut } from "lucide-react";
import logoImg from "../assets/images/zenith_fitness_logo_1779995642428.png";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openGoalsModal: () => void;
}

export function Sidebar({ activeTab, setActiveTab, openGoalsModal }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", Icon: Home },
    { id: "meals", label: "Meals Log", Icon: Apple },
    { id: "analytics", label: "Analytics", Icon: BarChart3 },
    { id: "health", label: "Health Tracking", Icon: Activity },
    { id: "coaching", label: "Nutrition Assistant Summary", Icon: Milestone },
  ];

  return (
    <aside className="py-5 px-3 flex flex-col items-center justify-between z-10 w-full h-full select-none" aria-label="Primary navigation">
      {/* Brand Logotype */}
      <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
        <div className="w-11 h-11 flex items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/25 p-0.5 shadow-lg transform hover:scale-105 transition-transform overflow-hidden">
          <img 
            src={logoImg} 
            alt="Zenith Logo" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div className="hidden md:flex flex-col items-center text-center mt-1">
          <strong className="text-[10px] font-black text-white tracking-widest uppercase">Zenith</strong>
          <small className="text-[7px] text-emerald-400/80 block tracking-normal uppercase font-mono mt-0.5">FIT OS</small>
        </div>
      </div>

      {/* Nav stacked buttons */}
      <nav className="flex flex-row md:flex-col gap-4 py-2" aria-label="Dashboard sections">
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={label}
              className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all relative group cursor-pointer ${
                isActive
                  ? "bg-white text-zinc-950 border-white shadow-md transform -translate-y-[2px]"
                  : "bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-white/20 hover:bg-white/10"
              }`}
              aria-label={label}
            >
              <Icon className="w-4.5 h-4.5" />
              <span className="absolute left-14 px-2 py-1 rounded bg-zinc-900 border border-white/10 text-white text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block z-50">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Stacked parameters editor trigger and signout safety */}
      <div className="flex flex-row md:flex-col gap-3">
        <button
          onClick={openGoalsModal}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:border-amber-400 hover:bg-white/10 text-white/60 hover:text-amber-300 transition-all cursor-pointer"
          title="Open Calorie Calculator"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>

        <button
          onClick={() => {
            if (confirm("Are you ready to sign out of Zenith Fitness?")) {
              signOut(auth);
            }
          }}
          className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:border-rose-500/50 hover:bg-rose-500/10 text-white/50 hover:text-rose-400 transition-all cursor-pointer"
          title="Sign Out of Zenith"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </aside>
  );
}
