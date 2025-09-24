
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
        <div className="absolute inset-0 w-full h-full opacity-60 dark:opacity-30">
          {/* Main background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-gray-50 to-gray-200 dark:from-background dark:via-gray-900/50 dark:to-gray-800/60" />
          
          {/* Bar counter */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-500/80 via-gray-400/50 to-transparent dark:from-gray-800/80 dark:via-gray-700/50" />
          
          {/* Bottle silhouettes */}
          <div className="absolute bottom-[33%] left-0 right-0 flex justify-between items-end px-8 md:px-20 text-gray-400/50 dark:text-gray-600/50">
            <div className="flex items-end gap-2">
                <div className="w-10 h-32 bg-current" style={{ clipPath: 'polygon(20% 0, 80% 0, 90% 100%, 10% 100%)' }} />
                <div className="w-8 h-40 bg-current" style={{ clipPath: 'polygon(30% 0, 70% 0, 80% 100%, 20% 100%)' }} />
                <div className="w-6 h-24 bg-current" style={{ clipPath: 'polygon(25% 0, 75% 0, 85% 100%, 15% 100%)' }} />
            </div>
             <div className="flex items-end gap-4">
                <div className="w-12 h-20 bg-current" style={{ clipPath: 'polygon(0% 100%, 0% 40%, 40% 0%, 60% 0%, 100% 40%, 100% 100%)' }} />
                <div className="w-10 h-48 bg-current" style={{ clipPath: 'polygon(40% 0, 60% 0, 80% 100%, 20% 100%)' }} />
            </div>
          </div>
        </div>

        <section className="flex flex-col items-center justify-center text-center flex-grow pt-24 pb-16 w-full z-10">
          <div className="relative z-10 mx-auto max-w-4xl p-4">
             <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-foreground opacity-0 fade-in-slide-up">
              Welcome to Stockify
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl opacity-0 fade-in-slide-up [animation-delay:0.3s]">
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
