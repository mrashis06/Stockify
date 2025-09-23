import React, { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Package, User, LayoutDashboard, FileText, Settings, Warehouse, BarChartHorizontal } from 'lucide-react';

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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background dark">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 z-50">
        <nav className="flex-1 flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <Package className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Inventory Manager</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
             <NavLink href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
            </NavLink>
             <NavLink href="/dashboard/inventory">
                <Warehouse className="h-4 w-4" />
                Inventory
            </NavLink>
             <NavLink href="/dashboard/sales">
                <BarChartHorizontal className="h-4 w-4" />
                Sales
            </NavLink>
             <NavLink href="#">
                <FileText className="h-4 w-4" />
                Reports
            </NavLink>
             <NavLink href="#">
                <Settings className="h-4 w-4" />
                Settings
            </NavLink>
          </div>
        </nav>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarImage src="https://picsum.photos/seed/user-avatar/40/40" data-ai-hint="male avatar" alt="User" />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {children}
    </div>
  );
}
