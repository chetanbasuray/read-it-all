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
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition-colors text-base"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium transition-colors text-base whitespace-nowrap flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Reading...
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
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced options
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
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
