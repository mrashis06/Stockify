
import { cn } from "@/lib/utils";
import React from "react";

const Logo = React.forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => {
    return (
        <svg
            ref={ref}
            viewBox="0 0 240 50" // Adjusted viewBox for better alignment
            className={cn("text-foreground", className)}
            {...props}
        >
            <style>{`
                .logo-fill-1 { fill: hsl(var(--foreground)); }
                .logo-fill-2 { fill: hsl(var(--foreground)); }
                .logo-o-stroke { stroke: hsl(var(--foreground)); }
                .logo-o-fill { fill: #F57C00; } /* Amber/Orange color */
            `}</style>
            
            {/* Using a text element for consistent font rendering and alignment */}
            <text x="0" y="40" fontSize="50" fontWeight="bold" className="logo-fill-1">St</text>
            
            {/* The custom 'o' */}
            <g transform="translate(68, 0)">
                <defs>
                    <clipPath id="half-fill">
                        <rect x="0" y="22.5" width="45" height="22.5" />
                    </clipPath>
                </defs>
                <circle cx="22.5" cy="22.5" r="21.5" className="logo-o-stroke" fill="none" strokeWidth="2.5" />
                <circle cx="22.5" cy="22.5" r="21.5" className="logo-o-fill" clipPath="url(#half-fill)" />
            </g>

            <text x="120" y="40" fontSize="50" fontWeight="bold" className="logo-fill-2">ckify</text>
        </svg>
    );
});

Logo.displayName = "Logo";

export default Logo;
