"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect away from login if authenticated
      if (user && pathname === '/login') {
        router.push('/');
      }

      // Redirect to login if not authenticated and not on public pages
      if (!user && pathname !== '/login') {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

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
