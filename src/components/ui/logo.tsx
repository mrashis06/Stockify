
import { cn } from "@/lib/utils";
import React from "react";

const Logo = React.forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => {
    return (
        <svg
            ref={ref}
            viewBox="0 0 240 60"
            className={cn("text-foreground", className)}
            {...props}
        >
            <style>{`
                .logo-fill-1 { fill: hsl(var(--logo-color-1)); }
                .logo-fill-2 { fill: hsl(var(--logo-color-2)); }
                .logo-fill-3 { fill: hsl(var(--logo-color-3)); }
                .logo-o-fill { fill: #F57C00; }
                .logo-bubble-fill { fill: #FFE0B2; }
            `}</style>
            <text x="0" y="48" fontSize="50" fontWeight="bold" className="logo-fill-1">St</text>
            
            {/* The custom 'o' */}
            <g transform="translate(68, 8)">
                <circle cx="21" cy="21" r="21" className="logo-o-fill" />
                <path d="M 2,21 a 19,19 0 0,1 38,0" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.3" />
                <circle cx="12" cy="25" r="3" className="logo-bubble-fill" opacity="0.8"/>
                <circle cx="21" cy="18" r="2" className="logo-bubble-fill" opacity="0.7"/>
                <circle cx="30" cy="28" r="2.5" className="logo-bubble-fill" opacity="0.9"/>
            </g>

            <text x="120" y="48" fontSize="50" fontWeight="bold" className="logo-fill-2">ckify</text>
        </svg>
    );
});

Logo.displayName = "Logo";

export default Logo;
