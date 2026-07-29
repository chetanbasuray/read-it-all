import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function SidebarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
