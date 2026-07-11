'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Reader } from '@/components/Reader';
import Link from 'next/link';

interface ArticleData {
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

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function BypassInner() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url');
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const u: string = url!;

    async function start() {
      const hashHex = await sha256Hex(u);
      const id = hashHex.substring(0, 16);

      for (let i = 0; i < 30; i++) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/article/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) {
              setArticle(data);
              setLoading(false);
            }
            return;
          }
        } catch {
          // article not cached yet, retry
        }
        if (!cancelled) setRetry(i + 1);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) {
        setError('Article not found. The ingest request may have failed.');
        setLoading(false);
      }
    }

    start();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
            Sending article to reader...
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm">
            {retry > 0 ? `Waiting for cache... (${retry}s)` : 'Waiting for ingest...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!article) return null;

  return (
    <Reader
      article={article}
      onBack={() => (window.location.href = '/')}
    />
  );
}

export default function BypassPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <BypassInner />
    </Suspense>
  );
}
