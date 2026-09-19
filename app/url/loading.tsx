export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        
        {/* Heading skeleton */}
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-gray-300"></div>

        {/* Text skeleton */}
        <div className="h-5 w-full animate-pulse rounded bg-gray-300"></div>
        <div className="h-5 w-5/6 animate-pulse rounded bg-gray-300"></div>

        {/* Input skeleton */}
        <div className="h-12 w-full animate-pulse rounded-lg bg-gray-300"></div>

        {/* Button skeleton */}
        <div className="h-12 w-32 animate-pulse rounded-lg bg-gray-300"></div>

      </div>
    </div>
  );
}