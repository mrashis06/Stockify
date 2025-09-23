
"use client";

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Package, User, LayoutDashboard, FileText, Warehouse, Home, LogOut, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }

  if (!user) {
    // This check is primarily for client-side routing.
    // The useAuth hook handles the initial redirect.
    return (
         <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 z-50">
        <nav className="flex-1 flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Stockify</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
             </Button>
             <NavLink href="/">
                <Home className="h-4 w-4" />
                Home
            </NavLink>
             <NavLink href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
            </NavLink>
             <NavLink href="/dashboard/inventory">
                <Warehouse className="h-4 w-4" />
                Inventory
            </NavLink>
             <NavLink href="/dashboard/reports">
                <FileText className="h-4 w-4" />
                Reports
            </NavLink>
          </div>
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
                  <AvatarImage src={user.photoURL || "https://picsum.photos/seed/user-avatar/40/40"} data-ai-hint="male avatar" alt="User" />
                  <AvatarFallback>
                    {user.email ? user.email.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.displayName || user.email || 'My Account'}</DropdownMenuLabel>
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
      {children}
    </div>
  );
}
