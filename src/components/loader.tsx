
"use client";

import { useLoading } from "@/hooks/use-loading";

const BottleIcon = ({ progress, pageName, dynamicText }: { progress: number; pageName: string; dynamicText: string }) => {
    // Determine liquid color based on progress for a smooth transition
    let liquidColorClass = 'fill-amber-500'; // Start with amber
    if (progress > 80) {
        liquidColorClass = 'fill-yellow-400'; // Deep Gold
    } else if (progress > 40) {
        liquidColorClass = 'fill-rose-400'; // Rosé
    }

    const liquidHeight = 2.4 * progress; // Adjusted for new viewbox height

    return (
        <svg
            width="120"
            height="300"
            viewBox="0 0 120 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
        >
            {/* Bottle Glass Outline - with slight transparency */}
            <path 
                d="M40,295 L40,80 C40,65 35,50 50,50 L70,50 C85,50 80,65 80,80 L80,295 L40,295 Z" 
                className="fill-current text-muted-foreground/10"
            />
            {/* Neck */}
            <path
                d="M50 50 L50 20 L70 20 L70 50 Z"
                className="fill-current text-muted-foreground/10"
            />
            {/* Cork */}
             <path
                d="M52 0H68V20H52V0Z"
                className="fill-current text-amber-900/60"
            />

            {/* Liquid - This part is clipped by the bottle shape */}
            <defs>
                <clipPath id="bottleClip">
                    {/* This path is slightly smaller than the bottle to contain the liquid */}
                    <path d="M42,293 L42,80 C42,67 37,52 52,52 L68,52 C83,52 78,67 78,80 L78,293 L42,293 Z" />
                </clipPath>
                 <style>
                    {`
                        @keyframes wave {
                            0% { transform: translateX(0); }
                            50% { transform: translateX(-10px); }
                            100% { transform: translateX(0); }
                        }
                    `}
                </style>
            </defs>

            {/* The liquid that fills up */}
            <g clipPath="url(#bottleClip)">
                 <g className="animate-[wave_4s_ease-in-out_infinite]">
                    <rect
                        x="32"
                        y={293 - liquidHeight}
                        width="56"
                        height={liquidHeight}
                        className={`transition-all duration-700 ease-in-out ${liquidColorClass}`}
                    />
                </g>
            </g>

            {/* Label Area to display percentage */}
            <rect x="43" y="130" width="34" height="40" className="fill-background/30 backdrop-blur-sm rounded-sm" />
            <text x="60" y="150" textAnchor="middle" dominantBaseline="middle" className="font-bold text-lg fill-current text-foreground">
                {Math.round(progress)}%
            </text>
        </svg>
    );
};


export default function Loader() {
  const { isLoading, progress, pageName, dynamicText } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300">
        <div className="absolute inset-0 w-full h-full pointer-events-none">
             <div className="absolute inset-0 bg-background-gradient" />
             <div className="absolute inset-0 bg-spotlight-gradient" />
            <div className="absolute bottom-0 left-0 right-0 h-2/3 flex justify-between items-end px-4 md:px-16 text-foreground/5 dark:text-foreground/10 dark:drop-shadow-[0_0_15px_hsl(var(--foreground)/0.15)]">
                <div className="flex items-end gap-2 md:gap-4">
                     <svg width="40" height="100" viewBox="0 0 40 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-7 md:w-8 -ml-4"><path d="M10 100 V 45 C 8 40, 12 35, 20 35 C 28 35, 32 40, 30 45 V 100 H 10 Z" fill="currentColor" /><path d="M15 35 V 5 H 25 V 35 H 15 Z" fill="currentColor" /></svg>
                     <svg width="70" height="130" viewBox="0 0 70 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-12 md:w-14 -mx-2"><path d="M15 130 V 50 C 15 35, 20 25, 35 25 C 50 25, 55 35, 55 50 V 130 H 15 Z" fill="currentColor"/><path d="M30 25 V 10 H 40 V 25 H 30 Z" fill="currentColor" /></svg>
                     <svg width="60" height="150" viewBox="0 0 60 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12"><path d="M20 150 V 60 C 18 50, 22 45, 30 45 C 38 45, 42 50, 40 60 V 150 H 20 Z" fill="currentColor" /><path d="M25 45 V 10 H 35 V 45 H 25 Z" fill="currentColor" /></svg>
                </div>
                 <div className="flex items-end gap-2 md:gap-4">
                    <svg width="80" height="110" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-12 md:w-16"><path d="M10 0 C 10 -5, 70 -5, 70 0 L 75 30 C 75 50, 5 50, 5 30 L 10 0 Z" fill="currentColor"/><path d="M38 50 H 42 V 100 H 38 V 50 Z" fill="currentColor"/><path d="M20 100 H 60 V 105 H 20 V 100 Z" fill="currentColor" /></svg>
                    <svg width="60" height="140" viewBox="0 0 60 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-10 md:w-12"><path d="M15 140 V 55 C 15 40, 20 30, 30 30 C 40 30, 45 40, 45 55 V 140 H 15 Z" fill="currentColor"/><path d="M25 30 V 10 H 35 V 30 H 25 Z" fill="currentColor" /></svg>
                </div>
            </div>
        </div>

        <div className="relative flex flex-col items-center justify-center">
             <div className="absolute inset-0 bg-primary/20 dark:bg-primary/30 rounded-full blur-3xl -z-10 animate-[pulse-glow_5s_ease-in-out_infinite]" />
            <BottleIcon progress={progress} pageName={pageName} dynamicText={dynamicText} />
        </div>

      <div className="mt-8 text-center">
        <h2 className="text-xl font-bold text-foreground dark:drop-shadow-[0_0_8px_hsl(var(--foreground)/0.5)]">
          {dynamicText}
        </h2>
        <p className="mt-2 text-sm text-foreground/90">
          Please wait while we prepare your workspace.
        </p>
      </div>
    </div>
  );
}
