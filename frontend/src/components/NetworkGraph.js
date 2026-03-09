import { Network as NetworkIcon } from "lucide-react";

export default function NetworkGraph({ connections }) {
    if (!connections || connections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                <NetworkIcon className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">No related-party exposure detected.</p>
            </div>
        );
    }

    // A simplified SVG-based network graph for the hackathon demo
    // Central node is the borrower. Satellites are connections.
    const cx = 150;
    const cy = 150;
    const rPrimary = 30;
    const rSecondary = 20;

    return (
        <div className="relative w-full h-[300px] flex items-center justify-center bg-[#0d1117] rounded-xl border border-white/5 overflow-hidden">
            <svg width="100%" height="100%" viewBox="0 0 300 300" className="opacity-80">

                {/* Draw edges */}
                {connections.map((conn, idx) => {
                    const angle = (idx / connections.length) * 2 * Math.PI;
                    const nodeX = cx + Math.cos(angle) * 100;
                    const nodeY = cy + Math.sin(angle) * 100;
                    const strokeColor = conn.risk_rating === "High" ? "#ef4444" : conn.risk_rating === "Medium" ? "#f59e0b" : "#10b981";

                    return (
                        <line
                            key={`edge-${idx}`}
                            x1={cx} y1={cy}
                            x2={nodeX} y2={nodeY}
                            stroke={strokeColor}
                            strokeWidth={Math.max(1, (conn.exposure_amount || 1000) / 500000)}
                            strokeDasharray={conn.relationship.includes("Guarantor") ? "5,5" : "none"}
                            className="opacity-50"
                        />
                    );
                })}

                {/* Draw borrower node (center) */}
                <circle cx={cx} cy={cy} r={rPrimary} fill="#1e293b" stroke="#3b82f6" strokeWidth={3} className="shadow-lg drop-shadow-lg" />
                <text flex="1" x={cx} y={cy + 4} textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">Borrower</text>

                {/* Draw satellite nodes */}
                {connections.map((conn, idx) => {
                    const angle = (idx / connections.length) * 2 * Math.PI;
                    const nodeX = cx + Math.cos(angle) * 100;
                    const nodeY = cy + Math.sin(angle) * 100;
                    const nodeColor = conn.risk_rating === "High" ? "#7f1d1d" : conn.risk_rating === "Medium" ? "#78350f" : "#064e3b";
                    const strokeColor = conn.risk_rating === "High" ? "#ef4444" : conn.risk_rating === "Medium" ? "#f59e0b" : "#10b981";

                    return (
                        <g key={`node-${idx}`}>
                            <circle cx={nodeX} cy={nodeY} r={rSecondary} fill={nodeColor} stroke={strokeColor} strokeWidth={2} />
                            <text x={nodeX} y={nodeY} textAnchor="middle" fill="#94a3b8" fontSize="8" dy="-25">{conn.relationship}</text>
                            <text x={nodeX} y={nodeY + 3} textAnchor="middle" fill="#ffffff" fontSize="8">{conn.entity_name.split('_')[1]}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
