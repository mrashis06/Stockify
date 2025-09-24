
"use client";

import React, { useState, useEffect } from 'react';

const AnimatedGlass = () => {
    // This component is now a bottle, but we keep the name to avoid breaking imports.
    return (
        <div className="relative w-48 h-64 flex items-center justify-center">
            <svg
                width="100"
                height="250"
                viewBox="0 0 100 250"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-lg"
            >
                {/* Bottle Glass Outline - with slight transparency */}
                <path 
                    d="M35,245 L35,60 C35,50 30,40 40,40 L60,40 C70,40 65,50 65,60 L65,245 L35,245 Z" 
                    className="fill-current text-muted-foreground/20"
                />
                {/* Neck */}
                <path
                    d="M40 40 L40 20 L60 20 L60 40 Z"
                    className="fill-current text-muted-foreground/20"
                />
                {/* Cork */}
                 <path
                    d="M42 0H58V20H42V0Z"
                    className="fill-current text-amber-900/80"
                />

                {/* Liquid - This part is clipped by the bottle shape */}
                <defs>
                    <clipPath id="bottleClip">
                         {/* This path is slightly smaller than the bottle to contain the liquid */}
                        <path d="M37,243 L37,60 C37,52 32,42 42,42 L58,42 C68,42 63,52 63,60 L63,243 L37,243 Z" />
                    </clipPath>
                </defs>

                {/* The liquid that fills up */}
                <g clipPath="url(#bottleClip)">
                    <rect
                        x="37"
                        y="93" 
                        width="26"
                        height="150"
                        className="fill-yellow-500"
                        style={{ animation: 'fill-up 5s ease-in-out infinite' }}
                    />
                     {/* Wavy surface on top of the liquid */}
                    <path
                        d="M37 93 C47 88, 53 98, 63 93 V243 H37 Z"
                        className="fill-yellow-500 animate-[wave-move_4s_ease-in-out_infinite]"
                         style={{ animation: 'fill-up-wave 5s ease-in-out infinite' }}
                    />
                </g>
                
                 {/* Glossy highlight */}
                <path 
                    d="M42 70 C45 120, 45 200, 42 240" 
                    stroke="white" 
                    strokeOpacity="0.2" 
                    strokeWidth="1.5" 
                    fill="none" 
                />
            </svg>
             <style jsx>{`
                @keyframes fill-up {
                    from { transform: translateY(150px); }
                    to { transform: translateY(0px); }
                }
                @keyframes fill-up-wave {
                    from { transform: translateY(150px); }
                    to { transform: translateY(0px); }
                }
                @keyframes wave-move {
                    0% { transform: translateX(0); }
                    50% { transform: translateX(-2px); }
                    100% { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};

export default AnimatedGlass;
