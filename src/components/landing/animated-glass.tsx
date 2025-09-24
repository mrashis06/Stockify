
"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type Bubble = {
    id: number;
    cx: number;
    cy: number;
    r: number;
    duration: string;
    delay: string;
    xEnd: string;
};

const AnimatedGlass = () => {
    const [bubbles, setBubbles] = useState<Bubble[]>([]);

    useEffect(() => {
        // Generate random values for bubbles only on the client to avoid hydration errors
        const generateBubbles = () => {
            return Array.from({ length: 15 }).map((_, i) => ({
                id: i,
                cx: 35 + Math.random() * 30, // Random x position within the liquid
                cy: 180, // Start at the bottom
                r: Math.random() * 1.5 + 0.5, // Random radius
                duration: `${3 + Math.random() * 4}s`, // Random duration
                delay: `${Math.random() * 5}s`, // Random delay
                xEnd: `${(Math.random() - 0.5) * 20}px`, // Random horizontal drift
            }));
        };
        setBubbles(generateBubbles());
    }, []);

    return (
        <div className="relative w-48 h-64 flex items-center justify-center">
            <svg viewBox="0 0 100 150" className="w-full h-full overflow-visible">
                <defs>
                    <clipPath id="glass-mask">
                        <path d="M22 140 C22 145, 78 145, 78 140 L78 20 Q78 5, 50 5 Q22 5, 22 20 Z" />
                    </clipPath>
                    <linearGradient id="liquid-gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#FFA500" />
                        <stop offset="100%" stopColor="#FFC107" />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* The group for liquid and bubbles, clipped by the glass mask */}
                <g clipPath="url(#glass-mask)" filter="url(#glow)">
                    {/* The main liquid body */}
                    <rect x="20" y="70" width="60" height="70" fill="url(#liquid-gradient)" />
                    
                    {/* Wavy surface on top of the liquid */}
                    <path
                        d="M20 70 C35 65, 65 75, 80 70 V140 H20 Z"
                        fill="url(#liquid-gradient)"
                        className="animate-[wave_4s_ease-in-out_infinite]"
                    />

                    {/* Bubbles rising within the liquid */}
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
                                    animationDuration: b.duration, 
                                    animationDelay: b.delay,
                                    '--bubble-x-end': b.xEnd 
                                } as React.CSSProperties}
                            />
                        ))}
                    </g>
                </g>

                {/* The glass outline */}
                <path 
                    d="M20 148 C20 155, 80 155, 80 148 L80 20 Q80 0, 50 0 Q20 0, 20 20 Z" 
                    className="fill-white/10 dark:fill-white/5 stroke-muted-foreground/30 dark:stroke-amber-300/30" 
                    strokeWidth="1.5"
                    style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))' }}
                />
                 {/* Glossy highlight on the glass */}
                <path 
                    d="M25 25 C30 50, 30 100, 25 130" 
                    stroke="white" 
                    strokeOpacity="0.2" 
                    strokeWidth="1.5" 
                    fill="none" 
                />
            </svg>
        </div>
    );
};

export default AnimatedGlass;
