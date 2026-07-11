'use client';

import { useEffect, useState, Suspense } from 'react';
import { Reader } from '@/components/Reader';

interface ArticleData {
  id: string;
  title: string;
  content: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  image: string | null;
  url: string;
  cached: boolean;
  views?: number;
}

function AcceptInner() {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 10) {
      setError('No article data found in URL hash');
      return;
    }

    try {
      const json = decodeURIComponent(hash.slice(1));
      const data = JSON.parse(json);

      fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then((r) => {
          if (!r.ok) throw new Error('Ingest failed');
          return r.json();
        })
        .then((d: ArticleData) => {
          setArticle(d);
        })
        .catch((e) => {
          setError('Failed to cache article: ' + e.message);
        });
    } catch (e) {
      setError('Invalid article data: ' + (e instanceof Error ? e.message : 'parse error'));
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            Try the bookmarklet again. If the problem persists, the article may
            be too large for this method.
          </p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Processing article...
          </p>
        </div>
      </div>
    );
  }

  return <Reader article={article} onBack={() => (window.location.href = '/')} />;
}

export default function AcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <AcceptInner />
    </Suspense>
  );
}
