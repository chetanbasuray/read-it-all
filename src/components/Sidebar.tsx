'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookIcon } from './BookIcon';

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function ReadIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function BookmarkletIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function ShieldIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Read It All',
    items: [{ href: '/', label: 'Read an article', icon: ReadIcon }],
  },
  {
    label: 'Setup',
    items: [{ href: '/bookmarklet', label: 'Bookmarklet setup', icon: BookmarkletIcon }],
  },
  {
    label: 'About',
    items: [
      { href: '/privacy', label: 'Privacy Policy', icon: ShieldIcon },
      { href: '/terms', label: 'Terms and Conditions', icon: ShieldIcon },
      { href: '/report', label: 'Report Content', icon: ShieldIcon },
    ],
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <BookIcon className="w-7 h-7" />
        <span className="font-bold text-gray-900 dark:text-gray-100">Read It All</span>
      </Link>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {group.label}
          </p>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sm:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <BookIcon className="w-6 h-6" />
        <span className="font-bold text-gray-900 dark:text-gray-100">Read It All</span>
      </div>

      {open && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-950 shadow-xl overflow-y-auto">
            <NavContent onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}

      <nav className="hidden sm:flex sm:flex-col w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
        <NavContent />
      </nav>
    </>
  );
}
