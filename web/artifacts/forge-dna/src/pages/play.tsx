import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CyberButton, CyberCard, CyberBadge } from "@/components/cyber-ui";
import { Link } from "wouter";
import { ArrowLeft, Glasses, Loader2, AlertCircle, Play, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/api`;

export default function PlayPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["play", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/play/${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Schema not found");
      return res.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-mono">Loading VR experience...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6 animate-pulse" />
        <h2 className="text-2xl font-display font-bold text-destructive text-glow mb-4">EXPERIENCE NOT FOUND</h2>
        <p className="text-muted-foreground font-mono max-w-md mb-6">
          This VR experience could not be located. It may have been removed or is not yet built.
        </p>
        <Link href="/schemas">
          <CyberButton>
            <ArrowLeft className="w-4 h-4" /> Back to Gallery
          </CyberButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4 border-b border-primary/30 pb-6">
        <Link href="/schemas">
          <CyberButton variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4" /> Gallery
          </CyberButton>
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-glow uppercase">{data.title}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            // WebXR Experience Player
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-video bg-black/80 border-2 border-primary/40 overflow-hidden"
          >
            {data.webxrUrl ? (
              <iframe
                src={data.webxrUrl}
                className="w-full h-full"
                allow="xr-spatial-tracking; gamepad; fullscreen"
                title={`${data.title} - WebXR`}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <Glasses className="w-20 h-20 text-primary/30 mb-6" />
                <h3 className="text-xl font-display font-bold text-primary/60 mb-3">
                  WebXR BUILD PENDING
                </h3>
                <p className="text-muted-foreground font-mono text-sm max-w-md mb-6">
                  This experience has not been exported to WebXR yet. Use the editor's "Build & Play" feature to generate a playable WebXR build.
                </p>
                <div className="flex gap-3">
                  <CyberButton variant="secondary" size="sm" disabled>
                    <Play className="w-4 h-4" /> Launch VR (Unavailable)
                  </CyberButton>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <div className="space-y-6">
          <CyberCard>
            <h3 className="text-lg font-display font-bold text-primary mb-4 uppercase">Experience Info</h3>
            <div className="space-y-3 font-mono text-sm">
              <div>
                <span className="text-muted-foreground">Goal:</span>
                <p className="text-foreground mt-1">{data.goal}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vibe:</span>
                <p className="text-foreground mt-1 italic">&quot;{data.vibePrompt}&quot;</p>
              </div>
              <div>
                <span className="text-muted-foreground">Platforms:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {data.targetPlatforms?.map((p: string) => (
                    <CyberBadge key={p} variant="primary">{p}</CyberBadge>
                  ))}
                </div>
              </div>
            </div>
          </CyberCard>

          <CyberCard>
            <h3 className="text-lg font-display font-bold text-primary mb-4 uppercase">VR Instructions</h3>
            <div className="space-y-3 font-mono text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Glasses className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>Open this page in a WebXR-compatible browser (Meta Quest, Steam VR, etc.)</p>
              </div>
              <div className="flex items-start gap-2">
                <Gamepad2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>Click "Enter VR" to begin the immersive experience</p>
              </div>
              <div className="flex items-start gap-2">
                <Play className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>Use motion controllers for interaction, triggers for grab/use</p>
              </div>
            </div>
          </CyberCard>
        </div>
      </div>
    </div>
  );
}
