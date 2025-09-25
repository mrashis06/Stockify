
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/hooks/use-auth';
import { LoadingProvider } from '@/hooks/use-loading';
import { DateFormatProvider } from '@/hooks/use-date-format';
import Loader from '@/components/loader';
import Script from "next/script";
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'Stockify - Liquor Store Inventory Management',
  description: 'Stockify helps liquor shops manage inventory, staff, reports, and sales with ease.',
  keywords: 'Liquor, Inventory, Bar, Stock Management, Staff, Reports',
};

export default function RootLayout({
  children,
  params,
  searchParams,
}: Readonly<{
  children: React.ReactNode;
  params: { slug: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='white' stroke='%23374151' stroke-width='2' /><text x='50' y='55' font-size='24' font-family='Arial, sans-serif' fill='%23374151' text-anchor='middle' dominant-baseline='middle' font-style='italic'>Stockify</text><circle cx='66.5' cy='38' r='2' fill='orange' /></svg>" type="image/svg+xml" />
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <LoadingProvider>
              <DateFormatProvider>
                {children}
                <Loader />
                <Toaster />
              </DateFormatProvider>
            </LoadingProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
