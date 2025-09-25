
import { cn } from "@/lib/utils";
import React from "react";

const Logo = React.forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement>
>(({ className, ...props }, ref) => {
    return (
        <svg
            ref={ref}
            viewBox="0 0 235 50"
            className={cn("text-foreground", className)}
            {...props}
        >
            <style>{`
                .logo-fill { fill: hsl(var(--foreground)); }
                .logo-o-stroke { stroke: hsl(var(--foreground)); }

                @keyframes cycle-liquid-color {
                    0%, 100% { stop-color: #FFC107; } /* Amber */
                    33% { stop-color: #9C27B0; } /* Purple/Wine */
                    66% { stop-color: #E0E0E0; } /* Clear/Vodka */
                }

                @keyframes slosh {
                    0%, 100% { transform: translate(0, 0) rotate(0); }
                    25% { transform: translate(-3px, 1px) rotate(-2deg); }
                    50% { transform: translate(2px, -1px) rotate(1deg); }
                    75% { transform: translate(-1px, 2px) rotate(-1deg); }
                }

                .liquid-color-cycle {
                    animation: cycle-liquid-color 15s ease-in-out infinite;
                }
                .liquid-slosh {
                    animation: slosh 3s ease-in-out infinite;
                }
            `}</style>
            
            {/* Manually kerned 'St' */}
            <text x="0" y="40" fontSize="50" fontWeight="bold" className="logo-fill">St</text>
            
            {/* The custom animated 'o' */}
            <g transform="translate(60, 0)"> 
                <defs>
                    <clipPath id="circle-clip">
                        <circle cx="22.5" cy="22.5" r="21.5" />
                    </clipPath>
                    <linearGradient id="liquid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                         <stop offset="0%" className="liquid-color-cycle" />
                         <stop offset="100%" className="liquid-color-cycle" style={{ animationDelay: '-7.5s' }} />
                    </linearGradient>
                </defs>

                {/* Liquid animation, clipped inside the circle */}
                <g clipPath="url(#circle-clip)">
                    <g className="liquid-slosh">
                        <path 
                           d="M -5,28 
                           C 10,25 20,32 30,28
                           C 40,22 45,32 55,28
                           L 55,50 L -5,50 Z"
                           fill="url(#liquid-gradient)"
                        />
                    </g>
                </g>
                
                {/* The circle outline */}
                <circle cx="22.5" cy="22.5" r="21.5" className="logo-o-stroke" fill="none" strokeWidth="2.5" />
            </g>

            {/* Manually kerned 'ckify' part */}
            <text x="108" y="40" fontSize="50" fontWeight="bold" className="logo-fill">ckify</text>
        </svg>
    );
});

Logo.displayName = "Logo";

export default Logo;


