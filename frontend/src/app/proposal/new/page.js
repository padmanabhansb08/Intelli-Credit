"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight, ChevronLeft, Save, Building2, FileBarChart,
    Briefcase, ShieldCheck, UploadCloud, AlertCircle, FileText,
    Users, Map, Activity
} from "lucide-react";

// --- STEPS CONFIGURATION ---
const STEPS = [
    { id: "initiation", label: "1. Initiation", icon: Building2 },
    { id: "enrichment", label: "2. Enrichment", icon: Briefcase },
    { id: "evaluation", label: "3. Evaluation & Approval", icon: ShieldCheck },
];

export default function NewProposalWizard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(true);

    // Master State Object holding all 3 stages of data
    const [formData, setFormData] = useState({
        // STAGE 1: Initiation
        customer: { name: "", id: "", industry: "Manufacturing", constitution: "Public Ltd" },
        financials: {
            operating_income: 0, non_operating_income: 0,
            short_term_liab: 0, long_term_liab: 0, contingent_liab: 0,
            internal_rating: "", external_rating: "", bureau_score: 700,
            current_assets: 0, fixed_assets: 0, intangible_assets: 0
        },
        facility: { amount: 0, currency: "INR", purpose: "", term_months: 12, repayment_method: "EMI" },
        collateral_list: [],

        // STAGE 2: Enrichment
        writeup: { swot: "", business_overview: "", policy_exceptions: "" },
        kyc_status: "Pending",
        exposure: { internal: 0, external: 0, parent_child: 0, geography: "Low", industry: "Medium", entity: "Low" },

        // STAGE 3: Evaluation
        approval: { risk_dept: "Pending", legal_dept: "Pending", compliance: "Pending" },
        remarks: []
    });

    useEffect(() => {
        const fetchDraft = async () => {
            const draftId = sessionStorage.getItem("draftId");
            if (draftId) {
                try {
                    const { loadDraft } = await import('@/lib/api');
                    const draftData = await loadDraft(draftId);
                    if (draftData && draftData.draft) {
                        setFormData(prev => ({
                            ...prev,
                            ...draftData.draft
                        }));
                    }
                } catch (e) {
                    console.error("Failed to load draft:", e);
                }
            }
            setIsLoadingDraft(false);
        };
        fetchDraft();
    }, []);

    const handleNext = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    const handlePrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            const { saveDraft } = await import('@/lib/api');
            // If already editing a draft, keep its ID, otherwise create one
            const draftId = sessionStorage.getItem("draftId") || "DRAFT-" + Math.random().toString(36).substr(2, 9);

            await saveDraft(draftId, formData);
            sessionStorage.setItem("draftId", draftId); // Remember we are editing this draft

            alert("Draft saved successfully to the server.");
        } catch (err) {
            console.error(err);
            alert("Failed to save draft: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            // In a real flow, a file upload would happen first to get an analysis_id
            // For the LOS demo, we generate a synthetic one if no document was directly attached
            const dummyAnalysisId = "LOS-" + Math.random().toString(36).substr(2, 9);

            // Format for the new massive nested Pydantic endpoint we built
            const payload = { ...formData };

            // Call the api hook
            const { runAnalysis } = await import('@/lib/api');

            console.log("Submitting massive payload to ML Engine:", payload);
            const result = await runAnalysis(dummyAnalysisId, payload);

            // Store result in session storage for the /analyze (Evaluation) page to read
            sessionStorage.setItem("analysisResult", JSON.stringify(result));
            sessionStorage.setItem("analysisId", dummyAnalysisId);

            router.push("/analyze");
        } catch (error) {
            console.error("Analysis Error:", error);
            alert("Failed to submit proposal: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDER HELPERS ---
    const updateNestedState = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
    };

    const handleCancel = () => {
        sessionStorage.removeItem("draftId");
        router.push("/");
    };

    if (isLoadingDraft) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4 h-full min-h-[600px]">
                <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-mono text-sm">Resuming Work in Progress...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 h-full flex flex-col">

            {/* Header & Stepper */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-sans text-white tracking-tight">Credit Origination</h1>
                    <p className="text-slate-400 mt-1">Multi-stage enterprise loan origination and approval workflow.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleSaveDraft} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition font-medium border border-slate-700">
                        {isSaving ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Draft
                    </button>
                    <button onClick={handleCancel} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium border border-red-500/20">
                        Cancel
                    </button>
                </div>
            </div>

            {/* Stepper Progress */}
            <div className="flex w-full mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10" />
                {STEPS.map((step, idx) => {
                    const isActive = idx === currentStep;
                    const isPassed = idx < currentStep;
                    const Icon = step.icon;
                    return (
                        <div key={idx} className="flex-1 flex flex-col items-center relative">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-[#0B0E14] transition-colors duration-300 ${isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : isPassed ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <span className={`mt-3 text-sm font-medium ${isActive ? 'text-blue-400' : isPassed ? 'text-teal-400' : 'text-slate-500'}`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Main Form Content Area */}
            <div className="flex-1 glass-card rounded-2xl border border-slate-700/50 p-6 md:p-8 relative overflow-hidden min-h-[600px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {/* --- STAGE 1: INITIATION --- */}
                        {currentStep === 0 && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Customer Details</h3>
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Entity Name</label>
                                            <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="e.g. Reliance Industries Ltd."
                                                value={formData.customer.name} onChange={e => updateNestedState('customer', 'name', e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Industry</label>
                                                <select className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                                                    value={formData.customer.industry} onChange={e => updateNestedState('customer', 'industry', e.target.value)}>
                                                    <option>Manufacturing</option><option>IT Services</option><option>Retail</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Constitution</label>
                                                <select className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                    value={formData.customer.constitution} onChange={e => updateNestedState('customer', 'constitution', e.target.value)}>
                                                    <option>Public Ltd</option><option>Private Ltd</option><option>LLP</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileBarChart className="w-4 h-4 text-teal-400" /> Primary Financials</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Operating Income ($)</label>
                                                <input type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                    value={formData.financials.operating_income} onChange={e => updateNestedState('financials', 'operating_income', Number(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Total Liabilities ($)</label>
                                                <input type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                    value={formData.financials.short_term_liab + formData.financials.long_term_liab} disabled />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Internal Rating</label>
                                                <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" placeholder="e.g. CR-2"
                                                    value={formData.financials.internal_rating} onChange={e => updateNestedState('financials', 'internal_rating', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">CIBIL Bureau Score</label>
                                                <input type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                    value={formData.financials.bureau_score} onChange={e => updateNestedState('financials', 'bureau_score', Number(e.target.value))} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4 text-indigo-400" /> Facility Structuring</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Amount</label>
                                            <input type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                value={formData.facility.amount} onChange={e => updateNestedState('facility', 'amount', Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Term (Months)</label>
                                            <input type="number" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                                                value={formData.facility.term_months} onChange={e => updateNestedState('facility', 'term_months', Number(e.target.value))} />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-slate-400 mb-1 block">Purpose of Facility</label>
                                            <input type="text" className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white" placeholder="e.g. Working Capital Expand"
                                                value={formData.facility.purpose} onChange={e => updateNestedState('facility', 'purpose', e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><UploadCloud className="w-4 h-4 text-purple-400" /> Document Uploads</h3>
                                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 transition">
                                        <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
                                        <p className="text-slate-300 font-medium">Drag & Drop Tax Returns, Balance Sheets, and Legal Docs</p>
                                        <p className="text-slate-500 text-sm mt-1">Supports messy Indian PDF formatting via OCR</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- STAGE 2: ENRICHMENT --- */}
                        {currentStep === 1 && (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-amber-400" /> SWOT & Writeup</h3>
                                            <p className="text-xs text-slate-400 mb-3">Qualitative credit officer notes that directly influence the ML risk premium algorithm.</p>
                                            <textarea
                                                className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
                                                placeholder="Enter Business overview, strengths, mitigants..."
                                                value={formData.writeup.swot} onChange={e => updateNestedState('writeup', 'swot', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-white mb-2 block">Policy Exceptions</label>
                                            <textarea
                                                className="w-full h-20 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none"
                                                placeholder="List deviations from standard credit policy and justification."
                                                value={formData.writeup.policy_exceptions} onChange={e => updateNestedState('writeup', 'policy_exceptions', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Map className="w-4 h-4 text-emerald-400" /> Exposure & Concentration Limits</h3>
                                            <div className="space-y-4">
                                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                                    <span className="text-slate-300 font-medium">Internal Bank Exposure</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">$</span>
                                                        <input type="number" className="w-32 bg-transparent border-b border-slate-700 text-white text-right focus:outline-none"
                                                            value={formData.exposure.internal} onChange={e => updateNestedState('exposure', 'internal', Number(e.target.value))} />
                                                    </div>
                                                </div>
                                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                                                    <span className="text-slate-300 font-medium">External Institution Exposure</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">$</span>
                                                        <input type="number" className="w-32 bg-transparent border-b border-slate-700 text-white text-right focus:outline-none"
                                                            value={formData.exposure.external} onChange={e => updateNestedState('exposure', 'external', Number(e.target.value))} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs text-slate-400 block mb-1">Geography Risk</label>
                                                        <select className="w-full bg-black border border-slate-700 rounded p-2 text-sm text-white"
                                                            value={formData.exposure.geography} onChange={e => updateNestedState('exposure', 'geography', e.target.value)}>
                                                            <option>Low</option><option>Medium</option><option>High</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-400 block mb-1">Industry Concentration</label>
                                                        <select className="w-full bg-black border border-slate-700 rounded p-2 text-sm text-white"
                                                            value={formData.exposure.industry} onChange={e => updateNestedState('exposure', 'industry', e.target.value)}>
                                                            <option>Low</option><option>Medium</option><option>High</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- STAGE 3: EVALUATION & APPROVAL --- */}
                        {currentStep === 2 && (
                            <div className="flex flex-col items-center justify-center text-center space-y-6 pt-10">
                                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Ready for Multi-Level Evaluation</h2>
                                    <p className="text-slate-400 max-w-lg mx-auto">
                                        The proposal data is complete. Submitting will trigger the AI Data Ingestion pipeline, web-scale due diligence, and initiate the internal workflow routing for Risk, Legal, and Compliance department sign-offs.
                                    </p>
                                </div>

                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 w-full max-w-md mt-6 text-left space-y-4">
                                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Pre-Submission Summary</h4>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Borrower:</span>
                                        <span className="font-medium text-white">{formData.customer.name || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Requested Limit:</span>
                                        <span className="font-mono text-emerald-400 font-bold">${formData.facility.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">KYC Status:</span>
                                        <span className="text-amber-400 font-medium">Pending Review</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

            </div>

            {/* Bottom Navigation Bar */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 0 ? 'opacity-0 cursor-default' : 'bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                >
                    <ChevronLeft className="w-5 h-5" /> Back
                </button>

                {currentStep < STEPS.length - 1 ? (
                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/25"
                    >
                        Next Stage <ChevronRight className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25"
                    >
                        {isSaving ? <Activity className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        Submit for Evaluation
                    </button>
                )}
            </div>

        </div>
    );
}
