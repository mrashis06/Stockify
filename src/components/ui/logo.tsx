
import { cn } from "@/lib/utils";
import React from "react";

const Logo = React.forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => {
    return (
        <svg
            ref={ref}
            viewBox="0 0 225 60"
            className={cn("text-foreground", className)}
            {...props}
        >
            <style>{`
                .logo-fill-1 { fill: hsl(var(--logo-color-1)); }
                .logo-fill-2 { fill: hsl(var(--logo-color-2)); }
                .logo-fill-3 { fill: hsl(var(--logo-color-3)); }
                .logo-glass-stroke { stroke: hsl(var(--logo-glass)); }
            `}</style>
            <text x="0" y="45" fontSize="50" fontWeight="bold" className="logo-fill-1">St</text>
            
            <g transform="translate(58, 2.5) rotate(15 25 25)">
                <rect x="0" y="0" width="50" height="50" rx="5" ry="5" fill="none" strokeWidth="3" className="logo-glass-stroke" />
                <path d="M 5 30 C 15 20, 35 20, 45 30 L 45 45 L 5 45 Z" fill="#F57C00" />
                <circle cx="15" cy="38" r="3" fill="#FFE0B2" />
                <circle cx="27" cy="35" r="2.5" fill="#FFE0B2" />
                <circle cx="38" cy="40" r="2" fill="#FFE0B2" />
            </g>

            <text x="110" y="45" fontSize="50" fontWeight="bold" className="logo-fill-2">ck</text>
            <text x="170" y="45" fontSize="50" fontWeight="bold" className="logo-fill-3">ify</text>
        </svg>
    );
});

Logo.displayName = "Logo";

export default Logo;
