
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useLoading } from "@/hooks/use-loading";
import AnimatedGlass from "@/components/landing/animated-glass";

export default function Home({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, loading: authLoading } = useAuth();
  const { showLoader } = useLoading();
  const router = useRouter();
  
  const getStartedLink = authLoading ? '#' : user ? '/dashboard' : '/login';

  const handleGetStarted = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (authLoading) return;

    if (getStartedLink === '/dashboard') {
      showLoader('Dashboard', getStartedLink);
    } else {
      router.push(getStartedLink);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Background elements */}
        <div className="absolute inset-0 w-full h-full">
            {/* Bar Counter */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-gray-200/80 via-gray-200/50 to-transparent dark:from-gray-800/60 dark:via-gray-800/30 dark:to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-300/80 to-transparent dark:from-gray-900/80 dark:to-transparent" />

            {/* Bottle Silhouettes */}
            <div className="absolute bottom-[33.33%] left-0 right-0 h-1/3 text-gray-300 dark:text-gray-700/80">
                <div className="relative w-full h-full max-w-5xl mx-auto">
                    {/* Left Group */}
                    <svg className="absolute bottom-0 left-[10%] w-auto h-[45%] opacity-70" viewBox="0 0 150 100" fill="currentColor">
                        <path d="M49.7,2.2c-1.5,0-2.8,1.3-2.8,2.8v15.3c0,1.5,1.3,2.8,2.8,2.8h11.2c1.5,0,2.8-1.3,2.8-2.8V5c0-1.5-1.3-2.8-2.8-2.8H49.7z M65.2,23.1H45.5V94c0,3.3,2.7,6,6,6h8.5c3.3,0,6-2.7,6-6V23.1z"/>
                        <path d="M91.8,10.6c-1.2,0-2.2,1-2.2,2.2V25c0,1.2,1,2.2,2.2,2.2h8.9c1.2,0,2.2-1,2.2-2.2V12.8c0-1.2-1-2.2-2.2-2.2H91.8z M105.1,27.2H89.6V94c0,3.3,2.7,6,6,6h3.4c3.3,0,6-2.7,6-6V27.2z"/>
                        <path d="M127.3,16.5c-1,0-1.8,0.8-1.8,1.8v13.6c0,1,0.8,1.8,1.8,1.8h7.2c1,0,1.8-0.8,1.8-1.8V18.3c0-1-0.8-1.8-1.8-1.8H127.3z M138.1,33.7h-12.6V94c0,3.3,2.7,6,6,6h0.6c3.3,0,6-2.7,6-6V33.7z"/>
                    </svg>
                    {/* Right Group */}
                    <svg className="absolute bottom-0 right-[10%] w-auto h-[40%] opacity-70" viewBox="0 0 100 100" fill="currentColor">
                         <path d="M64.2,3.3c-1.2,0-2.2,0.8-2.2,1.9V21c0,1,0.8,1.9,2,1.9h12.5c1.2,0,2.2-0.8,2.2-1.9V5.2c0-1-0.8-1.9-2-1.9H64.2z M81.1,22.9H62V94.8c0,2.8,2.3,5.2,5.2,5.2h8.8c2.8,0,5.2-2.3,5.2-5.2V22.9z"/>
                        <path d="M23.8,32.2L45,53.4c0.8,0.8,2.1,0.8,2.8,0L69,32.2c1.3-1.3,0.4-3.5-1.4-3.5H25.2C23.4,28.7,22.5,30.9,23.8,32.2z M46.4,59.3l-25.6,26c-0.6,0.6-0.6,1.6,0,2.2l2.2,2.2c0.6,0.6,1.6,0.6,2.2,0L48,67.1l22.8,22.8c0.6,0.6,1.6,0.6,2.2,0l2.2-2.2c0.6-0.6,0.6-1.6,0-2.2l-25.6-26C47.2,58.5,46,58.5,46.4,59.3z"/>
                    </svg>
                </div>
            </div>
            {/* Glow */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-96 h-96 bg-amber-400/20 dark:bg-amber-400/20 rounded-full blur-3xl opacity-50 dark:opacity-50" />
            </div>
        </div>

        <section className="flex flex-col items-center justify-center text-center flex-grow pt-24 pb-16 w-full z-10">
          <div className="relative z-10 mx-auto max-w-4xl p-4 opacity-0 fade-in-slide-up">
             <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-foreground">
              Welcome to Stockify
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl opacity-0 fade-in [animation-delay:0.3s]">
              The perfect place to manage your liquor store inventory.
            </p>
          </div>
          
          <div className="my-8 opacity-0 fade-in [animation-delay:0.6s]">
            <AnimatedGlass />
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row opacity-0 fade-in [animation-delay:0.9s]">
              <Button asChild size="lg" className="bg-green-500 hover:bg-green-600 text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 relative overflow-hidden group">
                <Link href={getStartedLink} onClick={handleGetStarted}>
                    Get Started
                    <span className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000 animate-[shimmer_4s_infinite]"></span>
                </Link>
              </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
