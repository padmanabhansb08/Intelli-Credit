"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  PlusCircle, Search, AlertCircle, Briefcase, ArrowRight, X,
  Building2, DollarSign, Clock, TrendingUp, Loader2, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api";

const STAGES = [
  { key: "intake", label: "Intake", color: "text-white", bg: "bg-[#111111]", border: "border-gray-800" },
  { key: "analyzing", label: "Analyzing", color: "text-white", bg: "bg-[#111111]", border: "border-gray-800" },
  { key: "under_review", label: "Under Review", color: "text-white", bg: "bg-[#111111]", border: "border-gray-800" },
  { key: "decided", label: "Decided", color: "text-white", bg: "bg-[#111111]", border: "border-gray-800" },
];

function statusToStage(status, decision) {
  if (decision === "APPROVED" || decision === "REJECTED") return "decided";
  if (status === "under_review" || status === "Under Review") return "under_review";
  if (status === "analyzing" || status === "Processing") return "analyzing";
  return "intake";
}

export default function PipelinePage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New application form
  const [form, setForm] = useState({
    id: "", borrower_id: "", facility_amount: "", currency: "INR", purpose: "", term_months: ""
  });

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let token = null;
      if (user) token = await user.getIdToken();
      const res = await fetch(`${API_URL}/applications`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();
      // Map ApprovalRequests to pipeline format if needed, or use as is if backend matches
      setApplications(data.items || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let token = null;
      if (user) token = await user.getIdToken();
      // Use the submission endpoint for approvals
      const res = await fetch(`${API_URL}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          id: form.id || crypto.randomUUID(),
          borrower_id: form.borrower_id,
          facility_amount: form.facility_amount ? parseFloat(form.facility_amount) : null,
          currency: form.currency || "INR",
          purpose: form.purpose,
          term_months: form.term_months ? parseInt(form.term_months) : null,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create application");
      }
      setIsModalOpen(false);
      setForm({ id: "", borrower_id: "", facility_amount: "", currency: "INR", purpose: "", term_months: "" });
      fetchApplications();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAppsByStage = (stageKey) => {
    return applications.filter(app => statusToStage(app.status, app.decision) === stageKey)
      .filter(app =>
        !searchQuery ||
        app.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.financial_data?.borrower_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  // Skeleton Loader Component
  const SkeletonCard = () => (
    <div className="p-4 rounded-xl bg-[#111111] border border-gray-800 animate-pulse flex flex-col gap-3 h-32">
      <div className="flex justify-between w-full">
        <div className="w-1/2 h-4 bg-gray-800 rounded"></div>
        <div className="w-1/4 h-4 bg-gray-800 rounded"></div>
      </div>
      <div className="w-3/4 h-3 bg-gray-800 rounded mt-2"></div>
      <div className="w-2/3 h-3 bg-gray-800 rounded"></div>
      <div className="w-1/3 h-2 bg-gray-800 rounded mt-auto"></div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Briefcase size={28} />
            Deal Flow Pipeline
          </h1>
          <p className="text-gray-400 mt-1">Track credit applications from intake through decisioning.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by ID or borrower..."
              className="bg-[#111111] border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white transition-all w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="shadow-lg bg-white text-black hover:bg-gray-200">
            <PlusCircle size={16} className="mr-2" />
            New Application
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 flex-1 mt-4">
           {[1, 2, 3, 4].map(col => (
             <div key={col} className="flex flex-col gap-3">
               <div className="h-10 bg-[#111111] border border-gray-800 rounded-xl mb-3"></div>
               <SkeletonCard />
               <SkeletonCard />
               <SkeletonCard />
             </div>
           ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <AlertCircle size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 flex-1">
          {STAGES.map((stage) => {
            const stageApps = getAppsByStage(stage.key);
            return (
              <div key={stage.key} className="flex flex-col">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${stage.border} ${stage.bg} mb-3`}>
                  <span className={`text-sm font-bold ${stage.color}`}>{stage.label}</span>
                  <Badge variant="secondary" className="text-xs bg-black/30 border-white/10">{stageApps.length}</Badge>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-3 flex-1 min-h-[200px]">
                  {stageApps.map((app) => (
                    <motion.div
                      key={app.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group p-4 rounded-xl bg-black/20 backdrop-blur-xl border border-white/10 hover:border-white/20 cursor-pointer transition-all shadow-lg hover:shadow-xl"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground truncate max-w-[150px]">
                            {app.borrower?.name || "Unknown"}
                          </span>
                        </div>
                        {app.decision && (
                          <Badge
                            variant={app.decision === "APPROVED" ? "success" : app.decision === "REJECTED" ? "destructive" : "secondary"}
                            className="text-[10px] px-1.5"
                          >
                            {app.decision}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <DollarSign size={12} />
                          <span>{app.currency} {(app.facility_amount || 0).toLocaleString()}</span>
                        </div>
                        {app.purpose && (
                          <div className="flex items-center gap-2">
                            <ArrowRight size={12} />
                            <span className="truncate">{app.purpose}</span>
                          </div>
                        )}
                        {app.term_months && (
                          <div className="flex items-center gap-2">
                            <Clock size={12} />
                            <span>{app.term_months} months</span>
                          </div>
                        )}
                        {app.composite_score != null && (
                          <div className="flex items-center gap-2">
                            <TrendingUp size={12} />
                            <span>Score: {app.composite_score}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-500">{app.id.substring(0, 12)}...</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {stageApps.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs opacity-50 border border-dashed border-white/10 rounded-xl min-h-[120px]">
                      No applications
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Application Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0d0d14]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-md"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h2 className="text-lg font-bold text-foreground">Originate New Application</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
                {[
                  { label: "Application ID", key: "id", placeholder: "app_001", required: true },
                  { label: "Borrower ID", key: "borrower_id", placeholder: "borr_xyz", required: true },
                  { label: "Facility Amount", key: "facility_amount", placeholder: "2500000", type: "number" },
                  { label: "Currency", key: "currency", placeholder: "INR" },
                  { label: "Purpose", key: "purpose", placeholder: "Working Capital" },
                  { label: "Term (months)", key: "term_months", placeholder: "24", type: "number" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{f.label}</label>
                    <input
                      type={f.type || "text"}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                ))}
                <Button type="submit" disabled={isSubmitting} className="w-full mt-2 shadow-lg">
                  {isSubmitting ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Creating...</>
                  ) : (
                    <><CheckCircle2 size={16} className="mr-2" /> Create Application</>
                  )}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
