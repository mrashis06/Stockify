

"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Package, User, LayoutDashboard, FileText, Warehouse, Home, LogOut, ArrowLeft, Archive, GlassWater, Menu, Users, HelpCircle, Circle, Barcode, ShoppingCart, TrendingUp, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import NavLink from './nav-link';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { useLoading } from '@/hooks/use-loading';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Logo from '@/components/ui/logo';
import { useNotifications, Notification } from '@/hooks/use-notifications';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDateFormat } from '@/hooks/use-date-format';
import NotificationDialog from '@/components/dashboard/notification-dialog';
import { Separator } from '@/components/ui/separator';
import ProfilePictureDialog from '@/components/dashboard/profile-picture-dialog';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="hidden sm:flex items-center justify-center font-mono text-sm font-semibold bg-muted text-muted-foreground px-3 py-1.5 rounded-md">
      {formatTime(time)}
    </div>
  );
};


export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, shopId, isStaffActive } = useAuth();
  const { notifications, markAsRead, markAllAsRead, deleteNotifications } = useNotifications();
  const { settings } = useNotificationSettings();
  const router = useRouter();
  const { showLoader, isLoading } = useLoading();
  const { formatDate } = useDateFormat();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false);
  const [isNotificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isProfilePicOpen, setIsProfilePicOpen] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState<Set<string>>(new Set());

  const displayedNotifications = user?.role === 'staff' && !settings.staffBroadcasts 
    ? [] 
    : notifications;
    
  const unreadCount = displayedNotifications.filter(n => !n.readBy.includes(user?.uid || '')).length;

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'staff' && !shopId) {
        router.push('/join-shop');
      } else if (user.role === 'staff' && !isStaffActive) {
          signOut(auth).then(() => {
            router.push('/login?error=blocked');
          });
      }
    }
  }, [user, authLoading, router, shopId, isStaffActive]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };
  
  const handleNav = (path: string, pageName: string) => {
    setIsMobileMenuOpen(false);
    if (path.startsWith('/')) {
        showLoader(pageName, path);
    } else {
        router.push(path);
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (user?.uid && !notification.readBy.includes(user.uid)) {
        markAsRead(notification.id);
    }
    setSelectedNotification(notification);
    setNotificationDialogOpen(true);
  }

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotifIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        return newSet;
    });
  };

  const handleDeleteSelected = () => {
      if (selectedNotifIds.size === 0) return;
      deleteNotifications(Array.from(selectedNotifIds));
      setSelectedNotifIds(new Set());
  };

  const handleSelectAll = () => {
    if (allSelected) {
        setSelectedNotifIds(new Set());
    } else {
        setSelectedNotifIds(new Set(displayedNotifications.map(n => n.id)));
    }
  };

  const allSelected = displayedNotifications.length > 0 && selectedNotifIds.size === displayedNotifications.length;
  
  const isAdmin = user?.role === 'admin';

  if (authLoading || !user || (user.role === 'staff' && !shopId) || (user.role === 'staff' && !isStaffActive)) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }
  
  const adminNavItems = [
      { href: "/dashboard", pageName: 'Dashboard', icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/inventory", pageName: 'OffCounter', icon: Warehouse, label: "OffCounter" },
      { href: "/dashboard/godown", pageName: 'Godown', icon: Archive, label: "Godown" },
      { href: "/dashboard/onbar", pageName: 'OnBar', icon: GlassWater, label: "OnBar" },
      { href: "/dashboard/daily-sale", pageName: 'Daily Sale', icon: TrendingUp, label: "Daily Sale" },
      { href: "/dashboard/reports", pageName: 'Reports', icon: FileText, label: "Reports" },
      // Items for "More" dropdown
      { href: "/dashboard/sales", pageName: 'POS', icon: ShoppingCart, label: "POS" },
      { href: "/dashboard/map-barcode", pageName: 'Map Barcodes', icon: Barcode, label: "Map Barcodes" },
      { href: "/dashboard/staff", pageName: 'Staff', icon: Users, label: "Staff" },
      { href: "/dashboard/performance", pageName: 'Performance', icon: TrendingUp, label: "Performance" },
  ];

  const staffNavItems = [
      { href: "/dashboard/inventory", pageName: 'OffCounter', icon: Warehouse, label: "OffCounter" },
      { href: "/dashboard/godown", pageName: 'Godown', icon: Archive, label: "Godown" },
      { href: "/dashboard/onbar", pageName: 'OnBar', icon: GlassWater, label: "OnBar" },
      { href: "/dashboard/daily-sale", pageName: 'Daily Sale', icon: TrendingUp, label: "Daily Sale" },
       // Items for "More" dropdown
      { href: "/dashboard/sales", pageName: 'POS', icon: ShoppingCart, label: "POS" },
      { href: "/dashboard/map-barcode", pageName: 'Map Barcodes', icon: Barcode, label: "Map Barcodes" },
  ];
  
  const navItems = isAdmin ? adminNavItems : staffNavItems;
  const criticalNavItems = isAdmin ? adminNavItems.slice(0, 6) : staffNavItems.slice(0, 4);
  const moreNavItems = isAdmin ? adminNavItems.slice(6) : staffNavItems.slice(4);
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
        {selectedNotification && (
             <NotificationDialog 
                isOpen={isNotificationDialogOpen}
                onOpenChange={setNotificationDialogOpen}
                notification={selectedNotification}
             />
        )}
        {user?.photoURL_large && (
            <ProfilePictureDialog
                isOpen={isProfilePicOpen}
                onOpenChange={setIsProfilePicOpen}
                imageUrl={user.photoURL_large}
                userName={user.name || ''}
                onEditClick={() => {
                  const settingsElement = document.getElementById('profile-picture-upload-button');
                  if(settingsElement) {
                    router.push('/dashboard/settings');
                    setTimeout(() => document.getElementById('profile-picture-upload-button')?.click(), 100);
                  }
                }}
            />
        )}
       <AlertDialog open={isSupportDialogOpen} onOpenChange={setIsSupportDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary"/> Support Information
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                       For any help or issues, please contact the administrators using the details below.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="text-sm space-y-4">
                    <div>
                        <p className="font-semibold">Ashish Kumar Rai</p>
                        <p><strong>WhatsApp:</strong> <a href="https://wa.me/919123849124" target="_blank" rel="noopener noreferrer" className="text-primary underline">+91 9123849124</a></p>
                        <p><strong>Email:</strong> <a href="mailto:mrashis0603@gmail.com" className="text-primary underline">mrashis0603@gmail.com</a></p>
                    </div>
                    <Separator />
                    <div>
                        <p className="font-semibold">Vijay Kumar Rai</p>
                        <p><strong>WhatsApp:</strong> <a href="https://wa.me/918240339330" target="_blank" rel="noopener noreferrer" className="text-primary underline">+91 8240339330</a></p>
                        <p><strong>Email:</strong> <a href="mailto:vijayrai28385@gmail.com" className="text-primary underline">vijayrai28385@gmail.com</a></p>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setIsSupportDialogOpen(false)}>Close</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

       <header className="sticky top-0 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6 z-50">
        <div className="flex items-center gap-4">
           <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
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
                        item.label && (
                           <NavLink key={item.href} href={item.href} pageName={item.pageName} onNavigate={handleNav}>
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </NavLink>
                        )
                    ))}
                </nav>
            </SheetContent>
          </Sheet>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <Logo className="h-9 w-auto" />
          </Link>
        </div>
        
         <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
                {criticalNavItems.map(item => (
                    <NavLink key={item.href} href={item.href} pageName={item.pageName} onNavigate={handleNav}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </NavLink>
                ))}
                {moreNavItems.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-primary">
                                <MoreHorizontal className="h-4 w-4" />
                                More
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {moreNavItems.map(item => (
                                <DropdownMenuItem key={item.href} onSelect={() => handleNav(item.href, item.pageName)} className="cursor-pointer">
                                    <item.icon className="mr-2 h-4 w-4" />
                                    <span>{item.label}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </nav>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <RealTimeClock />
          <ThemeToggle />
          <DropdownMenu onOpenChange={() => setSelectedNotifIds(new Set())}>
            <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="icon" className="rounded-full relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                            {unreadCount}
                        </span>
                    )}
                    <span className="sr-only">Toggle notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96">
                <div className="flex items-center justify-between p-2">
                    <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => markAllAsRead()}>
                                Mark all as read
                            </Button>
                        )}
                        <Button variant="destructive" size="sm" className="p-0 h-auto text-xs" onClick={handleDeleteSelected} disabled={selectedNotifIds.size === 0}>
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete ({selectedNotifIds.size})
                        </Button>
                    </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {displayedNotifications.length > 0 && (
                        <div className="flex items-center gap-2 px-2 pb-2 border-b">
                            <Checkbox
                                id="select-all-notifs"
                                checked={allSelected}
                                onCheckedChange={handleSelectAll}
                                aria-label="Select all notifications"
                            />
                            <label htmlFor="select-all-notifs" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Select All
                            </label>
                        </div>
                    )}
                    {displayedNotifications.length > 0 ? (
                        <ScrollArea className="h-[300px]">
                            {displayedNotifications.map(n => {
                                const isRead = n.readBy.includes(user?.uid || '');
                                return (
                                <div key={n.id} className={cn(
                                        "flex items-start gap-3 p-2 text-sm rounded-md",
                                        !isRead && "bg-primary/5"
                                    )}
                                >
                                    <Checkbox
                                        id={`notif-${n.id}`}
                                        className="mt-1"
                                        checked={selectedNotifIds.has(n.id)}
                                        onCheckedChange={() => toggleNotificationSelection(n.id)}
                                        onClick={(e) => e.stopPropagation()} 
                                    />
                                    <div className="flex-1 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                                        <div className="flex items-center gap-2">
                                            {!isRead && <Circle className="h-2 w-2 fill-primary text-primary" />}
                                            <p className={cn('font-semibold', isRead ? 'text-muted-foreground' : '')}>{n.title}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                                        {n.createdAt && (
                                            <p className="text-xs text-muted-foreground mt-1">{formatDate(n.createdAt.toDate(), 'dd-MM-yyyy hh:mm a')}</p>
                                        )}
                                    </div>
                                </div>
                            )})}
                        </ScrollArea>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground p-4">
                            No notifications yet.
                        </div>
                    )}
                </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar>
                  {user.photoURL ? (
                    <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />
                  ) : null}
                  <AvatarFallback>
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center gap-2">
                <div onClick={() => user?.photoURL_large && setIsProfilePicOpen(true)} className="cursor-pointer">
                    {user.displayName || 'My Account'}
                </div>
                {user.role === 'admin' && <Badge variant="destructive">Admin</Badge>}
                {user.role === 'staff' && <Badge variant="secondary">Staff</Badge>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/dashboard/settings">
                <DropdownMenuItem>Settings</DropdownMenuItem>
              </Link>
              {user.role === 'staff' && (
                <DropdownMenuItem onSelect={() => setIsSupportDialogOpen(true)}>Support</DropdownMenuItem>
              )}
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
