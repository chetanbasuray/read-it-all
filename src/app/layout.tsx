import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Read It All - Read paywalled articles',
  description:
    'Extract and read articles from behind paywalls with a clean, distraction-free reading experience.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <ThemeProvider>
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
