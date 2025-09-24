
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

const AnimatedGlass = () => {
    return (
        <div className="relative w-32 h-48">
            {/* Glass structure */}
            <svg viewBox="0 0 100 150" className="w-full h-full">
                {/* Glass outline */}
                <path 
                    d="M20 148 L25 5 C25 -5 75 -5 75 5 L80 148 Z" 
                    className="stroke-muted-foreground/50 fill-transparent" 
                    strokeWidth="2"
                />
                {/* Liquid fill area (clipped) */}
                <defs>
                    <clipPath id="glass-clip">
                         <path d="M22 146 L27 7 C27 -3 73 -3 73 7 L78 146 Z" />
                    </clipPath>
                </defs>
                 {/* Liquid */}
                <g clipPath="url(#glass-clip)">
                    <rect className="animated-liquid fill-amber-500" x="20" y="148" width="60" height="143" />
                     {/* Waves on top */}
                    <path 
                        className="animated-wave stroke-amber-300/80" 
                        strokeWidth="2" 
                        fill="none" 
                        d="M20,0 C30,10 40,0 50,10 C60,20 70,0 80,10"
                    />
                </g>
            </svg>
        </div>
    );
};

export default AnimatedGlass;
