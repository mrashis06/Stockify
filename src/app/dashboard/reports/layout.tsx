import React, { ReactNode } from 'react';
import Link from 'next/link';
import {
  Package,
  LayoutDashboard,
  Warehouse,
  BarChartHorizontal,
  FileText,
  User,
} from 'lucide-react';

import NavLink from '../nav-link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 p-4 md:p-8">
      <aside className="hidden md:flex flex-col gap-6">
        <nav className="flex flex-col gap-2">
           <NavLink href="/dashboard">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
          </NavLink>
           <NavLink href="/dashboard/inventory">
              <Warehouse className="h-5 w-5" />
              Inventory
          </NavLink>
           <NavLink href="/dashboard/sales">
              <BarChartHorizontal className="h-5 w-5" />
              Sales
          </NavLink>
           <NavLink href="/dashboard/reports">
              <FileText className="h-5 w-5" />
              Reports
          </NavLink>
        </nav>

        <Card className="mt-auto p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="https://picsum.photos/seed/admin-avatar/40/40" data-ai-hint="female avatar" alt="Admin" />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">John Doe</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </Card>
      </aside>
      <main>{children}</main>
    </div>
  );
}
