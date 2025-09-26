
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

const CelestialElixirBottle = () => {
    return (
        <div className="relative w-64 h-96 flex items-center justify-center -mt-4 -mb-4">
            <svg viewBox="0 0 180 270" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="liquidGradient" x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stopColor="#4A2E04" />
                        <stop offset="30%" stopColor="#A66A00" />
                        <stop offset="70%" stopColor="#FFC93C" />
                        <stop offset="100%" stopColor="#FFFF8D" />
                    </linearGradient>
                    <clipPath id="liquidMask">
                        <path d="M41 260V120C41 90 31 70 60 70H120C149 70 139 90 139 120V260H41Z" />
                    </clipPath>
                    <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feComponentTransfer in="SourceGraphic">
                            <feFuncA type="gamma" amplitude="1.5" exponent="1.2" offset="0"/>
                        </feComponentTransfer>
                        <feGaussianBlur stdDeviation="5" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="atop"/>
                    </filter>
                </defs>

                {/* Main Bottle Shape with white outline */}
                <g filter="url(#drop-shadow)">
                    <path 
                        d="M40 260V120C40 90 30 70 60 70H120C150 70 140 90 140 120V260H40Z" 
                        fill="hsl(var(--card-foreground) / 0.05)"
                        strokeWidth="3"
                        stroke="rgba(255,255,255,0.7)"
                    />
                    <path 
                        d="M70 70V30H110V70"
                        strokeWidth="3"
                        stroke="rgba(255,255,255,0.7)"
                        fill="hsl(var(--card-foreground) / 0.05)"
                    />
                     <path 
                        d="M70 70V30H110V70"
                        strokeWidth="0"
                        fill="hsl(var(--card-foreground) / 0.05)"
                    />
                </g>
                
                {/* Liquid */}
                <g clipPath="url(#liquidMask)">
                    <rect x="30" y="95" width="120" height="165" fill="url(#liquidGradient)" filter="url(#innerGlow)" />
                </g>

                 {/* Bottle Glass without outline (for overlaps) */}
                 <g>
                    <path 
                        d="M40 260V120C40 90 30 70 60 70H120C150 70 140 90 140 120V260H40Z" 
                        fill="hsl(var(--card-foreground) / 0.05)"
                    />
                    <path 
                        d="M70 70V30H110V70"
                        fill="hsl(var(--card-foreground) / 0.05)"
                    />
                </g>

                {/* Highlights */}
                <path d="M50,250 C 52,150 50,80 65,75" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                <path d="M130,250 Q 120,180 132,120" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>


                {/* Label */}
                <g transform="translate(62 165)">
                    <path d="M0 0 H56 Q66 0 66 10 V60 Q66 70 56 70 H0 Q-10 70 -10 60 V10 Q-10 0 0 0Z" fill="#F3EADF" stroke="#4A2E04" strokeWidth="0.5"/>
                    
                    <text x="28" y="15" textAnchor="middle" fontFamily="serif" fontSize="8" fill="#4A2E04" fontWeight="bold" letterSpacing="0.5">
                        CELESTIAL ELIXIR
                    </text>
                    
                    <g transform="translate(28, 33) scale(0.4)">
                        {/* Crescent Moon */}
                        <path d="M-15 0 A15 15 0 1 0 -15 0 Z" fill="#4A2E04"/>
                        <path d="M-10 0 A12 12 0 1 0 -10 0 Z" fill="#F3EADF"/>
                        
                        {/* Star */}
                        <g transform="translate(8, -2)">
                            <path d="M0 -10 L2 -2 H10 L4 2 L6 10 L0 5 L-6 10 L-4 2 H-10 L-2 -2 Z" fill="#4A2E04"/>
                            <use href="#sparkle" transform="translate(5, 5) scale(0.5)" />
                        </g>

                         {/* Sparkles */}
                        <path id="sparkle" d="M-5 0 L5 0 M0 -5 L0 5" stroke="#4A2E04" strokeWidth="1.5" strokeLinecap="round"/>
                        <use href="#sparkle" transform="translate(-13, -8) scale(0.6) rotate(20)"/>
                        <use href="#sparkle" transform="translate(14, 10) scale(0.4) rotate(-30)"/>
                    </g>
                    
                    <text x="28" y="50" textAnchor="middle" fontFamily="serif" fontSize="6" fill="#4A2E04">
                        FINE SPIRITS
                    </text>
                    <text x="28" y="62" textAnchor="middle" fontFamily="sans-serif" fontSize="5" fill="#4A2E04">
                        Est. 1992
                    </text>
                </g>

                {/* Cork */}
                <rect x="75" y="5" width="30" height="25" fill="#6F4E37" />
                <path d="M75 30 H105" stroke="rgba(255,255,255,0.7)" strokeWidth="3"/>
                <path d="M75 5 Q90 -1 105 5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/>
            </svg>
        </div>
    );
};

export default CelestialElixirBottle;
