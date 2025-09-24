
"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Package, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems: { name: string, href: string }[] = [
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="font-headline text-xl font-bold">Stockify</span>
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          <Button asChild>
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader className="border-b pb-4">
                    <SheetTitle>
                        <Link href="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                            <Package className="h-6 w-6 text-primary" />
                            <span className="font-headline text-xl font-bold">Stockify</span>
                        </Link>
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Main navigation menu for Stockify.
                    </SheetDescription>
                </SheetHeader>
              <div className="flex h-full flex-col">
                <nav className="flex-1 overflow-y-auto pt-6">
                    <div className="flex flex-col gap-4">
                        <ThemeToggle />
                    </div>
                </nav>
                <div className="mt-auto flex flex-col gap-4 border-t pt-6">
                  <Button asChild>
                    <Link href="/login" onClick={() => setIsOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
