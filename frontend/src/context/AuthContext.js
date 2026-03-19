"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const UserRole = {
  ADMIN: 'ADMIN',
  UNDERWRITER: 'UNDERWRITER',
  VIEWER: 'VIEWER'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // 1. Initialize Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Run exactly once on mount so it doesn't get cancelled

  // 2. Handle Route Protection & Redirects
  useEffect(() => {
    if (loading) return; // Wait until Firebase determines active session

    // Redirect away from login if already authenticated
    if (user && pathname === '/login') {
      router.push('/');
    }

    // Redirect to login if not authenticated and trying to access protected pages
    if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading ? children : <div className="h-screen flex items-center justify-center">Loading...</div>}
    </AuthContext.Provider>
  );
};
