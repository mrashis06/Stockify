
"use client";

import React, { useState, useEffect } from 'react';

type Bubble = {
    id: number;
    cx: number;
    cy: number;
    r: number;
    animationDuration: string;
    animationDelay: string;
    xEnd: string;
};

const AnimatedGlass = () => {
    const [bubbles, setBubbles] = useState<Bubble[]>([]);

    useEffect(() => {
        const newBubbles: Bubble[] = Array.from({ length: 15 }).map((_, i) => ({
            id: i,
            cx: 35 + Math.random() * 30, // Start within the liquid base
            cy: 180, // Start from the bottom
            r: Math.random() * 1.5 + 0.5,
            animationDuration: `${Math.random() * 3 + 3}s`, // 3s to 6s duration
            animationDelay: `${Math.random() * 5}s`,
            xEnd: `${(Math.random() - 0.5) * 20}px` // Horizontal drift
        }));
        setBubbles(newBubbles);
    }, []);

    return (
        <div className="relative w-48 h-72 flex items-center justify-center">
            <svg viewBox="0 0 100 150" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#FFD700', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#F5B000', stopOpacity: 1 }} />
                    </linearGradient>
                    <clipPath id="bottle-mask">
                         <path d="M 35,140 L 35,60 C 35,50 30,40 40,40 L 60,40 C 70,40 65,50 65,60 L 65,140 Z" />
                    </clipPath>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Bottle Outline */}
                <path d="M 35,140 L 35,60 C 35,50 30,40 40,40 L 60,40 C 70,40 65,50 65,60 L 65,140 Z" 
                    fill="hsl(var(--card-foreground) / 0.05)" 
                    stroke="hsl(var(--card-foreground) / 0.2)" 
                    strokeWidth="0.5"
                />
                 {/* Neck */}
                <path
                    d="M40 40 L40 20 L60 20 L60 40 Z"
                    fill="hsl(var(--card-foreground) / 0.05)"
                    stroke="hsl(var(--card-foreground) / 0.2)" 
                    strokeWidth="0.5"
                />
                {/* Cork */}
                <path
                    d="M42 0H58V20H42V0Z"
                    className="fill-current text-amber-900/80"
                    stroke="hsl(var(--card-foreground) / 0.2)" 
                    strokeWidth="0.5"
                />


                {/* Liquid and Bubbles */}
                <g clipPath="url(#bottle-mask)">
                    {/* Wavy liquid */}
                    <path
                        d="M 10,90 
                           C 25,85 40,95 50,90 
                           T 90,90
                           L 90,150 L 10,150 Z"
                        fill="url(#liquidGradient)"
                        className="animate-[wave_4s_ease-in-out_infinite]"
                    />
                    
                    {/* Bubbles */}
                    <g>
                        {bubbles.map(b => (
                        <circle
                            key={b.id}
                            cx={b.cx}
                            cy={b.cy}
                            r={b.r}
                            fill="#FFD700"
                            opacity="0.7"
                            className="animate-[bubbles-rise_infinite]"
                            style={{
                                '--bubble-x-end': b.xEnd,
                                animationDuration: b.animationDuration,
                                animationDelay: b.animationDelay
                            } as React.CSSProperties}
                        />
                        ))}
                    </g>
                </g>

                {/* Highlights */}
                <path d="M 32,138 Q 50,142 68,138" fill="none" stroke="white" strokeWidth="0.7" strokeOpacity="0.2"/>
            </svg>
            <div className="absolute inset-0 bg-amber-500/10 dark:bg-amber-400/20 rounded-full blur-2xl -z-10 animate-[pulse-glow_5s_ease-in-out_infinite]" />
        </div>
    );
};

export default AnimatedGlass;
