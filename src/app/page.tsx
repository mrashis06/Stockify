import Image from "next/image";
import Link from "next/link";
import { BarChart3, BellRing, PackageSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function Home() {
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-liquor-bottles');

  const features = [
    {
      icon: <PackageSearch className="h-10 w-10 text-primary" />,
      title: "Inventory Tracking",
      description: "Keep a real-time pulse on your stock levels. Our system updates automatically with every sale and delivery.",
    },
    {
      icon: <BarChart3 className="h-10 w-10 text-primary" />,
      title: "Sales Reporting",
      description: "Gain valuable insights with detailed sales analytics. Understand your best-sellers and optimize your purchasing.",
    },
    {
      icon: <BellRing className="h-10 w-10 text-primary" />,
      title: "Low Stock Alerts",
      description: "Never run out of a popular item again. Get timely alerts when inventory runs low, so you can reorder with confidence.",
    },
  ];

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
                <Link href="/login">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-2 border-primary-foreground bg-transparent text-primary-foreground transition-transform hover:scale-105 hover:bg-primary-foreground/10">
                <Link href="#">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="font-headline mb-12 text-center text-3xl font-bold md:text-4xl">
              Everything You Need to Succeed
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="transform border-2 bg-card text-card-foreground shadow-lg transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl">
                  <CardHeader className="items-center">
                    {feature.icon}
                    <CardTitle className="mt-4 text-center font-headline text-2xl font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
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
              Join dozens of liquor stores streamlining their operations with StockSmart.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 transition-transform hover:scale-105">
              <Link href="/login">Get Started Now</Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
