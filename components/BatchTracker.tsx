"use client";

import { useEffect, useState } from "react";
import axios from "axios";

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
        // Change to your actual API route if it is /api/url
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

    // Connect to the stream route you created earlier
    const eventSource = new EventSource(`/api/url?batchId=${batchId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === "CONNECTED") {
        console.log("SSE Connected");
        return;
      }

      // Update the specific item in our state
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
      eventSource.close(); // Cleanup on unmount
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
      // Revert to FAILED on error
      setItems((prev) => ({
        ...prev,
        [itemNum]: { ...prev[itemNum], status: "FAILED" }
      }));
    }
  };

  // UI Calculations
  const processedCount = Object.keys(items).length;
  const progressPercentage = count > 0 ? Math.round((processedCount / count) * 100) : 0;

  if (isError) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Failed to start batch processing.</div>;
  if (!count) return <div className="p-4 text-slate-500">No count provided.</div>;

  return (
    <div className="max-w-4xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 font-sans">
      
      {/* Header & Progress */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Batch Processing</h1>
        <p className="mt-2 text-slate-500 font-medium">
          {batchId ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Tracking Batch: <code className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700">{batchId}</code>
            </span>
          ) : (
            "Starting batch..."
          )}
        </p>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-slate-600">Progress</span>
            <span className="text-blue-600">{processedCount} / {count}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Real-time Grid List */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Render placeholder cards for total count, fill them in as data arrives */}
        {Array.from({ length: count }).map((_, index) => {
          const itemNum = index + 1;
          const itemData = items[itemNum];
          const status = itemData?.status || "PENDING";

          return (
            <li 
              key={itemNum} 
              onClick={() => {
                if (status === "FAILED" && itemData?.itemId) {
                  handleRetry(itemNum, itemData.itemId);
                }
              }}
              className={`p-4 rounded-xl border flex items-center justify-between transition-colors duration-300
                ${status === "SUCCESS" ? "bg-green-50/50 border-green-200" : 
                  status === "FAILED" ? "bg-red-50/50 border-red-200 cursor-pointer hover:bg-red-100 hover:border-red-300" : 
                  "bg-slate-50 border-slate-200"}
              `}
              title={status === "FAILED" ? "Click to retry" : undefined}
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700">Item #{itemNum}</span>
                <span className="text-xs text-slate-500 mt-1 truncate w-32 md:w-48">
                  {itemData?.itemId || "Waiting in queue..."}
                </span>
              </div>

              {/* Status Badges */}
              <div>
                {status === "SUCCESS" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                    SUCCESS
                  </span>
                )}
                {status === "FAILED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                    FAILED
                  </span>
                )}
                {status === "PENDING" && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping"></span>
                    PENDING
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}