
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
    href: string;
    children: React.ReactNode;
    pageName: string;
    onNavigate: (href: string, pageName: string) => void;
}

export default function NavLink({ href, children, pageName, onNavigate }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (pathname !== href) {
            e.preventDefault();
            onNavigate(href, pageName);
        }
    };

    return (
        <Link 
            href={href}
            onClick={handleClick}
            className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                isActive ? "text-primary" : "text-foreground/80"
            )}
        >
            {children}
        </Link>
    )
}
