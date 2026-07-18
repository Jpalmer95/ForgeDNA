import { useParams, useLocation } from "wouter";
import { useGetSchema } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { CyberButton, CyberCard, CyberBadge } from "@/components/cyber-ui";
import { JsonViewer } from "@/components/json-viewer";
import { ArrowLeft, Download, GitFork, AlertCircle, Share2, Terminal, Edit } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/api`;

export default function SchemaDetailPage() {
  const params = useParams<{ id: string }>();
  const schemaId = parseInt(params.id || "0", 10);
  const { data: schema, isLoading, error } = useGetSchema(schemaId);
  const { user, login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [forking, setForking] = useState(false);

  const handleDownload = () => {
    if (!schema) return;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(schema.schemaData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `${schema.slug}-v${schema.version}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    toast({
      title: "SCHEMA DOWNLOADED",
      description: "GameDNA JSON transferred to local storage successfully.",
      variant: "default",
    });
  };

  const handleFork = async () => {
    if (!user) {
      login();
      return;
    }
    setForking(true);
    try {
      const res = await fetch(`${API_BASE}/schemas/${schemaId}/fork`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const forked = await res.json();
        navigate(`/schemas/${forked.id}/edit`);
      } else {
        toast({ title: "FORK FAILED", description: "Could not fork this schema.", variant: "destructive" });
      }
    } finally {
      setForking(false);
    }
  };

  const isOwner = user && schema && schema.userId === user.id;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-24 bg-primary/20 animate-pulse mb-8" />
        <CyberCard className="h-64 animate-pulse"><div /></CyberCard>
        <CyberCard className="h-96 animate-pulse"><div /></CyberCard>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-20 h-20 text-destructive mb-6 animate-pulse" />
        <h2 className="text-3xl font-display font-bold text-destructive text-glow mb-4">RECORD NOT FOUND</h2>
        <p className="text-muted-foreground font-mono max-w-md mb-8">
          The requested GameDNA schema could not be located in the databanks or access is restricted.
        </p>
        <Link href="/schemas">
          <CyberButton variant="outline">Return to Registry</CyberButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8">
      <Link href="/schemas" className="inline-flex items-center text-muted-foreground hover:text-primary font-mono text-sm transition-colors group">
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        BACK TO REGISTRY
      </Link>

      {/* Header Info */}
      <CyberCard className="border-t-4 border-t-primary">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-5xl font-display font-bold text-glow uppercase tracking-tight break-all">
                {schema.title}
              </h1>
              <CyberBadge variant="secondary" className="text-base px-3 py-1">v{schema.version}</CyberBadge>
            </div>
            
            <p className="font-mono text-sm text-primary/60 mb-6 tracking-widest">
              ID: {schema.slug} // PUBLIC: {schema.isPublic ? "TRUE" : "FALSE"}
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-mono text-xs uppercase text-muted-foreground mb-1">Vibe Prompt</h4>
                <p className="bg-black/50 border-l-2 border-primary/50 p-4 font-mono text-sm text-foreground italic">
                  "{schema.vibePrompt}"
                </p>
              </div>

              <div>
                <h4 className="font-mono text-xs uppercase text-muted-foreground mb-1">Primary Goal</h4>
                <p className="text-foreground/90 leading-relaxed font-sans text-lg">
                  {schema.goal}
                </p>
              </div>
            </div>
          </div>

          {/* Actions & Meta Sidebar */}
          <div className="w-full lg:w-72 shrink-0 bg-black/40 p-5 border border-primary/20 flex flex-col gap-6">
            <div>
              <h4 className="font-mono text-xs uppercase text-muted-foreground mb-2">Target Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {schema.targetPlatforms?.map(p => (
                  <CyberBadge key={p} variant="primary">{p}</CyberBadge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-b border-primary/10 py-4">
              <div className="text-center">
                <div className="font-mono text-xs text-muted-foreground mb-1">FORKS</div>
                <div className="font-display text-2xl font-bold text-secondary flex items-center justify-center gap-2">
                  <GitFork className="w-5 h-5" /> {schema.forkCount}
                </div>
              </div>
              <div className="w-px h-10 bg-primary/10" />
              <div className="text-center">
                <div className="font-mono text-xs text-muted-foreground mb-1">STATUS</div>
                <div className="font-display text-lg font-bold text-primary">ONLINE</div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {isOwner && (
                <Link href={`/schemas/${schema.id}/edit`}>
                  <CyberButton className="w-full justify-center" variant="secondary">
                    <Edit className="w-4 h-4 mr-2" />
                    EDIT SCHEMA
                  </CyberButton>
                </Link>
              )}
              <CyberButton onClick={handleDownload} className="w-full justify-center">
                <Download className="w-4 h-4 mr-2" />
                EXTRACT JSON
              </CyberButton>
              <CyberButton variant="secondary" onClick={handleFork} className="w-full justify-center" disabled={forking}>
                <GitFork className="w-4 h-4 mr-2" />
                {forking ? "FORKING..." : "FORK SCHEMA"}
              </CyberButton>
              <CyberButton variant="outline" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast({ title: "LINK COPIED", description: "URL copied to clipboard." });
              }} className="w-full justify-center">
                <Share2 className="w-4 h-4 mr-2" />
                SHARE
              </CyberButton>
            </div>
          </div>
        </div>
      </CyberCard>

      {/* JSON Viewer */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold flex items-center gap-3 text-glow">
          <Terminal className="w-6 h-6 text-primary" />
          RAW GAMEDNA PAYLOAD
        </h2>
        <p className="font-mono text-sm text-muted-foreground mb-4">
          This is the compiled source schema ready for agent parsing and Godot generation.
        </p>
        
        <CyberCard className="p-0 border-primary/30">
          <JsonViewer data={schema.schemaData} className="w-full" />
        </CyberCard>
      </div>

    </div>
  );
}
