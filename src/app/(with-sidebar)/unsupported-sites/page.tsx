import type { Metadata } from 'next';
import { UNSUPPORTED_SITES } from '@/lib/unsupportedSites';

export const metadata: Metadata = {
  title: 'Unsupported Sites - Read It All',
};

export default function UnsupportedSitesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unsupported Sites</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Read It All will not attempt to fetch articles from these sites, and why.
        </p>

        <ul className="flex flex-col gap-4">
          {UNSUPPORTED_SITES.map((site) => (
            <li
              key={site.domain}
              className="border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3"
            >
              <p className="font-medium text-gray-900 dark:text-gray-100">{site.domain}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{site.reason}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
