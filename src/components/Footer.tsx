import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>Read It All</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Terms and Conditions
          </Link>
          <Link href="/report" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            Report Content
          </Link>
        </div>
      </div>
    </footer>
  );
}
