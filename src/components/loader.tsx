
"use client";

import { useLoading } from "@/hooks/use-loading";
import { cn } from "@/lib/utils";

const GlassIcon = ({ progress }: { progress: number }) => {
    return (
        <svg
            width="200"
            height="220"
            viewBox="0 0 200 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg w-32 h-auto text-foreground/80"
        >
            <defs>
                <clipPath id="glass-clip">
                    <path d="M 30 210 L 40 10 L 160 10 L 170 210 H 30 Z" />
                </clipPath>
                <linearGradient id="liquid-gradient" x1="0.5" y1="0" x2="0.5" y2="1">
                    <stop offset="0%" className="liquid-color-cycle-top" />
                    <stop offset="100%" className="liquid-color-cycle-bottom" />
                </linearGradient>
            </defs>

            {/* Liquid Animation */}
            <g clipPath="url(#glass-clip)">
                <g className="animate-slosh">
                    <path
                        d="M -20,130 
                           C 20,110 80,150 140,120 
                           C 200,90 220,150 220,150 
                           L 220,220 L -20,220 Z"
                        fill="url(#liquid-gradient)"
                    />
                </g>
            </g>

            {/* Main Glass Outline */}
            <path 
                d="M 40 10 L 30 210 H 170 L 160 10 H 40 Z"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {/* Thick bottom of the glass */}
            <path 
                d="M 30 210 C 35 220, 165 220, 170 210"
                stroke="currentColor"
                strokeWidth="3"
            />
            
            {/* Shimmer Effect */}
            <g clipPath="url(#glass-clip)">
                <rect 
                    x="-100"
                    y="0"
                    width="80"
                    height="250"
                    fill="white"
                    fillOpacity="0.2"
                    className="animate-[shimmer-glass_4s_ease-in-out_infinite]"
                    style={{ transform: 'skewX(-20deg)' }}
                />
            </g>
        </svg>
    );
};

const DustMotes = () => {
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
                <div
                    key={i}
                    className="absolute rounded-full bg-foreground/20 animate-[dust-motes_infinite]"
                    style={{
                        width: `${Math.random() * 2 + 1}px`,
                        height: `${Math.random() * 2 + 1}px`,
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDuration: `${Math.random() * 20 + 15}s`,
                        animationDelay: `-${Math.random() * 35}s`,
                    }}
                />
            ))}
        </div>
    )
}

export default function Loader() {
  const { isLoading, progress, pageName, dynamicText } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300">
        <DustMotes />

        <div className="relative flex flex-col items-center justify-center">
             <div className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl -z-10 animate-[pulse-glow_5s_ease-in-out_infinite]" />
            <GlassIcon progress={progress} />
        </div>

      <div className="mt-8 text-center">
        <h2 className="text-xl font-bold text-foreground dark:drop-shadow-[0_0_8px_hsl(var(--foreground)/0.5)]">
          {dynamicText}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we prepare your workspace.
        </p>
      </div>
    </div>
  );
}
