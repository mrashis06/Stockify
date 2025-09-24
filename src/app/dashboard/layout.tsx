
"use client";

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Package, User, LayoutDashboard, FileText, Warehouse, Home, LogOut, ArrowLeft, Archive, GlassWater } from 'lucide-react';
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

export default function DashboardLayout({ children, params, searchParams }: { children: ReactNode, params: { slug: string }, searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showLoader, isLoading } = useLoading();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const handleNav = (path: string, pageName: string) => {
    showLoader(pageName, path);
  }

  if (authLoading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }

  if (!user) {
    // This case is handled by the useAuth hook redirecting, but as a fallback:
    return (
         <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Redirecting to login...</div>
        </div>
    );
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 z-50">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Stockify</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hidden md:flex">
              <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <nav className="hidden md:flex flex-1 items-center justify-center gap-6">
           <NavLink href="/" pageName='Home' onNavigate={handleNav}>
              <Home className="h-4 w-4" />
              Home
          </NavLink>
           <NavLink href="/dashboard" pageName='Dashboard' onNavigate={handleNav}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
          </NavLink>
           <NavLink href="/dashboard/inventory" pageName='Inventory' onNavigate={handleNav}>
              <Warehouse className="h-4 w-4" />
              Inventory
          </NavLink>
          <NavLink href="/dashboard/godown" pageName='Godown' onNavigate={handleNav}>
              <Archive className="h-4 w-4" />
              Godown
          </NavLink>
          <NavLink href="/dashboard/onbar" pageName='OnBar' onNavigate={handleNav}>
              <GlassWater className="h-4 w-4" />
              OnBar
          </NavLink>
           <NavLink href="/dashboard/reports" pageName='Reports' onNavigate={handleNav}>
              <FileText className="h-4 w-4" />
              Reports
          </NavLink>
        </nav>
        
        <div className="flex items-center gap-4">
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
