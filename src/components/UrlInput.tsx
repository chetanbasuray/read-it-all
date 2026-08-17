'use client';

import { useState, type FormEvent } from 'react';

interface UrlInputProps {
  onSubmit: (url: string, cookies?: string) => Promise<void>;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [cookies, setCookies] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError('Please enter a valid URL (e.g. https://example.com/article)');
      return;
    }

    await onSubmit(trimmed, cookies.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError('');
            }}
            placeholder="Paste article URL here..."
            disabled={isLoading}
            className="w-full rounded-xl bg-white px-4 py-3 text-base text-gray-900 shadow-sm ring-1 ring-gray-200 transition-shadow duration-150 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 disabled:opacity-50 dark:bg-white/[0.03] dark:text-gray-100 dark:ring-white/10 dark:placeholder:text-gray-500 dark:focus:ring-blue-400/60"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 focus:ring-offset-white disabled:bg-blue-600/50 dark:focus:ring-offset-gray-950"
        >
          {isLoading ? (
            <>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Reading
            </>
          ) : (
            'Read Article'
          )}
        </button>
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="rounded text-xs text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 dark:text-gray-500 dark:hover:text-gray-300"
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced options
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 dark:bg-white/[0.03] dark:ring-white/10">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Session Cookies (for authenticated sites like WSJ)
          </label>
          <textarea
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            placeholder="Paste cookies here (e.g. wsj=abc123; sid=xyz789)..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            Open DevTools &rarr; Application &rarr; Cookies, copy all, paste here.
            The server will use these to authenticate as you.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
