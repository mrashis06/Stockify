
"use client";

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const metadata = {
    title: 'Stockify - Liquor Store Inventory Management',
    description: 'Smart Inventory Management for Your Liquor Store',
  };

  const isAuthPage = ['/login', '/signup'].includes(pathname);
  const isProtectedPage = !isAuthPage && pathname !== '/';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {loading && isProtectedPage ? (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
                <div>Loading...</div>
            </div>
          ) : (
            children
          )}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
