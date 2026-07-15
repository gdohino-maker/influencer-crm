"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h1 className="text-lg font-bold text-red-800 mb-2">エラーが発生しました</h1>
        <p className="text-sm text-red-700 whitespace-pre-wrap">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 rounded-md text-sm font-medium bg-red-700 text-white hover:bg-red-800"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
