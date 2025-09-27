
import React, { ReactNode } from 'react';

export default function SalesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 p-4 md:p-8">
      {children}
    </div>
  );
}
