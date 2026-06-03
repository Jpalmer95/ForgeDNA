import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Database, Hexagon, TerminalSquare, Plus, LogIn, LogOut, User, BookOpen, Heart, Coffee, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden h-screen w-screen">
        <div className="w-full h-2 bg-primary/10 animate-[scanline_8s_linear_infinite] blur-sm absolute top-0" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-primary/30 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Hexagon className="w-8 h-8 text-primary group-hover:text-secondary transition-colors duration-500" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-primary/20 blur-md group-hover:bg-secondary/40 transition-colors duration-500" />
            </div>
            <span className="font-display font-bold text-xl tracking-widest text-glow group-hover:text-glow-secondary transition-all duration-500">
              FORGE<span className="text-primary group-hover:text-secondary">DNA</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <NavLink href="/" active={location === "/"}>
              <TerminalSquare className="w-4 h-4 mr-2 inline-block" />
              SYSTEM.HOME
            </NavLink>
            <NavLink href="/schemas" active={location === "/schemas"}>
              <Database className="w-4 h-4 mr-2 inline-block" />
              DATABANKS
            </NavLink>
            <NavLink href="/guide" active={location === "/guide"}>
              <BookOpen className="w-4 h-4 mr-2 inline-block" />
              BUILD GUIDE
            </NavLink>
            {user && (
              <Link href="/schemas/new" className="flex items-center gap-1.5 font-mono text-sm tracking-wider uppercase text-secondary hover:text-secondary/80 transition-colors">
                <Plus className="w-4 h-4" />
                CREATE
              </Link>
            )}

            <div className="border-l border-primary/20 pl-6 ml-2">
              {isLoading ? (
                <div className="w-20 h-5 bg-primary/10 animate-pulse" />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {user.firstName || "Operator"}
                  </span>
                  <button onClick={logout} className="font-mono text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                    <LogOut className="w-3 h-3" /> EXIT
                  </button>
                </div>
              ) : (
                <button onClick={login} className="font-mono text-sm tracking-wider uppercase text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5">
                  <LogIn className="w-4 h-4" /> SIGN IN
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 relative z-10">
        {children}
      </main>

      <footer className="border-t border-primary/20 bg-card py-8 mt-auto relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="font-mono text-muted-foreground text-sm flex items-center justify-center gap-2">
              <TerminalSquare className="w-4 h-4" /> 
              BUILT FOR THE OPEN VR GAME DEVELOPMENT COMMUNITY
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground/60 font-mono text-xs">
              <Heart className="w-3 h-3 text-secondary/60" />
              <span>SUPPORT THE SOLO DEV</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://buymeacoffee.com/Jkorstad"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-300 font-mono text-xs tracking-wider"
              >
                <Coffee className="w-3 h-3" />
                COFFEE
              </a>
              <a
                href="https://mydoge.com/JonK"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-secondary/20 text-muted-foreground hover:text-secondary hover:border-secondary/50 transition-all duration-300 font-mono text-xs tracking-wider"
              >
                <Wallet className="w-3 h-3" />
                DOGE
              </a>
              <a
                href="https://etherscan.io/address/0x0Ba2D788A7D3E944a849052e872CE3976fda396A"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-accent/20 text-muted-foreground hover:text-accent hover:border-accent/50 transition-all duration-300 font-mono text-xs tracking-wider group"
                title="0x0Ba2D788A7D3E944a849052e872CE3976fda396A"
              >
                <Wallet className="w-3 h-3" />
                <span className="hidden sm:inline">0x0Ba2...6A</span>
                <span className="sm:hidden">BASE/ETH</span>
              </a>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <div className="w-2 h-2 bg-primary/50" />
            <div className="w-2 h-2 bg-secondary/50" />
            <div className="w-2 h-2 bg-accent/50" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={cn(
      "font-mono text-sm tracking-wider uppercase transition-all duration-300 relative py-2",
      active ? "text-primary text-glow" : "text-muted-foreground hover:text-primary"
    )}>
      {children}
      {active && (
        <motion.div 
          layoutId="navbar-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary box-glow"
        />
      )}
    </Link>
  );
}
