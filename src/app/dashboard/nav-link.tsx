"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
    href: string;
    children: React.ReactNode;
    Icon: React.ElementType;
}

export default function NavLink({ href, children, Icon }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link 
            href={href}
            className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                isActive ? "text-primary" : "text-muted-foreground"
            )}
        >
            <Icon className="h-4 w-4" />
            {children}
        </Link>
    )
}