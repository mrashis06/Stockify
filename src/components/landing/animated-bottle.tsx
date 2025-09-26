
"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, useAnimation, useTheme } from 'framer-motion';
import { cn } from '@/lib/utils';

const spiritColors = {
    whiskey: ["#6B3E1F", "#B87333", "#EBC96F"],
    wine: ["#4C0013", "#7C0A02", "#A62C2B"],
    rum: ["#8B4513", "#D2691E", "#F4A460"],
    vodka: ["#a1c4fd", "#c2e9fb", "#dff6fe"],
};

const Bubbles = () => {
    const [bubbles, setBubbles] = useState<any[]>([]);

    useEffect(() => {
        const generateBubbles = () => {
            const newBubbles = Array.from({ length: 15 }).map((_, i) => ({
                id: i,
                x: Math.random() * 80 + 10,
                size: Math.random() * 6 + 2,
                duration: Math.random() * 5 + 3,
                delay: Math.random() * 5,
                opacity: Math.random() * 0.5 + 0.2,
            }));
            setBubbles(newBubbles);
        };
        generateBubbles();
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
            {bubbles.map(bubble => (
                <motion.div
                    key={bubble.id}
                    className="absolute bottom-0 rounded-full bg-white/20"
                    style={{
                        left: `${bubble.x}%`,
                        width: bubble.size,
                        height: bubble.size,
                        opacity: bubble.opacity,
                    }}
                    initial={{ y: 0, opacity: bubble.opacity }}
                    animate={{ y: -280, opacity: 0 }}
                    transition={{
                        duration: bubble.duration,
                        delay: bubble.delay,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />
            ))}
        </div>
    );
};

const AnimatedBottle = () => {
    const { theme } = useTheme();
    const [currentColorSet, setCurrentColorSet] = useState(spiritColors.whiskey);
    const [colorIndex, setColorIndex] = useState(0);

    const colorKeys = Object.keys(spiritColors);

    useEffect(() => {
        const interval = setInterval(() => {
            setColorIndex(prevIndex => (prevIndex + 1) % colorKeys.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [colorKeys.length]);

    useEffect(() => {
        const nextColorKey = colorKeys[colorIndex] as keyof typeof spiritColors;
        setCurrentColorSet(spiritColors[nextColorKey]);
    }, [colorIndex, colorKeys]);


    const isDark = theme === 'dark';

    return (
        <div className="relative w-full max-w-[300px] md:max-w-[500px] aspect-[3/5] flex items-center justify-center">
            
            {/* Background Pulse */}
            <motion.div
                className={cn(
                    "absolute inset-0 rounded-full",
                    isDark ? "bg-gradient-radial from-gray-900 to-black" : "bg-gradient-radial from-white to-gray-100"
                )}
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="relative w-full h-full">
                {/* SVG for clipping mask */}
                <svg width="0" height="0">
                    <defs>
                        <clipPath id="bottleMask" clipPathUnits="objectBoundingBox">
                            <path d="M0.41,0.99V0.38C0.41,0.3,0.36,0.22,0.5,0.22H0.5C0.64,0.22,0.59,0.3,0.59,0.38V0.99H0.41Z M0.5,0.22V0.08H0.5V0.22Z" />
                        </clipPath>
                    </defs>
                </svg>

                {/* Animated Liquid */}
                <motion.div
                    className="absolute inset-0 w-full h-full"
                    style={{ clipPath: 'url(#bottleMask)' }}
                >
                    <motion.div
                        className="w-full h-full"
                        animate={{
                            backgroundImage: [
                                `linear-gradient(to top, ${spiritColors.whiskey[2]}, ${spiritColors.whiskey[1]}, ${spiritColors.whiskey[0]})`,
                                `linear-gradient(to top, ${spiritColors.wine[2]}, ${spiritColors.wine[1]}, ${spiritColors.wine[0]})`,
                                `linear-gradient(to top, ${spiritColors.rum[2]}, ${spiritColors.rum[1]}, ${spiritColors.rum[0]})`,
                                `linear-gradient(to top, ${spiritColors.vodka[2]}, ${spiritColors.vodka[1]}, ${spiritColors.vodka[0]})`,
                                `linear-gradient(to top, ${spiritColors.whiskey[2]}, ${spiritColors.whiskey[1]}, ${spiritColors.whiskey[0]})`,
                            ]
                        }}
                        transition={{
                            duration: 20, // 4 transitions * 5 seconds
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <Bubbles />
                    </motion.div>
                </motion.div>

                {/* Bottle Image */}
                <div className="relative w-full h-full z-10">
                    <Image
                        src="/images/bottle.png"
                        alt="Premium liquor bottle"
                        fill
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
                
                {/* Glossy Reflection */}
                <motion.div
                    className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent z-20 pointer-events-none"
                    style={{ transform: 'skewX(-20deg)' }}
                    animate={{ x: ['-100%', '250%'] }}
                    transition={{
                        duration: 3,
                        delay: 2,
                        repeat: Infinity,
                        repeatDelay: 5,
                        ease: "easeInOut"
                    }}
                />
            </div>
        </div>
    );
};

export default AnimatedBottle;
