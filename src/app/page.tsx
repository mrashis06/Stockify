
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useLoading } from "@/hooks/use-loading";
import AnimatedGlass from "@/components/landing/animated-glass";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Logo from "@/components/ui/logo";

const BottleSilhouette = () => (
    <svg width="60" height="150" viewBox="0 0 60 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12">
        <path d="M20 150 V 60 C 18 50, 22 45, 30 45 C 38 45, 42 50, 40 60 V 150 H 20 Z" fill="currentColor" />
        <path d="M25 45 V 10 H 35 V 45 H 25 Z" fill="currentColor" />
    </svg>
)

const StoutBottleSilhouette = () => (
     <svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-12 md:w-14 -mx-2">
        <path d="M15 130 V 50 C 15 35, 20 25, 35 25 C 50 25, 55 35, 55 50 V 130 H 15 Z" fill="currentColor"/>
        <path d="M30 25 V 10 H 40 V 25 H 30 Z" fill="currentColor" />
    </svg>
)

const MiniBottleSilhouette = () => (
    <svg width="40" height="100" viewBox="0 0 40 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-7 md:w-8 -ml-4">
        <path d="M10 100 V 45 C 8 40, 12 35, 20 35 C 28 35, 32 40, 30 45 V 100 H 10 Z" fill="currentColor" />
        <path d="M15 35 V 5 H 25 V 35 H 15 Z" fill="currentColor" />
    </svg>
)

const WineGlassSilhouette = () => (
    <svg width="80" height="110" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-12 md:w-16">
        <path d="M10 0 C 10 -5, 70 -5, 70 0 L 75 30 C 75 50, 5 50, 5 30 L 10 0 Z" fill="currentColor"/>
        <path d="M38 50 H 42 V 100 H 38 V 50 Z" fill="currentColor"/>
        <path d="M20 100 H 60 V 105 H 20 V 100 Z" fill="currentColor" />
    </svg>
)

const StandardBottleSilhouette = () => (
     <svg width="60" height="140" viewBox="0 0 60 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12">
        <path d="M15 140 V 55 C 15 40, 20 30, 30 30 C 40 30, 45 40, 45 55 V 140 H 15 Z" fill="currentColor"/>
        <path d="M25 30 V 10 H 35 V 30 H 25 Z" fill="currentColor" />
    </svg>
)


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
        <div className="absolute inset-0 w-full h-full pointer-events-none">
             <div className="absolute inset-0 bg-background-gradient" />
             {/* Center Spotlight */}
             <div className="absolute inset-0 bg-spotlight-gradient" />

            <div className="absolute bottom-0 left-0 right-0 h-1/2 md:h-2/3 flex justify-between items-end px-4 md:px-16 text-foreground/10 dark:text-foreground/15 dark:drop-shadow-[0_0_15px_hsl(var(--foreground)/0.15)]">
                <div className="flex items-end gap-2 md:gap-4">
                    <MiniBottleSilhouette />
                    <StoutBottleSilhouette />
                    <BottleSilhouette />
                </div>
                 <div className="flex items-end gap-2 md:gap-4">
                    <WineGlassSilhouette />
                    <StandardBottleSilhouette />
                </div>
            </div>
        </div>

        <section className="flex flex-col items-center justify-center text-center flex-grow pt-24 pb-16 w-full z-10">
          <div className="relative z-10 mx-auto max-w-4xl p-4 opacity-0 fade-in-slide-up">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl text-foreground flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              Welcome to <Logo className="h-12 md:h-16 w-auto" />
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

