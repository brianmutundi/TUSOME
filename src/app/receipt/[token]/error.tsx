'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load receipt. <button className="underline" onClick={reset}>Retry</button>
      </div>
    </main>
  );
}
