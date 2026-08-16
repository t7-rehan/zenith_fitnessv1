import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInAnonymously
} from "firebase/auth";
import { doc, setDoc, collection, writeBatch } from "firebase/firestore";
import { motion } from "motion/react";
import { Dumbbell, Mail, Lock, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";

// Imported Logo Asset Path
import logoImg from "../assets/images/zenith_fitness_logo_1779995642428.png";

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize initial user records in Firestore upon first sign-up
  const seedNewUserData = async (userId: string, userEmail: string) => {
    try {
      const batch = writeBatch(db);

      // 1. Create Private Info doc
      const privateInfoRef = doc(db, "users", userId, "private", "info");
      batch.set(privateInfoRef, {
        userId,
        email: userEmail
      });

      // 2. Set Default Athletic Goals
      const goalsRef = doc(db, "users", userId, "goals", "daily");
      batch.set(goalsRef, {
        userId,
        calories: 2200,
        protein: 165,
        carbs: 240,
        fats: 70,
        updatedAt: new Date()
      });

      // 3. Seed Default Athletic & Wellness Habits
      const defaultHabits = [
        { name: "Drink 3L Hydration", completedDates: [], isCustom: false },
        { name: "Exercise Workout", completedDates: [], isCustom: false },
        { name: "Mindful Meditation", completedDates: [], isCustom: false },
        { name: "Sleep by 11 PM", completedDates: [], isCustom: false },
        { name: "Read 15 Mins", completedDates: [], isCustom: false }
      ];

      defaultHabits.forEach((habit, idx) => {
        const habitId = `seed_habit_${idx + 1}`;
        const habitRef = doc(db, "users", userId, "habits", habitId);
        batch.set(habitRef, {
          id: habitId,
          userId,
          name: habit.name,
          completedDates: habit.completedDates,
          isCustom: habit.isCustom,
          createdAt: new Date()
        });
      });

      // 4. Seeding standard starter meals into user profile for frictionless exploration
      const starterMeals = [
        { id: "seed_meal_1", meal: "Breakfast", food: "Greek yogurt bowl", serving: "1 bowl", calories: 380, protein: 31, carbs: 44, fats: 9 },
        { id: "seed_meal_2", meal: "Lunch", food: "Chicken quinoa salad", serving: "420g", calories: 610, protein: 48, carbs: 58, fats: 18 },
        { id: "seed_meal_3", meal: "Snack", food: "Banana and almonds", serving: "1 medium + 20g", calories: 235, protein: 7, carbs: 33, fats: 10 },
        { id: "seed_meal_4", meal: "Dinner", food: "Salmon rice plate", serving: "1 plate", calories: 690, protein: 46, carbs: 62, fats: 27 }
      ];

      starterMeals.forEach((meal) => {
        const mealRef = doc(db, "users", userId, "meals", meal.id);
        batch.set(mealRef, {
          ...meal,
          userId,
          createdAt: new Date()
        });
      });

      // Execute batch commit safely
      await batch.commit();
    } catch (err) {
      console.warn("Error seeding newly registered profile:", err);
      // Suppress or catch gracefully without breaking user session on the client
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please provide your email and credentials password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const credentials = await createUserWithEmailAndPassword(auth, email, password);
        const user = credentials.user;
        await seedNewUserData(user.uid, user.email || email);
      } else {
        // Log in Flow
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      let friendlyError = "Authenticating error. Please check your credentials and retry.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        friendlyError = "Incorrect password or register email combination.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyError = "This email is already linked to a registered account. Sign in instead.";
      } else if (err.code === "auth/weak-password") {
        friendlyError = "The security password must be at least 6 characters in length.";
      } else if (err.code === "auth/invalid-email") {
        friendlyError = "Please enter a valid format email address.";
      }
      setErrorMsg(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Determine if a new sign-up metadata check is present
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      if (isNewUser) {
        await seedNewUserData(user.uid, user.email || "google-user@zenith.com");
      }
      
      onAuthSuccess();
    } catch (err: any) {
      console.error("Google Authenticate action rejected:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setErrorMsg("The Google Sign-In popup was closed or blocked. Sandboxed preview iframes often block popup windows. To bypass, click 'Open in New Tab' at the top-right, use standard Email & Password, or click 'Guest Athlete Mode' below.");
      } else {
        setErrorMsg(`Google Sign-In failed: ${err.message || "An error occurred"}.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Generate a unique random email for the session so it's a completely clean slate
      const randomId = Math.random().toString(36).substring(2, 10);
      const guestEmail = `guest_${randomId}@zenith.com`;
      const guestPassword = `ZenithGuest123!_${randomId}`;

      const credentials = await createUserWithEmailAndPassword(auth, guestEmail, guestPassword);
      const user = credentials.user;
      
      await seedNewUserData(user.uid, guestEmail);
      onAuthSuccess();
    } catch (err: any) {
      console.error("Guest credentials generation failed, attempting anonymous sign-in fallback:", err);
      try {
        // Fallback to anonymous sign-in
        const credentials = await signInAnonymously(auth);
        const user = credentials.user;
        await seedNewUserData(user.uid, "guest-anon@zenith.com");
        onAuthSuccess();
      } catch (fallbackErr: any) {
        console.error("All guest auth methods failed:", fallbackErr);
        setErrorMsg(`Failed to auto-generate a guest session: ${fallbackErr.message || "An error occurred"}. Please use the manual registration form above.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e120c] font-sans text-[#f7f5ed] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Decorative Blur Ambient circles matching the main workspace */}
      <div className="absolute top-[10%] left-[20%] w-[380px] h-[380px] bg-emerald-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[15%] w-[320px] h-[320px] bg-orange-950/15 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 select-none">
        
        {/* Brand Logo & Presentation */}
        <div className="flex flex-col items-center mb-6 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-20 h-20 mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/25 p-0.5 shadow-lg transform hover:scale-105 transition-all overflow-hidden"
          >
            <img 
              src={logoImg} 
              alt="Zenith Fitness Emblem" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-xl"
            />
          </motion.div>
          
          <motion.div
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h1 className="text-3xl font-black tracking-widest text-[#f7f5ed]">
              ZENITH <span className="text-emerald-400 font-mono text-sm tracking-normal">FIT OS</span>
            </h1>
            <p className="text-[11px] mt-1 text-white/50 font-mono tracking-wider">
              UNLEASH YOUR peak METABOLIC tier
            </p>
          </motion.div>
        </div>

        {/* Form Container Card - Styled like stat-card for complete consistency */}
        <motion.div
          initial={{ y: 25, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-black/75 border border-white/[0.06] backdrop-blur-3xl rounded-3xl p-6.5 shadow-2xl relative"
        >
          {/* Subtle Orange Decorative Horizontal Accent line */}
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"></div>

          <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2 text-left">
            <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
              <Dumbbell className="w-4 h-4" />
            </span>
            {isSignUp ? "Generate Athlete Profile" : "Athlete Console Access"}
          </h2>

          {errorMsg && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs"
              id="auth-error-message"
            >
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="text-left">
              <label className="block text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 font-mono">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/30">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@zenith.com"
                  className="w-full h-11 bg-zinc-950 border border-white/10 focus:border-orange-500/50 rounded-xl py-2 pl-10 pr-4 text-white text-xs placeholder:text-white/20 focus:outline-none transition-colors"
                  required
                  disabled={isLoading}
                  id="auth-email-input"
                />
              </div>
            </div>

            <div className="text-left">
              <label className="block text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1.5 font-mono">
                Secure Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/30">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 bg-zinc-950 border border-white/10 focus:border-orange-500/50 rounded-xl py-2 pl-10 pr-4 text-white text-xs placeholder:text-white/20 focus:outline-none transition-colors"
                  required
                  disabled={isLoading}
                  id="auth-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-zinc-950 font-bold rounded-xl border border-white/10 shadow-lg shadow-black/40 focus:outline-none transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55 px-4 text-xs font-mono uppercase tracking-wide"
              id="auth-submit-button"
            >
              {isLoading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin text-zinc-950" />
              ) : (
                <>
                  {isSignUp ? "Generate Credentials" : "Enter Athletic Console"}
                </>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]"></div>
            </div>
            <span className="relative bg-[#0b0e0a] border border-white/10 text-white/40 text-[9px] px-3 py-1 rounded-full uppercase font-mono tracking-widest">
              Or Sync via Enterprise
            </span>
          </div>

          {/* Google SSO Login */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full h-11 bg-zinc-950 hover:bg-zinc-900 text-white/80 border border-white/10 hover:border-white/20 font-bold rounded-xl focus:outline-none transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-55 shadow-sm text-xs"
            id="google-signin-button"
          >
            {/* Native Clean Flat Google Logo Icon */}
            <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google Account
          </button>

          {/* Guest Access Mode Bypass */}
          <button
            type="button"
            onClick={handleGuestAuth}
            disabled={isLoading}
            className="w-full h-11 mt-2.5 bg-emerald-950/45 hover:bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/35 font-bold rounded-xl focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 shadow-sm text-xs font-mono uppercase tracking-wide"
            id="guest-signin-button"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Guest Athlete Mode (Instant Access)
          </button>

          {/* SSO Sandbox Iframe Notice */}
          <p className="text-[9px] text-white/30 text-center mt-3 font-mono leading-relaxed px-2">
            Tip: If SSO is blocked inside the preview workspace, use <span className="text-orange-400 font-bold">standard Email Login</span> or click <span className="text-emerald-400 font-bold">Open in New Tab</span> at top-right to log in.
          </p>

          {/* Switch flow links */}
          <div className="mt-5 text-center text-xs text-white/50 select-none">
            {isSignUp ? (
              <p>
                Have an athletic profile?{" "}
                <button
                  onClick={() => setIsSignUp(false)}
                  className="text-orange-400 hover:text-orange-300 font-bold focus:outline-none transition underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                First time at Zenith?{" "}
                <button
                  onClick={() => setIsSignUp(true)}
                  className="text-orange-400 hover:text-orange-300 font-bold focus:outline-none transition underline cursor-pointer"
                >
                  Create Profile
                </button>
              </p>
            )}
          </div>

        </motion.div>
        
        {/* Footnote */}
        <p className="text-center text-[10px] text-white/20 mt-8 font-mono tracking-widest">
          ZENITH SYSTEMS • ATHLETIC OS • SECURED DEPLOYMENT
        </p>

      </div>
    </div>
  );
}
