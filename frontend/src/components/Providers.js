"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from "@/context/AuthContext";
import { useTabSync } from "@/hooks/useTabSync";
import ChatbotWidget from "@/components/ChatbotWidget";

const queryClient = new QueryClient();

export default function Providers({ children }) {
  // Initialize Global Tab Syncer
  useTabSync();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <ChatbotWidget />
      </AuthProvider>
    </QueryClientProvider>
  );
}
