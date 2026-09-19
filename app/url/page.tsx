import BatchTracker from "@/components/BatchTracker"; // Adjust the import path as needed

export default async function UrlPage({
  searchParams,
}: {
  searchParams: Promise<{ count?: string }>;
}) {
  const params = await searchParams;
  const count = parseInt(params.count || "0", 10);

  return (
    <main className="relative min-h-screen w-full bg-black flex flex-col items-center justify-center p-4 sm:p-6 antialiased overflow-hidden selection:bg-blue-500/30 selection:text-blue-200">
      
      {/* --- Background Effects (Matching Landing Page) --- */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        
        {/* Glowing Orbs */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] opacity-50" />
      </div>

      {/* --- Main Component Container (Expanded to full width) --- */}
      <div className="relative z-10 w-full h-[92vh] flex items-center justify-center">
        <BatchTracker count={count} />
      </div>
    </main>
  );
}