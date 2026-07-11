'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

interface ReaderProps {
  article: {
    title: string;
    content: string;
    byline: string | null;
    image: string | null;
    excerpt: string;
    url: string;
    cached?: boolean;
    views?: number;
  };
  onBack: () => void;
}

const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;

export function Reader({ article, onBack }: ReaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [fontSizeIndex, setFontSizeIndex] = useState(2);

  const decreaseFont = () => setFontSizeIndex((i) => Math.max(0, i - 1));
  const increaseFont = () => setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1));
  const currentFontSize = FONT_SIZES[fontSizeIndex];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={decreaseFont}
                disabled={fontSizeIndex === 0}
                className="px-2 py-1 text-xs rounded-md hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                title="Decrease font size"
              >
                A<sup>-</sup>
              </button>
              <span className="text-xs text-gray-400 w-8 text-center select-none">
                {['S', 'M', 'L', 'XL'][fontSizeIndex]}
              </span>
              <button
                onClick={increaseFont}
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                className="px-2 py-1 text-xs rounded-md hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                title="Increase font size"
              >
                A<sup>+</sup>
              </button>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <article>
          {article.image && (
            <div className="mb-8 -mx-4 sm:mx-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image}
                alt={article.title}
                className="w-full max-h-96 object-cover rounded-none sm:rounded-xl"
              />
            </div>
          )}

          <header className="mb-8">
            <h1
              className={`font-bold text-gray-900 dark:text-gray-100 leading-tight mb-4 ${
                fontSizeIndex >= 3 ? 'text-3xl' : fontSizeIndex >= 2 ? 'text-4xl' : fontSizeIndex >= 1 ? 'text-3xl' : 'text-2xl'
              }`}
            >
              {article.title}
            </h1>

            {article.byline && (
              <p className="text-gray-500 dark:text-gray-400 text-base">
                By {article.byline}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View Original &rarr;
              </a>
              {article.cached !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    article.cached
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      article.cached ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  {article.cached ? 'Cached' : 'Fresh scrape'}
                </span>
              )}
              {article.views !== undefined && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {article.views} {article.views === 1 ? 'view' : 'views'}
                </span>
              )}
            </div>
          </header>

          <div
            className={`reader-content ${currentFontSize}`}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </article>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-400 dark:text-gray-500">
          Content extracted for personal reading convenience.{' '}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 dark:hover:text-gray-300"
          >
            View original article
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
