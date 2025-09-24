
"use client";

import { useLoading } from "@/hooks/use-loading";

const BottleIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <svg className={className} style={style} width="30" height="80" viewBox="0 0 30 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 20H23V80H7V20Z" fill="#7A5C5C" />
        <path d="M10 10H20V20H10V10Z" fill="#D3B8B8" />
        <path d="M12 0H18V10H12V0Z" fill="#A58282" />
        <rect x="8" y="22" width="14" height="3" fill="#EAD7D7"/>
        <path d="M15 45L12 50H18L15 45Z" fill="#fff" opacity="0.5"/>
    </svg>
);
const WineIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <svg className={className} style={style} width="40" height="70" viewBox="0 0 40 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 15C10 5 30 5 30 15V70H10V15Z" fill="#4A0E0E" />
        <path d="M12 0H28V15H12V0Z" fill="#2E0808" />
        <rect x="15" y="25" width="10" height="20" fill="#E53E3E" opacity="0.8"/>
    </svg>
);
const VodkaIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
    <svg className={className} style={style} width="30" height="90" viewBox="0 0 30 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="20" width="20" height="70" fill="#A0AEC0" />
        <rect x="10" y="0" width="10" height="20" fill="#718096" />
        <rect x="8" y="25" width="14" height="5" fill="#E2E8F0"/>
    </svg>
);
const BeerIcon = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
     <svg className={className} style={style} width="35" height="75" viewBox="0 0 35 75" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 15C5 5 30 5 30 15V75H5V15Z" fill="#F6E05E"/>
        <rect x="10" y="0" width="15" height="15" fill="#D69E2E"/>
        <rect x="8" y="20" width="19" height="8" fill="#FFF"/>
    </svg>
);

const bottles = [
    { Icon: BottleIcon, position: { top: -40, left: 0 } },
    { Icon: WineIcon, position: { top: 0, right: -40 } },
    { Icon: VodkaIcon, position: { bottom: -45, left: 0 } },
    { Icon: BeerIcon, position: { top: 0, left: -40 } }
];

export default function Loader() {
  const { isLoading, progress, pageName } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative flex items-center justify-center w-48 h-48">
        <div className="absolute w-full h-full border-2 border-dashed rounded-full border-primary/50 animate-spin-slow"></div>
         {bottles.map(({ Icon, position }, index) => (
            <Icon 
                key={index} 
                className="absolute loader-bottle loader-orbit"
                style={{
                    animationDelay: `${index * 3.75}s`,
                    ...position
                }}
            />
         ))}
      </div>
      <div className="mt-12 text-center">
        <h2 className="text-xl font-bold text-foreground">
          Loading {pageName}... <span className="text-green-500">{progress}%</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we get things ready.
        </p>
      </div>
    </div>
  );
}

declare module 'react' {
    interface CSSProperties {
        [key: `--${string}`]: string | number;
    }
}
