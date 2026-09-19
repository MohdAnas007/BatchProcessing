"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

export default   function Home() {
  const [itemCount, setItemCount] = useState<string>("");

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4 antialiased">
      <main className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-black text-white mb-4 shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Process Items
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter the quantity to start your workflow.
          </p>
        </div>

        {/* Input Form */}
        <div className="space-y-5">
          <div>
            <label
              htmlFor="number"
              className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-2"
            >
              Number of items
            </label>
            <input
              id="number"
              type="number"
              min="1"
              value={itemCount}
              onChange={(e) => setItemCount(e.target.value)}
              placeholder="e.g. 25"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-black focus:ring-4 focus:ring-slate-100 transition-all text-sm"
            />
          </div>

          {/* Action Button */}
          <Link
            
            href={itemCount ? `/url?count=${itemCount}` : "#"}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-all duration-200 ${
              itemCount 
                ? "bg-black hover:bg-slate-800 active:scale-[0.98] cursor-pointer" 
                : "bg-slate-300 cursor-not-allowed pointer-events-none"
            }`}
          >
            <span>Start Processing</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}