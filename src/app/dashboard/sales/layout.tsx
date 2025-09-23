import React, { ReactNode } from 'react';

export default function SalesLayout({ children, params, searchParams }: { children: ReactNode; params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined }; }) {
  return (
    <div className="flex-1 p-4 md:p-8">
      {children}
    </div>
  );
}
