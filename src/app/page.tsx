'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UrlInput } from '@/components/UrlInput';

interface ApiError {
  error: string;
}

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const handleSubmit = async (url: string, cookies?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookies }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError({ error: data.error || 'Failed to extract article' });
        return;
      }

      if (data.id) {
        router.push(`/reader/${data.id}`);
      }
    } catch {
      setError({ error: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-3xl mx-auto text-center">
          <div className="mb-12">
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">
              Read It All
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
              Paste a paywalled article URL and get a clean, distraction-free reading experience.
            </p>
          </div>

          <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-left">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                {error.error}
              </p>
            </div>
          )}

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-2xl mx-auto">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl mb-2">🔍</div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Smart Extraction
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Multiple fallback strategies to extract full article content.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl mb-2">📖</div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Reader Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Clean, distraction-free reading with dark mode and font controls.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Fast & Cached
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Previously read articles load instantly from cache.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
