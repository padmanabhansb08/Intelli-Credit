"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  FileText, Plus, Rocket, AlertCircle, CheckCircle2, ChevronRight, Activity, Calendar, GitPullRequest, Search
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8006/api";

export default function PolicyDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [policies, setPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPolicies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let token = null;
      if (user) {
        token = await user.getIdToken();
      }
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/decision-studio/policies?page=1&page_size=50`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      if (!res.ok) {
        let errDetail = `Server responded with ${res.status}`;
        try {
          const errBody = await res.json();
          errDetail = errBody.detail || errBody.error || errDetail;
        } catch (_) { /* response wasn't JSON */ }
        throw new Error(errDetail);
      }
      const data = await res.json();
      setPolicies(data.items || data || []);
    } catch (err) {
      console.error(err);
      if (err.message.includes("fetch")) {
        setError("Unable to reach backend — is the server running on port 8000?");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, [user]);

  const handleDeploy = async (policyId, e) => {
    e.stopPropagation(); // prevent row click navigation
    try {
      let token = null;
      if (user) token = await user.getIdToken();
      
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/decision-studio/deploy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          workflow_id: policyId,
          nodes: [], // Mock nodes/edges since they are evaluated dynamically in reality
          edges: []
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail?.error || "Deployment failed");
      }
      
      // Assume successful deploy, refetch to potentially update status
      fetchPolicies();
      alert("Policy logically deployed (validated successfully)!");
    } catch (err) {
      alert(`Deployment Error: ${err.message}`);
    }
  };

  const filteredPolicies = policies.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.status && p.status.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-80px)] p-6 bg-background">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="text-primary" size={28} />
            Decision Studio Control Center
          </h1>
          <p className="text-muted-foreground mt-1">Manage and deploy graphical workflow schemas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push("/decision-studio")} className="shadow-lg">
            <Plus size={16} className="mr-2" />
            New Policy Engine
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card className="flex-1 shadow-2xl border-white/10 bg-[#0d0d12]/60 backdrop-blur-3xl overflow-hidden flex flex-col">
        <CardHeader className="border-b border-border/40 bg-white/5 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                placeholder="Search policies..."
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText size={16} />
              {policies.length} Total Policies
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-sm font-medium">Loading workflows...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-500">
              <AlertCircle size={48} className="mb-4 opacity-50" />
              <p className="text-sm font-medium">Failed to load policies</p>
              <p className="text-xs mt-1 opacity-70">{error}</p>
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">No policies found.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredPolicies.map((policy) => (
                <motion.div
                  key={policy.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                  className="group flex items-center justify-between p-4 px-6 cursor-pointer transition-colors"
                  onClick={() => router.push(`/decision-studio?load=${policy.id}`)}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                      <GitPullRequest size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{policy.name}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 font-mono bg-black/30 px-1.5 py-0.5 rounded border border-white/5">
                          ID: {policy.id.substring(0, 8)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(policy.updated_at), "MMM d, yyyy h:mm a")}
                        </span>
                        <span>v{policy.version}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <Badge
                      variant={policy.status === "ACTIVE" || policy.status === "deployed" ? "success" : "secondary"}
                      className="px-2.5 py-0.5 shadow-sm bg-black/50 border border-white/10"
                    >
                      {policy.status === "ACTIVE" || policy.status === "deployed" ? (
                        <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" /> Active</div>
                      ) : (
                        policy.status || "Draft"
                      )}
                    </Badge>
                    
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                        onClick={(e) => handleDeploy(policy.id, e)}
                      >
                        <Rocket size={14} className="mr-2" />
                        Deploy to Prod
                      </Button>
                      <ChevronRight size={18} className="text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
