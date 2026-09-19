import BatchTracker from "@/components/BatchTracker"; // Adjust the import path as needed
export default async function UrlPage({
  searchParams,
}: {
  searchParams: Promise<{ count?: string }>;
}) {
  const params = await searchParams;
  
  const count = parseInt(params.count || "0", 10);

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <BatchTracker count={count} />
    </main>
  );
}