"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  ServerCrash, 
  Activity,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

interface ItemUpdate {
  itemNum: number;
  itemId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

export default function BatchTracker({ count }: { count: number }) {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<number, ItemUpdate>>({});
  const [isError, setIsError] = useState(false);

  // 1. Start the batch when the component mounts
  useEffect(() => {
    if (!count || count <= 0) return;

    const startBatch = async () => {
      try {
        const res = await axios.post("/api/url", { count });
        setBatchId(res.data.batchId);
      } catch (err) {
        console.error("Error starting batch:", err);
        setIsError(true);
      }
    };

    startBatch();
  }, [count]);

  // 2. Listen to SSE updates once we have a batchId
  useEffect(() => {
    if (!batchId) return;

    const eventSource = new EventSource(`/api/url?batchId=${batchId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === "CONNECTED") {
        console.log("SSE Connected");
        return;
      }

      setItems((prev) => ({
        ...prev,
        [data.itemNum]: data,
      }));
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [batchId]);

  const handleRetry = async (itemNum: number, itemId: string) => {
    if (!batchId) return;

    // Optimistically update UI
    setItems((prev) => ({
      ...prev,
      [itemNum]: { ...prev[itemNum], status: "PENDING" }
    }));

    try {
      await axios.post("/api/retry", {
        itemId,
        batchId,
        itemNumber: itemNum
      });
    } catch (err) {
      console.error("Failed to retry item:", err);
      setItems((prev) => ({
        ...prev,
        [itemNum]: { ...prev[itemNum], status: "FAILED" }
      }));
    }
  };

  // UI Calculations
  const processedCount = Object.keys(items).length;
  const successCount = Object.values(items).filter(i => i.status === "SUCCESS").length;
  const failedCount = Object.values(items).filter(i => i.status === "FAILED").length;
  
  // Progress bar strictly measures successful completion towards 100%
  const progressPercentage = count > 0 ? Math.round((successCount / count) * 100) : 0;
  const isBatchFinished = processedCount === count;
  const isAllSuccess = successCount === count && isBatchFinished;

  if (isError) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-16 p-6 rounded-2xl bg-red-950/20 border border-red-500/30 flex items-center gap-4 text-red-400 backdrop-blur-xl shadow-2xl">
        <ServerCrash className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-semibold text-white">Failed to start batch processing</h3>
          <p className="text-sm text-neutral-400 mt-0.5">Please check your network connection or server route.</p>
        </div>
      </div>
    );
  }

  if (!count) {
    return (
      <div className="w-full max-w-7xl mx-auto mt-16 p-8 rounded-2xl bg-neutral-900/40 border border-white/5 text-neutral-500 text-center font-medium backdrop-blur-xl">
        No target count provided.
      </div>
    );
  }

  return (
    <div className="w-full max-w-[96rem] mx-auto bg-neutral-950/90 rounded-[2.5rem] border border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl relative overflow-hidden flex flex-col h-[90vh] max-h-[960px] antialiased p-6 sm:p-10">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-b from-blue-500/15 via-indigo-500/5 to-transparent blur-[140px] pointer-events-none" />

      {/* --- Header Section --- */}
      <div className="relative z-10 flex-shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Batch Execution Dashboard
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors ${
              isAllSuccess 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : isBatchFinished && failedCount > 0
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
            }`}>
              {isAllSuccess ? "Completed Successfully" : isBatchFinished ? "Completed with Errors" : "Processing"}
            </span>
          </div>
          
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {batchId ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-white/10 text-neutral-300 font-mono shadow-inner">
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span className="text-neutral-500">ID:</span> {batchId}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900/90 border border-white/10 text-neutral-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                Allocating workers...
              </div>
            )}
            
            <div className="flex items-center gap-4 px-3 py-1.5 rounded-xl bg-neutral-900/50 border border-white/5 text-neutral-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> {successCount} Success
              </span>
              <span className="text-neutral-700">|</span>
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {failedCount} Failed
              </span>
            </div>
          </div>
        </div>

        {/* --- Progress Card Widget --- */}
        <div className="w-full lg:w-80 bg-neutral-900/70 p-4 rounded-2xl border border-white/10 shadow-inner">
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span className="text-neutral-400">Success Rate</span>
            <span className={isAllSuccess ? "text-emerald-400 font-bold" : "text-blue-400 font-bold"}>
              {progressPercentage}%
            </span>
          </div>
          <div className="w-full bg-black/60 border border-white/5 rounded-full h-2.5 overflow-hidden relative p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-600 ease-out ${
                isAllSuccess 
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]" 
                  : "bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-neutral-500 mt-2 font-medium">
            <span>Processed: {processedCount} / {count}</span>
            <span>{failedCount > 0 ? `${failedCount} failed` : "All clear"}</span>
          </div>
        </div>
      </div>

      {/* --- Scrollable Items Grid Container (Expanded width to show more items per row) --- */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-2 mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 custom-scrollbar">
        {Array.from({ length: count }).map((_, index) => {
          const itemNum = index + 1;
          const itemData = items[itemNum];
          const status = itemData?.status || "PENDING";

          const isSuccess = status === "SUCCESS";
          const isFailed = status === "FAILED";
          const isPending = status === "PENDING";

          return (
            <div 
              key={itemNum} 
              onClick={() => {
                if (isFailed && itemData?.itemId) {
                  handleRetry(itemNum, itemData.itemId);
                }
              }}
              className={`group relative overflow-hidden p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between h-18 ${
                isSuccess 
                  ? "bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40" : 
                isFailed 
                  ? "bg-red-950/20 border-red-500/30 hover:border-red-500/60 cursor-pointer hover:bg-red-950/40 shadow-lg shadow-red-950/10" : 
                "bg-neutral-900/30 border-white/5 hover:border-white/10"
              }`}
            >
              {/* Left Side: Number & ID */}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-bold border transition-colors ${
                  isSuccess ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  isFailed ? "bg-red-500/10 text-red-400 border-red-500/20" :
                  "bg-neutral-800/80 text-neutral-400 border-white/5"
                }`}>
                  #{itemNum}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-neutral-300 truncate max-w-[90px]">
                    {itemData?.itemId ? `${itemData.itemId.slice(0, 8)}...` : "Queued..."}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-medium">Worker</span>
                </div>
              </div>

              {/* Right Side: Status Badge / Action */}
              <div>
                {isSuccess && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Done</span>
                  </div>
                )}
                
                {isFailed && (
                  <>
                    <div className="flex group-hover:hidden items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-semibold">
                      <XCircle className="w-3 h-3" />
                      <span>Fail</span>
                    </div>

                    <div className="hidden group-hover:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500 text-white text-[10px] font-bold shadow-md animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Retry</span>
                    </div>
                  </>
                )}

                {isPending && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800/60 border border-white/5 text-neutral-400 text-[10px] font-medium">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>Sync</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}