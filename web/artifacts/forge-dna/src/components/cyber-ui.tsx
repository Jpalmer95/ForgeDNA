import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function CyberButton({ className, variant = 'primary', size = 'md', children, ...props }: CyberButtonProps) {
  const baseStyles = "relative font-display uppercase tracking-widest font-bold transition-all duration-300 clip-edges overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = {
    sm: "text-xs py-2 px-4",
    md: "text-sm py-3 px-6",
    lg: "text-base py-4 px-8"
  };
  
  const variants = {
    primary: "bg-primary/10 text-primary border border-primary hover:bg-primary/20 box-glow-hover text-glow",
    secondary: "bg-secondary/10 text-secondary border border-secondary hover:bg-secondary/20 hover:shadow-[0_0_20px_rgba(255,0,255,0.4)]",
    outline: "bg-transparent text-foreground border border-border hover:border-primary hover:text-primary",
    ghost: "bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent"
  };

  return (
    <button className={cn(baseStyles, sizes[size], variants[variant], className)} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {variant === 'primary' && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[glitch_0.3s_linear] bg-primary/20 z-0" />
      )}
    </button>
  );
}

export function CyberCard({ className, children, ...props }: { className?: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <motion.div 
      className={cn(
        "bg-card border border-primary/20 p-6 relative overflow-hidden group transition-colors duration-300 hover:border-primary/50 box-glow",
        className
      )}
      {...props}
    >
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

export function CyberBadge({ children, className, variant = 'default' }: { children: ReactNode, className?: string, variant?: 'default' | 'primary' | 'secondary' }) {
  const variants = {
    default: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/50",
    secondary: "bg-secondary/10 text-secondary border-secondary/50"
  };
  
  return (
    <span className={cn("px-2 py-0.5 text-xs font-mono border clip-edges uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
}
