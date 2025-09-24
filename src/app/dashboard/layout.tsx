
"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Package, User, LayoutDashboard, FileText, Warehouse, Home, LogOut, ArrowLeft, Archive, GlassWater, Menu, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NavLink from './nav-link';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { useLoading } from '@/hooks/use-loading';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, shopId, isStaffActive } = useAuth();
  const router = useRouter();
  const { showLoader, isLoading } = useLoading();
  const [isMobileMenuOpen, useState] = useState(false);
  
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'staff' && !shopId) {
        // If staff has no shopId, redirect them to join a shop
        router.push('/join-shop');
      } else if (user.role === 'staff' && !isStaffActive) {
          // If staff is blocked, show an appropriate message or redirect
          // For now, redirecting to a simple blocked page (to be created)
          // Or just log them out
          signOut(auth).then(() => router.push('/login?error=blocked'));
      }
    }
  }, [user, authLoading, router, shopId, isStaffActive]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const handleNav = (path: string, pageName: string) => {
    useState(false);
    showLoader(pageName, path);
  }
  
  const isAdmin = user?.role === 'admin';

  // While loading auth state or if there's no user (and we are about to redirect), show a loader.
  if (authLoading || !user || (user.role === 'staff' && !shopId)) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }
  
  const navItems = [
      { href: "/", pageName: 'Home', icon: Home, label: "Home" },
      { href: "/dashboard", pageName: 'Dashboard', icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/inventory", pageName: 'Inventory', icon: Warehouse, label: "Inventory" },
      { href: "/dashboard/godown", pageName: 'Godown', icon: Archive, label: "Godown" },
      { href: "/dashboard/onbar", pageName: 'OnBar', icon: GlassWater, label: "OnBar" },
      ...(isAdmin ? [{ href: "/dashboard/staff", pageName: 'Staff', icon: Users, label: "Staff" }] : []),
      { href: "/dashboard/reports", pageName: 'Reports', icon: FileText, label: "Reports" },
  ];

  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6 z-50">
        <div className="flex items-center gap-4">
           <Sheet open={isMobileMenuOpen} onOpenChange={useState}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                    <SheetDescription className="sr-only">Main dashboard navigation</SheetDescription>
                </SheetHeader>
                <nav className="grid gap-6 text-lg font-medium mt-8">
                     {navItems.map(item => (
                        <NavLink key={item.href} href={item.href} pageName={item.pageName} onNavigate={handleNav}>
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </SheetContent>
          </Sheet>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <Package className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline font-bold text-xl">Stockify</span>
          </Link>
        </div>

        <nav className="hidden flex-col gap-6 text-sm font-medium md:flex md:flex-row md:items-center md:gap-5 lg:gap-6">
           {navItems.map(item => (
              <NavLink key={item.href} href={item.href} pageName={item.pageName} onNavigate={handleNav}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
              </NavLink>
            ))}
        </nav>
        
        <div className="flex items-center gap-2 sm:gap-4">
           <Button variant="ghost" size="icon" onClick={() => router.back()} className="hidden md:flex">
              <ArrowLeft className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarFallback>
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center gap-2">
                {user.displayName || 'My Account'}
                {user.role === 'admin' && <Badge variant="destructive">Admin</Badge>}
                {user.role === 'staff' && <Badge variant="secondary">Staff</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/dashboard/settings">
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </Link>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {isLoading ? null : children}
    </div>
  );
}

