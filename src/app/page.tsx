
"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, BellRing, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useAuth } from "@/hooks/use-auth";

export default function Home({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, loading } = useAuth();
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-liquor-bottles');
  const getStartedLink = loading ? '#' : user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative flex h-[60vh] min-h-[500px] w-full items-center justify-center text-center text-primary-foreground md:h-[80vh]">
          {heroImage && (
             <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                fill
                className="object-cover"
                priority
              />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 mx-auto max-w-4xl p-4">
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Smart Inventory Management for Your Liquor Store
            </h1>
            <p className="mt-4 text-lg text-primary-foreground/90 md:text-xl">
              Effortlessly track sales, manage stock, and receive intelligent alerts to keep your shelves full and customers happy.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="transition-transform hover:scale-105">
                <Link href={getStartedLink}>Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-primary-foreground bg-transparent text-primary-foreground transition-transform hover:scale-105 hover:bg-primary-foreground/10">
                <Link href="#">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Call-to-Action Section */}
        <section className="w-full bg-accent py-16 text-accent-foreground md:py-24">
          <div className="container mx-auto flex flex-col items-center justify-center px-4 text-center">
            <h2 className="font-headline text-3xl font-bold md:text-4xl">
              Ready to Take Control of Your Inventory?
            </h2>
            <p className="mt-4 max-w-2xl text-lg">
              Join dozens of liquor stores streamlining their operations with Stockify.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 transition-transform hover:scale-105">
              <Link href={getStartedLink}>Get Started Now</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
