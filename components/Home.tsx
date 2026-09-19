"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers, Zap, RefreshCw, Radio, ChevronRight } from "lucide-react";

const features = [
  {
    icon: <Layers className="w-5 h-5" />,
    label: "Two-Stage Queue",
    desc: "Batch Worker fans out into N item jobs via BullMQ.",
  },
  {
    icon: <Zap className="w-5 h-5" />,
    label: "Concurrent Processing",
    desc: "Up to 5 items processed simultaneously per worker.",
  },
  {
    icon: <Radio className="w-5 h-5" />,
    label: "Live Updates via SSE",
    desc: "Redis Pub/Sub bridges workers → browser in real time.",
  },
  {
    icon: <RefreshCw className="w-5 h-5" />,
    label: "Auto & Manual Retry",
    desc: "3 automatic retries with exponential backoff.",
  },
];

export default function Home() {
  const [itemCount, setItemCount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(itemCount, 10);
    if (!itemCount || isNaN(n) || n <= 0) {
      setError("Please enter a valid number greater than 0.");
      return;
    }
    if (n > 100) {
      setError("Keep it under 100 for the demo.");
      return;
    }
    setError("");
    router.push(`/url?count=${n}`);
  };

  const isValid =
    itemCount &&
    !isNaN(parseInt(itemCount)) &&
    parseInt(itemCount) > 0 &&
    parseInt(itemCount) <= 100;

  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center p-6 antialiased overflow-hidden selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* --- Background Effects --- */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Glowing Orbs */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] opacity-50" />
      </div>

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row gap-16 lg:gap-10 items-center z-10">
        
        {/* --- Left Column: Copy & Features --- */}
        <div className="flex-1 text-center lg:text-left pt-10 lg:pt-0">
          
          {/* Tech Stack Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 shadow-2xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
              Next.js · BullMQ · Redis · Postgres
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400 leading-[1.1]">
            Batch Processing
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent drop-shadow-sm">
              at Scale
            </span>
          </h1>

          <p className="mt-6 text-lg text-neutral-400 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Enter a number <strong className="text-neutral-200 font-semibold">N</strong>. The system spins up <strong className="text-neutral-200 font-semibold">N</strong> isolated jobs, processes them concurrently, and streams live status updates directly to your UI.
          </p>

          {/* Architecture Pipeline */}
          <div className="mt-8 flex flex-wrap gap-2 items-center text-xs font-medium font-mono text-neutral-400 justify-center lg:justify-start">
            {["POST /api", "Batch Worker", "N × Item Workers", "SSE → UI"].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-2.5 py-1.5 rounded-lg bg-neutral-900/50 border border-neutral-800 text-neutral-300 shadow-sm">
                  {step}
                </span>
                {i !== arr.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-neutral-600" />
                )}
              </div>
            ))}
          </div>

          {/* Feature Grid */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div 
                key={f.label} 
                className="group relative flex items-start gap-4 p-5 rounded-2xl bg-neutral-900/30 border border-neutral-800/50 hover:bg-neutral-800/50 hover:border-blue-500/30 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                <div className="mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 flex items-center justify-center group-hover:text-blue-400 group-hover:border-blue-500/30 transition-colors shadow-sm z-10">
                  {f.icon}
                </div>
                <div className="z-10">
                  <div className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">{f.label}</div>
                  <div className="text-xs text-neutral-500 mt-1 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Right Column: Interactive Card --- */}
        <div className="w-full lg:w-[380px] flex-shrink-0">
          <div className="relative rounded-3xl bg-neutral-900/40 border border-white/10 backdrop-blur-xl p-8 shadow-2xl shadow-black/80 overflow-hidden">
            
            {/* Glossy top edge highlight */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            {/* Subtle inner radial gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-50 pointer-events-none" />

            <div className="relative text-center mb-8">
              <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 text-white mb-5 shadow-inner">
                <Layers className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Initialize Batch</h2>
              <p className="text-sm text-neutral-400 mt-1.5">How many items to process?</p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-5" noValidate>
              <div>
                <label
                  htmlFor="number"
                  className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2.5 ml-1"
                >
                  Total Items (N)
                </label>
                <div className="relative">
                  <input
                    id="number"
                    type="number"
                    min="1"
                    max="100"
                    value={itemCount}
                    onChange={(e) => {
                      setItemCount(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. 50"
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white placeholder:text-neutral-600 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-base font-medium shadow-inner"
                  />
                  {/* Glowing background behind input when focused (simulated with shadow) */}
                </div>
                {error && (
                  <p className="mt-2.5 text-xs font-medium text-red-400 flex items-center gap-1.5 ml-1">
                    <span className="w-1 h-1 rounded-full bg-red-400" />
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isValid}
                className={`group relative w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold transition-all duration-300 overflow-hidden ${
                  isValid
                    ? "text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/25"
                    : "bg-neutral-800/50 text-neutral-600 cursor-not-allowed border border-neutral-800"
                }`}
              >
                {/* Dynamic Button Background */}
                {isValid && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-500 transition-colors" />
                )}
                
                <span className="relative z-10 flex items-center gap-2">
                  Launch Workers
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isValid ? "group-hover:translate-x-1" : ""}`} />
                </span>
              </button>
            </form>

            <div className="relative mt-6 text-center">
              <p className="text-xs font-medium text-neutral-500 flex items-center justify-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500/70" />
                Max 100 items for demo limits
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}