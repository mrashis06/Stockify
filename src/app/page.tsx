
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
      <main className="flex-1">
        <section className="flex flex-col items-center justify-center text-center flex-grow pt-24 pb-16">
          <div className="relative z-10 mx-auto max-w-4xl p-4">
            <h1 className="font-headline text-4xl font-bold tracking-tight md:text-6xl text-foreground">
              Welcome to Stockify
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              The perfect place to manage your liquor store inventory.
            </p>
          </div>
          
          <div className="my-12">
            <AnimatedGlass />
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white transition-transform hover:scale-105">
                <Link href={getStartedLink} onClick={handleGetStarted}>Get Started</Link>
              </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
