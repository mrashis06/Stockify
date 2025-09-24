
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

const BottleSilhouette = () => (
    <svg width="60" height="150" viewBox="0 0 60 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12">
        <path d="M20 150V60C20 40 25 30 30 30C35 30 40 40 40 60V150H20Z" fill="currentColor" />
        <path d="M25 30V10H35V30H25Z" fill="currentColor" />
    </svg>
)

const BottleSilhouette2 = () => (
    <svg width="50" height="120" viewBox="0 0 50 120" fill="none" xmlns="http://wwws.w3.org/2000/svg" className="h-auto w-8 md:w-10">
        <path d="M15 120V50C15 35 20 25 25 25C30 25 35 35 35 50V120H15Z" fill="currentColor"/>
    </svg>
)

const WineGlassSilhouette = () => (
    <svg width="70" height="100" viewBox="0 0 70 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12">
        <path d="M10 0L60 0L35 40L10 0Z" transform="translate(0 30)" fill="currentColor"/>
        <path d="M32 70H38V100H32V70Z" fill="currentColor"/>
    </svg>
)

export default function Home({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, loading: authLoading } = useAuth();
  const { showLoader } = useLoading();
  const router = useRouter();
  
  const getStartedLink = authLoading ? '#' : user ? '/dashboard' : '/login';
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-liquor-bottles');

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

            <div className="absolute bottom-0 left-0 right-0 h-1/3 md:h-1/2 flex justify-between items-end px-4 md:px-16 text-foreground/10 dark:text-foreground/15 dark:drop-shadow-[0_0_10px_hsl(var(--foreground)/0.15)]">
                <div className="flex items-end gap-2 md:gap-4">
                    <BottleSilhouette />
                    <BottleSilhouette2 />
                </div>
                 <div className="flex items-end gap-2 md:gap-4">
                    <WineGlassSilhouette />
                    <BottleSilhouette />
                </div>
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
