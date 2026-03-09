"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, AlertCircle, ArrowRight, Loader2, CreditCard, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [authMode, setAuthMode] = useState("selection"); // "selection" | "email"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Email is already in use");
      } else {
        setError(err.message || "An error occurred during authentication");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");
    try {
        await signInWithPopup(auth, googleProvider);
        router.push("/");
    } catch (err) {
        console.error("Google Auth Error:", err);
        if (err.code === 'auth/popup-closed-by-user') {
            setError("Sign-in popup was closed before completing.");
        } else if (err.code === 'auth/unauthorized-domain') {
            setError("This domain is not authorized for Google Sign-In. Please add it in the Firebase Console.");
        } else {
            setError(err.message || "Google Sign-in failed. Please try again.");
        }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-success/15 blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-primary/10 rounded-2xl mb-4 border border-primary/20">
                <CreditCard className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Intelli-Credit
            </h1>
            <p className="text-muted-foreground mt-2 text-center">
                {authMode === 'selection' 
                    ? "Choose how you would like to continue" 
                    : (isLogin ? "Welcome back to the decision engine" : "Create your account to get started")}
            </p>
        </div>

        <div className="backdrop-blur-xl bg-card border border-border/50 rounded-2xl shadow-2xl p-8 relative overflow-hidden min-h-[300px]">
             {/* Glass Reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {error && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-destructive/10 text-destructive-foreground p-3 rounded-lg flex items-center gap-2 text-sm mb-5 relative z-10"
                >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{error}</span>
                </motion.div>
            )}

            <AnimatePresence mode="wait">
                {authMode === 'selection' ? (
                    <motion.div
                        key="selection"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4 relative z-10"
                    >
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full bg-card hover:bg-accent border border-input text-foreground font-medium rounded-xl py-3 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continue with Google
                                </>
                            )}
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-border"></div>
                            <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground uppercase font-medium tracking-wider">
                                Or
                            </span>
                            <div className="flex-grow border-t border-border"></div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setAuthMode('email');
                                setIsLogin(true);
                            }}
                            disabled={isLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        >
                            <Mail className="w-5 h-5" />
                            Continue with Email
                        </button>
                    </motion.div>
                ) : (
                    <motion.form
                        key="email"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleEmailAuth} 
                        className="space-y-5 relative z-10"
                    >
                        <button 
                            type="button"
                            onClick={() => {
                                setError("");
                                setAuthMode('selection');
                            }}
                            className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back to options
                        </button>

                        <div className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm placeholder:text-muted-foreground"
                                />
                            </div>
                            
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm placeholder:text-muted-foreground"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            {isLogin && (
                                <a href="#" className="text-primary hover:underline hover:text-primary/80 transition-colors">
                                    Forgot password?
                                </a>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? "Sign In" : "Create Account"}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>

                        <p className="text-center text-sm text-muted-foreground mt-4">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <button 
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-primary hover:underline font-medium"
                            >
                                {isLogin ? "Sign up" : "Sign in"}
                            </button>
                        </p>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
