
"use client";

import { useLoading } from "@/hooks/use-loading";

const BottleIcon = ({ progress, pageName }: { progress: number; pageName: string; }) => {
    const getLiquidColor = (page: string) => {
        switch (page) {
            case 'Inventory':
            case 'Godown':
                return 'fill-amber-700'; // Whiskey/Rum color
            case 'OnBar':
                return 'fill-sky-300'; // Vodka/Gin color
            case 'Reports':
                return 'fill-red-800'; // Wine color
            default:
                return 'fill-yellow-500'; // Beer/Dashboard color
        }
    };

    const liquidColorClass = getLiquidColor(pageName);
    // The liquid area inside the bottle is about 185px high (from y=243 to y=58)
    const liquidHeight = 1.85 * progress; 

    return (
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
                    // Start y from the bottom and move up based on progress
                    y={243 - liquidHeight}
                    width="26"
                    height={liquidHeight}
                    className={`transition-all duration-500 ease-in-out ${liquidColorClass}`}
                />
            </g>

            {/* Label Area to display percentage */}
            <rect x="38" y="110" width="24" height="40" className="fill-background/50 rounded-sm" />
            <text x="50" y="135" textAnchor="middle" dominantBaseline="middle" className="font-bold text-sm fill-current text-foreground">
                {Math.round(progress)}%
            </text>
        </svg>
    );
};


export default function Loader() {
  const { isLoading, progress, pageName } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300">
        <div className="relative flex flex-col items-center justify-center">
            <BottleIcon progress={progress} pageName={pageName} />
        </div>

      <div className="mt-8 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Preparing your {pageName}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Just a moment...
        </p>
      </div>
    </div>
  );
}
