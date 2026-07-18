import { Terminal, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { CyberButton } from "@/components/cyber-ui";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-8 border border-destructive/30 bg-card/50 backdrop-blur-sm box-glow text-center clip-edges relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-destructive animate-pulse" />
        
        <div className="flex justify-center mb-6">
          <div className="relative">
            <AlertTriangle className="w-20 h-20 text-destructive" />
            <div className="absolute inset-0 bg-destructive/20 blur-xl animate-pulse" />
          </div>
        </div>

        <h1 className="text-4xl font-display font-bold text-destructive mb-2 tracking-widest text-glow">
          ERROR_404
        </h1>
        
        <div className="font-mono text-sm text-muted-foreground mb-8 space-y-2">
          <p>{">"} REQUESTED_SECTOR_NOT_FOUND</p>
          <p>{">"} DIRECTORY_MAY_BE_CORRUPTED</p>
          <p className="animate-pulse text-destructive/80">{">"} INITIATING_FALLBACK_PROTOCOL...</p>
        </div>

        <Link href="/">
          <CyberButton variant="outline" className="w-full">
            <Terminal className="w-4 h-4 mr-2" />
            RETURN TO ROOT
          </CyberButton>
        </Link>
      </div>
    </div>
  );
}
