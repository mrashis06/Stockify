
"use client";

import { useLoading } from "@/hooks/use-loading";

const BottleIcon = ({ progress, className }: { progress: number; className?: string }) => {
    // Determine the color of the liquid based on the page being loaded.
    const getLiquidColor = (pageName: string) => {
        switch (pageName) {
            case 'Inventory':
            case 'Godown':
                return 'fill-amber-700'; // Whiskey/Rum color
            case 'OnBar':
                return 'fill-sky-300'; // Vodka/Gin color
            case 'Reports':
                return 'fill-red-800'; // Wine color
            default:
                return 'fill-yellow-500'; // Beer color
        }
    }

    const { pageName } = useLoading();
    const liquidHeight = 58 * (progress / 100);
    const liquidY = 78 - liquidHeight;
    const liquidColorClass = getLiquidColor(pageName);

    return (
        <svg
            className={className}
            width="80"
            height="200"
            viewBox="0 0 80 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Bottle Glass */}
            <path
                d="M30 30H50V18C50 15.7909 48.2091 14 46 14H34C31.7909 14 30 15.7909 30 18V30Z"
                className="fill-current text-muted-foreground/30"
            />
            <path
                d="M20 30H60V190H20V30Z"
                className="fill-current text-muted-foreground/30"
            />
            {/* Cork */}
            <path
                d="M32 0H48V14H32V0Z"
                className="fill-current text-amber-900/80"
            />
            {/* Liquid */}
            {progress > 0 && (
                 <rect
                    x="22"
                    y={liquidY}
                    width="36"
                    height={liquidHeight}
                    className={`transition-all duration-300 ease-linear ${liquidColorClass}`}
                />
            )}
             {/* Label Area */}
            <rect x="25" y="50" width="30" height="40" className="fill-current text-background/50" />

        </svg>
    );
};


export default function Loader() {
  const { isLoading, progress, pageName } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300">
        <div className="relative flex flex-col items-center justify-center">
            <BottleIcon progress={progress} className="h-48 w-auto drop-shadow-lg" />
            <div className="absolute bottom-5 text-center text-white font-bold text-xl">
                 {Math.round(progress)}%
            </div>
        </div>

      <div className="mt-8 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Loading {pageName}...
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we get things ready.
        </p>
      </div>
    </div>
  );
}
