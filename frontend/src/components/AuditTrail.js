export default function AuditTrail({ trail }) {
    if (!trail || trail.length === 0) return null;

    return (
        <div className="relative border-l border-border/70 ml-3 space-y-8 py-2">
            {trail.map((item, idx) => (
                <div key={idx} className="relative pl-6">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[5px] top-1 w-[9px] h-[9px] rounded-full bg-primary ring-4 ring-background" />

                    <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-semibold text-foreground">
                            <span className="text-muted-foreground text-xs mr-2 font-mono font-bold">STEP {item.step}</span>
                            {item.action}
                        </h4>
                        <span className="text-xs text-muted-foreground font-mono font-medium">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>

                    {item.module === "governance" && (
                        <div className="mt-2 text-xs font-mono font-bold text-success bg-success/10 border border-success/20 px-2 py-1 rounded inline-flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                            COMPLIANCE PASSED
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
