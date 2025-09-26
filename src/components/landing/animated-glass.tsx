
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

const CelestialElixirBottle = () => {
    return (
        <div className="relative w-56 h-80 flex items-center justify-center">
            <svg viewBox="0 0 180 270" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="liquidGradient" x1="0.5" y1="0" x2="0.5" y2="1">
                        <stop offset="0%" stopColor="#6B3E1F" />
                        <stop offset="50%" stopColor="#B87333" />
                        <stop offset="100%" stopColor="#EBC96F" />
                    </linearGradient>
                    <clipPath id="liquidMask">
                        <path d="M41 260 V100 C41 70, 30 60, 60 60 H120 C150 60, 139 70, 139 100 V260 H41Z" />
                    </clipPath>
                     <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feComponentTransfer in="SourceGraphic">
                            <feFuncA type="gamma" amplitude="1.5" exponent="1.2" offset="0"/>
                        </feComponentTransfer>
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feComposite in="SourceGraphic" in2="blur" operator="atop"/>
                    </filter>
                </defs>

                {/* Main Bottle Shape with white outline */}
                <g>
                    <path 
                        d="M40 260 V100 C40 70, 30 60, 60 60 H120 C150 60, 140 70, 140 100 V260 H40Z"
                        fill="hsl(var(--card-foreground) / 0.05)"
                        strokeWidth="2"
                        stroke="rgba(255,255,255,0.5)"
                    />
                    <path 
                        d="M65 60 V30 H115 V60"
                        strokeWidth="2"
                        stroke="rgba(255,255,255,0.5)"
                        fill="hsl(var(--card-foreground) / 0.05)"
                    />
                </g>
                
                {/* Liquid */}
                <g clipPath="url(#liquidMask)">
                    <rect x="30" y="105" width="120" height="155" fill="url(#liquidGradient)" filter="url(#innerGlow)"/>
                </g>

                 {/* Bottle Glass overlay for reflections (no outline) */}
                 <g>
                    <path 
                        d="M40 260 V100 C40 70, 30 60, 60 60 H120 C150 60, 140 70, 140 100 V260 H40Z" 
                        fill="hsl(var(--card-foreground) / 0.07)"
                    />
                    <path 
                        d="M65 60 V30 H115 V60"
                        fill="hsl(var(--card-foreground) / 0.07)"
                    />
                </g>

                {/* Highlights */}
                <path d="M50,250 C 52,180 50,110 65,105" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"/>
                <path d="M130,250 Q 125,190 132,140" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.15"/>

                {/* Label */}
                <g transform="translate(55 155)">
                    <rect x="0" y="0" width="70" height="80" rx="5" ry="5" fill="#EBDDC2" stroke="#4A2C57" strokeWidth="0.5" />
                    
                    <text x="35" y="18" textAnchor="middle" fontFamily="serif" fontSize="9" fill="#4A2C57" fontWeight="bold">
                        CELESTIAL
                    </text>
                     <text x="35" y="29" textAnchor="middle" fontFamily="serif" fontSize="9" fill="#4A2C57" fontWeight="bold">
                        ELIXIR
                    </text>
                    
                    <g transform="translate(35, 45) scale(0.4)">
                        <path d="M-15 0 A15 15 0 1 0 -15 0 Z" fill="#4A2C57"/>
                        <path d="M-10 0 A12 12 0 1 0 -10 0 Z" fill="#EBDDC2"/>
                        <g transform="translate(8, -2)">
                            <path d="M0 -10 L2 -2 H10 L4 2 L6 10 L0 5 L-6 10 L-4 2 H-10 L-2 -2 Z" fill="#4A2C57"/>
                        </g>
                    </g>
                    
                    <text x="35" y="62" textAnchor="middle" fontFamily="serif" fontSize="7" fill="#4A2C57">
                        FINE SPIRITS
                    </text>
                    <text x="35" y="73" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#4A2C57">
                        Est. 1892
                    </text>
                </g>

                {/* Cork */}
                <rect x="68" y="10" width="44" height="20" fill="#8D5524" />
                <path d="M65 30 H115" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
                <path d="M68 10 Q90 6 112 10" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5"/>
            </svg>
        </div>
    );
};

export default CelestialElixirBottle;
