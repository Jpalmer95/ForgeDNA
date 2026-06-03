import { useListSchemas } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { CyberButton, CyberCard, CyberBadge } from "@/components/cyber-ui";
import { Link } from "wouter";
import { format } from "date-fns";
import { GitFork, Clock, Cpu, Search, AlertCircle, Plus, Star, Play, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/api`;

const GENRE_OPTIONS = [
  { value: "", label: "All Genres" },
  { value: "escape-room", label: "Escape Room" },
  { value: "dungeon-crawler", label: "Dungeon Crawler" },
  { value: "exploration", label: "Exploration" },
  { value: "puzzle", label: "Puzzle" },
  { value: "horror", label: "Horror" },
  { value: "adventure", label: "Adventure" },
  { value: "simulation", label: "Simulation" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "All Platforms" },
  { value: "quest", label: "Quest" },
  { value: "webxr", label: "WebXR" },
  { value: "steamvr", label: "SteamVR" },
  { value: "pcvr", label: "PCVR" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Recent" },
  { value: "stars", label: "Most Stars" },
  { value: "forks", label: "Most Forks" },
];

export default function SchemasPage() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);

  const { data: schemas, isLoading, error, refetch } = useListSchemas({
    search: search || undefined,
    genre: genre || undefined,
    platform: platform || undefined,
    sort: (sort || undefined) as "recent" | "stars" | "forks" | undefined,
  });
  const { user, login } = useAuth();
  const [forking, setForking] = useState<number | null>(null);
  const [starring, setStarring] = useState<number | null>(null);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());

  const handleFork = async (id: number) => {
    if (!user) {
      login();
      return;
    }
    setForking(id);
    try {
      const res = await fetch(`${API_BASE}/schemas/${id}/fork`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const forked = await res.json();
        window.location.href = `${BASE}/schemas/${forked.id}/edit`;
      } else {
        alert("Failed to remix this schema. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setForking(null);
    }
  };

  const handleStar = useCallback(async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      login();
      return;
    }
    const isStarred = starredIds.has(id);
    setStarring(id);
    try {
      await fetch(`${API_BASE}/schemas/${id}/star`, {
        method: isStarred ? "DELETE" : "POST",
        credentials: "include",
      });
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (isStarred) next.delete(id);
        else next.add(id);
        return next;
      });
      refetch();
    } catch {
      // ignore
    } finally {
      setStarring(null);
    }
  }, [user, login, refetch, starredIds]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-primary/20 pb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-glow uppercase">Public Databanks</h1>
            <p className="text-muted-foreground font-mono mt-2">// Loading remote network signals...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CyberCard key={i} className="animate-pulse h-64">
              <div className="h-6 w-3/4 bg-primary/20 mb-4" />
              <div className="h-4 w-1/4 bg-primary/10 mb-8" />
              <div className="h-16 w-full bg-primary/5 mb-6" />
              <div className="flex gap-2 mb-4">
                <div className="h-5 w-16 bg-primary/10" />
                <div className="h-5 w-16 bg-primary/10" />
              </div>
            </CyberCard>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-6 animate-pulse" />
        <h2 className="text-2xl font-display font-bold text-destructive text-glow mb-4">NETWORK FAILURE</h2>
        <p className="text-muted-foreground font-mono max-w-md">
          Unable to establish connection to the schema databanks. The main server may be offline or experiencing heavy load.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-primary/30 pb-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-glow uppercase tracking-tight">Public Databanks</h1>
          <p className="text-muted-foreground font-mono mt-2 tracking-widest text-sm">
            // Accessing open-source VR GameDNA configurations
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Query schemas..."
              className="w-full md:w-64 bg-black/50 border border-primary/30 focus:border-primary text-foreground font-mono text-sm py-2 pl-10 pr-4 outline-none transition-all box-glow-hover clip-edges"
            />
          </div>
          <CyberButton
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "border-primary text-primary" : ""}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </CyberButton>
          {user && (
            <Link href="/schemas/new">
              <CyberButton variant="secondary" size="sm">
                <Plus className="w-4 h-4" /> New Schema
              </CyberButton>
            </Link>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-4 p-4 bg-black/30 border border-primary/20 mb-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-primary/60 uppercase tracking-widest">Genre</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="bg-black/50 border border-primary/30 text-foreground font-mono text-sm py-1.5 px-3 outline-none focus:border-primary"
                >
                  {GENRE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-primary/60 uppercase tracking-widest">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="bg-black/50 border border-primary/30 text-foreground font-mono text-sm py-1.5 px-3 outline-none focus:border-primary"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono text-primary/60 uppercase tracking-widest">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-black/50 border border-primary/30 text-foreground font-mono text-sm py-1.5 px-3 outline-none focus:border-primary"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!schemas || schemas.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-primary/20 bg-background/50">
          <Cpu className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h3 className="text-xl font-display font-bold mb-2">NO SCHEMAS DETECTED</h3>
          <p className="text-muted-foreground font-mono text-sm">The registry is currently empty.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {schemas.map((schema: any) => (
            <motion.div
              key={schema.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <CyberCard className="h-full flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-display font-bold text-foreground hover:text-primary transition-colors line-clamp-1">
                      {schema.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {schema.genreTag && (
                        <CyberBadge variant="primary" className="text-[10px] uppercase">
                          {schema.genreTag}
                        </CyberBadge>
                      )}
                      <CyberBadge variant="secondary">v{schema.version}</CyberBadge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {schema.targetPlatforms?.map((platform: string) => (
                      <CyberBadge key={platform} variant="primary">{platform}</CyberBadge>
                    ))}
                  </div>

                  <div className="bg-black/40 border-l-2 border-primary/50 p-3 mb-6 font-mono text-sm text-muted-foreground line-clamp-3 h-[4.5rem]">
                    &quot;{schema.vibePrompt}&quot;
                  </div>
                </div>

                <div className="mt-auto border-t border-border pt-4">
                  <div className="flex justify-between items-center mb-4 text-xs font-mono text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(schema.createdAt), 'MMM dd, yyyy')}
                      </div>
                      <button
                        onClick={(e) => handleStar(schema.id, e)}
                        disabled={starring === schema.id}
                        className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer disabled:opacity-50"
                        title={starredIds.has(schema.id) ? "Unstar" : "Star this schema"}
                      >
                        <Star className="w-3.5 h-3.5" fill={starredIds.has(schema.id) ? "currentColor" : "none"} />
                        {schema.starCount ?? 0}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-secondary">
                      <GitFork className="w-3.5 h-3.5" />
                      {schema.forkCount} forks
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/schemas/${schema.id}`} className="flex-1">
                      <CyberButton className="w-full text-xs py-2">
                        Inspect
                      </CyberButton>
                    </Link>
                    {schema.webxrUrl && (
                      <Link href={`/play/${schema.slug}`}>
                        <CyberButton variant="secondary" className="text-xs py-2 border-green-500/50 text-green-400 hover:bg-green-500/10">
                          <Play className="w-3 h-3" /> Play
                        </CyberButton>
                      </Link>
                    )}
                    <CyberButton
                      variant="secondary"
                      className="text-xs py-2"
                      onClick={() => handleFork(schema.id)}
                      disabled={forking === schema.id}
                    >
                      <GitFork className="w-3 h-3" />
                      {forking === schema.id ? "..." : "Remix"}
                    </CyberButton>
                  </div>
                </div>
              </CyberCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
