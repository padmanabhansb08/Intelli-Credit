import React, { useState } from 'react';

// Progressive Disclosure Table Component
const DataTable = ({ title, data }) => {
    const [expanded, setExpanded] = useState(false);

    if (!data || data.length === 0) return null;

    // Convert object or single item to array format for generic table mapping
    const arrayData = Array.isArray(data) ? data : [data];
    if (arrayData.length === 0) return null;

    const headers = Object.keys(arrayData[0]);

    return (
        <div className="mt-2 border rounded-md overflow-hidden bg-white text-xs">
            <div
                className="bg-slate-50 p-2 font-semibold text-slate-700 cursor-pointer flex justify-between items-center"
                onClick={() => setExpanded(!expanded)}
            >
                <span>{title} ({arrayData.length})</span>
                <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
            </div>
            {expanded && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 border-y">
                                {headers.map(h => (
                                    <th key={h} className="p-2 font-medium text-slate-600 capitalize">{h.replace(/_/g, ' ')}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {arrayData.map((row, i) => (
                                <tr key={i} className="border-b last:border-b-0">
                                    {headers.map(h => (
                                        <td key={h} className="p-2 text-slate-600 truncate max-w-[120px]">
                                            {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// Represents a 5 C's Metric block 
const MetricBlock = ({ label, value, status = 'neutral' }) => {
    const colors = {
        neutral: 'bg-slate-100 text-slate-700',
        success: 'bg-green-100 text-green-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-700'
    };

    return (
        <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-400">{label}</span>
            <span className={`text-xs font-semibold px-1 rounded w-max mt-1 ${colors[status]}`}>
                {value}
            </span>
        </div>
    );
};

export const CustomWidgetRenderer = ({ node, updateNodeData, executionData }) => {
    const { type, data } = node;

    // Helper for input changes
    const handleChange = (key, val) => {
        updateNodeData(node.id, { [key]: val });
    };

    // Helper to extract nested output state for this specific node
    const nodeOutput = executionData?.[node.id] || null;

    switch (type) {
        case 'integrationNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">Bureau Data (Capacity & Character)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricBlock
                            label="Connection"
                            value={data.connection || 'None'}
                        />
                        <MetricBlock
                            label="Target Payload"
                            value={data.fieldAssignment || 'data.bureau'}
                            status="success"
                        />
                    </div>
                    {nodeOutput?.vantage_score && (
                        <div className="mt-3 bg-blue-50/50 p-2 rounded border border-blue-100/50">
                            <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Execution Result</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-blue-900 font-medium">Vantage Score</span>
                                <span className="text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">{nodeOutput.vantage_score}</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        case 'gstReconciliationNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">GST & Bank Statements (Capacity)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricBlock label="Tolerance" value={`${data.tolerancePercentage || 5}%`} />
                        <MetricBlock label="Flag Action" value={data.flagAnomalies ? 'Halt Process' : 'Log Only'} status={data.flagAnomalies ? 'warning' : 'neutral'} />
                    </div>
                    {/* Expose dynamic form input for testing */}
                    <div className="mt-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Set Tolerance %</label>
                        <input
                            type="number"
                            className="w-full text-xs p-1 border rounded"
                            value={data.tolerancePercentage || 5}
                            onChange={e => handleChange('tolerancePercentage', Number(e.target.value))}
                        />
                    </div>
                    {nodeOutput && nodeOutput?.variance !== undefined && (
                        <div className="mt-3 bg-amber-50/50 p-2 rounded border border-amber-100/50">
                            <p className="text-[10px] uppercase font-bold text-amber-500 mb-1">Execution Result</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-amber-900 font-medium">Reconciliation Variance</span>
                                <span className={`text-xs font-bold bg-white px-2 py-0.5 rounded shadow-sm ${(nodeOutput?.variance * 100) > (data.tolerancePercentage || 5) ? 'text-red-600' : 'text-green-600'}`}>
                                    {(nodeOutput.variance * 100).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            );
        case 'mcaFilingSyncNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">Corporate Filings (Character)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricBlock label="Directors" value={data.syncDirectors ? 'Syncing' : 'Disabled'} status={data.syncDirectors ? 'success' : 'neutral'} />
                        <MetricBlock label="Financials" value={data.syncFinancials ? 'Syncing' : 'Disabled'} status={data.syncFinancials ? 'success' : 'neutral'} />
                    </div>
                    <DataTable title="Sample Directors" data={[
                        { "name": "John Doe", "din": "01234567", "status": "Active" },
                        { "name": "Jane Smith", "din": "09876543", "status": "Active" }
                    ]} />
                </div>
            );
        case 'epfoAnomalyNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">Employee Provident Fund (Conditions)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <MetricBlock label="Target ID" value={data.employerIdTarget || 'data.epfo_id'} />
                    </div>
                    <div className="mt-2">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tolerance (Months)</label>
                        <input
                            type="number"
                            className="w-full text-xs p-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={data.toleranceMonths || 3}
                            onChange={e => handleChange('toleranceMonths', Number(e.target.value))}
                        />
                    </div>
                </div>
            );
        case 'documentClassificationNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">LLM Multi-Modal Ingestion</p>
                    <MetricBlock label="LLM Model" value={data.model || 'llama3-70b-8192'} status="success" />
                </div>
            );
        case 'conditionNode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">AST Routing Logic</p>
                    <div className="bg-slate-800 text-green-400 font-mono text-[10px] p-2 rounded overflow-x-auto whitespace-nowrap">
                        {data.expression || 'True'}
                    </div>
                    {nodeOutput && nodeOutput?.eval_result !== undefined && (
                        <div className="mt-2 flex justify-between items-center p-2 rounded border border-slate-200">
                            <span className="text-xs text-slate-600 font-medium">Condition Result:</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded shadow-sm ${nodeOutput.eval_result ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                {nodeOutput.eval_result ? 'TRUE (Approved)' : 'FALSE (Review/Reject)'}
                            </span>
                        </div>
                    )}
                </div>
            );
        case 'explainableAINode':
            return (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-slate-500 mb-1">TreeSHAP Drivers</p>
                    <MetricBlock label="Baseline Model" value={data.modelReference || 'pd_gradient_boost_v2'} status="neutral" />
                </div>
            );
        default:
            return <div className="text-xs text-slate-400">Node specific visualization not built.</div>;
    }
}
