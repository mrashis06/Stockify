
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

const AnimatedGlass = () => {
    // Generate random values for bubbles
    const bubbles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      cx: 35 + Math.random() * 30, // Random x position within the liquid
      cy: 180, // Start at the bottom
      r: Math.random() * 1.5 + 0.5, // Random radius
      duration: `${3 + Math.random() * 4}s`, // Random duration
      delay: `${Math.random() * 5}s`, // Random delay
      xEnd: `${(Math.random() - 0.5) * 20}px`, // Random horizontal drift
    }));

    return (
        <div className="relative w-48 h-64 flex items-center justify-center">
            <svg viewBox="0 0 100 150" className="w-full h-full overflow-visible">
                {/* Filters for glow effects */}
                <defs>
                    <filter id="liquid-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="aura-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="15" result="coloredBlur" />
                    </filter>
                     <radialGradient id="liquid-gradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FFD700" />
                        <stop offset="100%" stopColor="#FFA500" />
                    </radialGradient>
                </defs>

                {/* Pulsing Aura */}
                <ellipse cx="50" cy="100" rx="40" ry="50" fill="url(#liquid-gradient)" opacity="0.6" filter="url(#aura-glow)" className="animate-[pulse-glow_5s_ease-in-out_infinite]" />

                {/* Light Rays */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map(rot => (
                    <rect 
                        key={rot}
                        x="49.5" y="-50" 
                        width="1" height="300"
                        fill="white"
                        className="origin-center animate-[ray-fade_8s_ease-in-out_infinite]"
                        style={{ transform: `rotate(${rot}deg)`, animationDelay: `${rot / 45}s` }}
                    />
                ))}

                {/* Glass and Liquid Group */}
                <g className="drop-shadow-lg dark:drop-shadow-[0_0_10px_#FFA500]">
                    {/* Liquid fill area */}
                    <path
                        d="M25 140 Q50 120 75 140 L78 20 Q50 40 22 20 Z"
                        fill="url(#liquid-gradient)"
                        filter="url(#liquid-glow)"
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
                                animationDuration: b.duration, 
                                animationDelay: b.delay,
                                '--bubble-x-end': b.xEnd 
                            } as React.CSSProperties}
                        />
                        ))}
                    </g>
                    
                    {/* Glass Outline */}
                    <path 
                        d="M20 148 L25 5 C25 -5 75 -5 75 5 L80 148 C85 155 15 155 20 148 Z" 
                        className="stroke-muted-foreground/30 dark:stroke-amber-300/30 fill-white/10 dark:fill-white/5" 
                        strokeWidth="1.5"
                    />

                    {/* Smoke wisps */}
                    <g>
                        <path d="M40 5 Q45 -10 50 5" stroke="#ccc" strokeOpacity="0.5" strokeWidth="1" fill="none" className="animate-[smoke-fade_6s_ease-in-out_infinite]" style={{ animationDelay: '0s' }}/>
                        <path d="M50 5 Q55 -15 60 5" stroke="#ccc" strokeOpacity="0.5" strokeWidth="1" fill="none" className="animate-[smoke-fade_6s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
                        <path d="M45 5 Q50 -10 55 5" stroke="#ccc" strokeOpacity="0.5" strokeWidth="1" fill="none" className="animate-[smoke-fade_6s_ease-in-out_infinite]" style={{ animationDelay: '4s' }}/>
                    </g>
                </g>
            </svg>
        </div>
    );
};

export default AnimatedGlass;
