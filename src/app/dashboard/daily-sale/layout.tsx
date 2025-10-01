
import React, { ReactNode } from 'react';

export default function DailySaleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 p-4 md:p-8">
      <main>{children}</main>
    </div>
  );
}
