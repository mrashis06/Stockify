
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
      <main className="flex-1 flex flex-col items-center justify-center">
        <section className="flex flex-col items-center justify-center text-center flex-grow pt-24 pb-16 w-full">
          <div className="relative z-10 mx-auto max-w-4xl p-4">
             <h1 className="font-headline text-4xl font-bold tracking-tight md:text-6xl text-foreground opacity-0 fade-in-slide-up">
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
