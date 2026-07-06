'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Reader } from '@/components/Reader';
import Link from 'next/link';

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
}

export default function ReaderPage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/article/${id}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Article not found');
          return;
        }
        const data = await res.json();
        setArticle(data);
      } catch {
        setError('Failed to load article');
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
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
