
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="w-full border-t bg-transparent z-10">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row opacity-0 fade-in [animation-delay:1.2s]">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Stockify. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:bottom-0 after:left-0 after:bg-foreground after:origin-bottom-right after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 hover:after:origin-bottom-left">
            Privacy Policy
          </Link>
          <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:bottom-0 after:left-0 after:bg-foreground after:origin-bottom-right after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 hover:after:origin-bottom-left">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
