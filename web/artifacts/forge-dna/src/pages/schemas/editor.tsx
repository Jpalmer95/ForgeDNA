import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetSchema } from "@workspace/api-client-react";
import { gameDnaSchema } from "@workspace/game-dna-schema";
import { CyberButton, CyberBadge } from "@/components/cyber-ui";
import {
  Save, Download, ArrowLeft, Plus, Trash2, AlertCircle, Hammer, Loader2,
  Box, Cpu, Globe, Layers, Mic2, Terminal, Glasses, ChevronDown, ChevronRight,
  Sparkles, ScrollText, History, Play, RotateCcw, Cloud, Eye,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE}/api`;

interface ValidationError {
  path: string;
  message: string;
}

interface SpawnPoint { name: string; position: [number, number, number] }
interface PostProcessing { bloom?: number; chromatic_aberration?: number; color_grading?: string }
interface IKSettings { enabled?: boolean; elbow_offset?: [number, number, number] }
interface Entity {
  [key: string]: unknown;
  id: string; type: string; model_prompt?: string; mass_kg?: number;
  physics_material?: { friction?: number; bounce?: number };
  damage?: number; grab_offset?: [number, number, number];
  haptic_on_hit?: number[]; behavior_tree?: string; navmesh_layer?: string;
  speed?: number; health?: number;
}
interface RecipeTrigger { type?: string; to?: string }
interface RecipeResult { spawn?: string; probability?: number }
interface BehaviorNode { [key: string]: unknown; id: number; type: string; children?: number[]; action?: string; condition?: string }
interface LogicRecipe {
  [key: string]: unknown;
  name: string; type: string; ingredients?: string[];
  trigger?: RecipeTrigger; result?: RecipeResult; nodes?: BehaviorNode[];
}
interface Level {
  [key: string]: unknown;
  id: string; description: string; layout_prompt?: string;
  objectives?: string[]; win_condition?: { collect_shards?: number; time_limit_seconds?: number };
}

interface SchemaData {
  meta: { title: string; version: string; vibe_prompt: string; target_platforms: string[]; goal: string };
  environment_config: {
    physics: { gravity_vector: [number, number, number]; default_friction: number; terminal_velocity: number };
    skybox: { type: string; description: string; hdr_intensity?: number };
    terrain: { base_type: string; collision_shape: string; size_m: [number, number, number]; spawn_points: SpawnPoint[] };
    post_processing?: PostProcessing;
  };
  player_rig: {
    origin_type: string;
    camera: { type: string; height_offset: number; near: number; far: number };
    controllers: Array<{ hand: string; type: string; tracker: string; haptic_curves?: Record<string, number[]> }>;
    locomotion: { mode: string; turn_speed_deg: number; snap_turn: boolean; movement_speed: number };
    collision: { capsule_radius: number; capsule_height: number; center_of_mass_offset?: [number, number, number] };
    ik_settings?: IKSettings;
  };
  entity_registry: Entity[];
  logic_recipes: LogicRecipe[];
  levels: Level[];
  audio: { bgm?: { prompt?: string }; sfx_library?: Array<{ id: string; prompt: string }> };
}

const EMPTY_SCHEMA_DATA: SchemaData = {
  meta: { title: "", version: "1.0", vibe_prompt: "", target_platforms: [], goal: "" },
  environment_config: {
    physics: { gravity_vector: [0, -9.8, 0], default_friction: 0.5, terminal_velocity: 50 },
    skybox: { type: "procedural", description: "" },
    terrain: { base_type: "plane", collision_shape: "box", size_m: [100, 0, 100], spawn_points: [] },
    post_processing: { bloom: 0, chromatic_aberration: 0, color_grading: "" },
  },
  player_rig: {
    origin_type: "XROrigin3D",
    camera: { type: "XRCamera3D", height_offset: 1.7, near: 0.05, far: 1000 },
    controllers: [
      { hand: "left", type: "XRController3D", tracker: "/user/hand/left" },
      { hand: "right", type: "XRController3D", tracker: "/user/hand/right" },
    ],
    locomotion: { mode: "teleport_with_blinder", turn_speed_deg: 45, snap_turn: true, movement_speed: 3 },
    collision: { capsule_radius: 0.3, capsule_height: 1.8 },
    ik_settings: { enabled: false },
  },
  entity_registry: [],
  logic_recipes: [],
  levels: [],
  audio: { bgm: { prompt: "" }, sfx_library: [] },
};

const TABS = [
  { key: "meta", label: "Meta", icon: Terminal },
  { key: "environment", label: "Environment", icon: Globe },
  { key: "player_rig", label: "Player Rig", icon: Glasses },
  { key: "entities", label: "Entities", icon: Box },
  { key: "recipes", label: "Recipes", icon: Layers },
  { key: "levels", label: "Levels", icon: Cpu },
  { key: "audio", label: "Audio", icon: Mic2 },
  { key: "history", label: "History", icon: History },
] as const;

function buildFullSchemaData(sd: SchemaData, title: string, version: string, vibePrompt: string, targetPlatforms: string[], goal: string): SchemaData {
  return {
    ...sd,
    meta: { ...sd.meta, title, version, vibe_prompt: vibePrompt, target_platforms: targetPlatforms, goal },
  };
}

function runZodValidation(data: SchemaData): ValidationError[] {
  const result = gameDnaSchema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export default function SchemaEditor() {
  const { id } = useParams<{ id?: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const isNew = !id || id === "new";

  const schemaId = isNew ? 0 : parseInt(id!, 10);
  const schemaQuery = useGetSchema(schemaId);
  const existingSchema = isNew ? undefined : schemaQuery.data;

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [vibePrompt, setVibePrompt] = useState("");
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [schemaData, setSchemaData] = useState<SchemaData>(structuredClone(EMPTY_SCHEMA_DATA));
  const [activeTab, setActiveTab] = useState<string>("meta");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [platformInput, setPlatformInput] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [buildDownloadUrl, setBuildDownloadUrl] = useState<string | null>(null);
  const [aiBuilding, setAiBuilding] = useState(false);
  const [aiBuildStatus, setAiBuildStatus] = useState<string | null>(null);
  const [aiBuildDownloadUrl, setAiBuildDownloadUrl] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<Array<{ timestamp: number; type: string; toolName?: string; input?: string; output?: string; message?: string }>>([]);
  const [agentLogOpen, setAgentLogOpen] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: number; versionLabel: string; title: string | null; changeNote: string | null; schemaData: Record<string, unknown>; createdAt: string }>>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [cloudBuilding, setCloudBuilding] = useState(false);
  const [cloudBuildMsg, setCloudBuildMsg] = useState<string | null>(null);
  const [cloudBuildResult, setCloudBuildResult] = useState<{ webxrUrl?: string; apkUrl?: string } | null>(null);
  const [diffVersionId, setDiffVersionId] = useState<number | null>(null);
  const [diffData, setDiffData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (existingSchema) {
      setTitle(existingSchema.title);
      setVersion(existingSchema.version);
      setVibePrompt(existingSchema.vibePrompt);
      setTargetPlatforms(existingSchema.targetPlatforms || []);
      setGoal(existingSchema.goal);
      setIsPublic(existingSchema.isPublic);
      if (existingSchema.schemaData && typeof existingSchema.schemaData === "object") {
        setSchemaData({
          ...structuredClone(EMPTY_SCHEMA_DATA),
          ...(existingSchema.schemaData as Record<string, unknown>),
        } as SchemaData);
      }
    }
  }, [existingSchema]);

  const fullData = useMemo(
    () => buildFullSchemaData(schemaData, title, version, vibePrompt, targetPlatforms, goal),
    [schemaData, title, version, vibePrompt, targetPlatforms, goal],
  );

  const validate = useCallback((): ValidationError[] => {
    const metaErrors: ValidationError[] = [];
    if (!title.trim()) metaErrors.push({ path: "meta.title", message: "Title is required" });
    if (!vibePrompt.trim()) metaErrors.push({ path: "meta.vibe_prompt", message: "Vibe prompt is required" });
    if (!goal.trim()) metaErrors.push({ path: "meta.goal", message: "Goal is required" });
    const zodErrors = runZodValidation(fullData);
    const combinedPaths = new Set(metaErrors.map((e) => e.path));
    const merged = [...metaErrors];
    for (const ze of zodErrors) {
      if (!combinedPaths.has(ze.path)) {
        merged.push(ze);
        combinedPaths.add(ze.path);
      }
    }
    return merged;
  }, [title, vibePrompt, goal, fullData]);

  useEffect(() => {
    setErrors(validate());
  }, [validate]);

  const isValid = errors.length === 0;

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    const body = { title, version, vibePrompt, targetPlatforms, goal, schemaData: fullData, isPublic };

    try {
      const url = isNew ? `${API_BASE}/schemas` : `${API_BASE}/schemas/${id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.validationErrors) {
          setErrors(data.validationErrors);
          setSaveMessage("Validation errors in GameDNA schema data");
        } else {
          setSaveMessage(`Error: ${data.error || "Failed to save"}`);
        }
        return;
      }

      const saved = await res.json();
      setSaveMessage("Schema saved successfully!");
      if (isNew) {
        navigate(`/schemas/${saved.id}/edit`);
      }
    } catch {
      setSaveMessage("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-") || "game-dna"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBuildGodot = async () => {
    if (!isValid) return;
    setBuilding(true);
    setBuildStatus("Forging Godot project...");
    setBuildDownloadUrl(null);

    try {
      const res = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schemaData: fullData }),
      });

      if (!res.ok) {
        const data = await res.json();
        setBuildStatus(`Error: ${data.error || "Build failed"}`);
        setBuilding(false);
        return;
      }

      const { jobId } = await res.json();
      setBuildStatus("Processing...");

      const poll = async () => {
        const statusRes = await fetch(`${API_BASE}/parse/status/${jobId}`, { credentials: "include" });
        if (!statusRes.ok) {
          setBuildStatus("Error polling job status");
          setBuilding(false);
          return;
        }
        const status = await statusRes.json();
        if (status.status === "complete") {
          setBuildStatus(`Build complete — ${status.filesGenerated} files generated`);
          setBuildDownloadUrl(`${API_BASE}/parse/download/${jobId}`);
          setBuilding(false);
        } else if (status.status === "error") {
          setBuildStatus(`Build error: ${status.error}`);
          setBuilding(false);
        } else {
          setTimeout(poll, 500);
        }
      };
      await poll();
    } catch {
      setBuildStatus("Network error during build");
      setBuilding(false);
    }
  };

  const handleAiBuild = async () => {
    if (!isValid) return;
    setAiBuilding(true);
    setAiBuildStatus("Initializing AI Agent Swarm...");
    setAiBuildDownloadUrl(null);
    setAgentLogs([]);
    setAgentLogOpen(true);

    try {
      const res = await fetch(`${API_BASE}/ai-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schemaData: fullData }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAiBuildStatus(`Error: ${data.error || "AI Build failed"}`);
        setAiBuilding(false);
        return;
      }

      const { jobId } = await res.json();
      setAiBuildStatus("AI agents processing logic recipes...");

      const evtSource = new EventSource(`${API_BASE}/ai-build/stream/${jobId}`);
      evtSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          evtSource.close();
          fetch(`${API_BASE}/ai-build/status/${jobId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((status) => {
              if (status.status === "complete") {
                setAiBuildStatus(`AI Build complete — ${status.filesGenerated} files generated`);
                setAiBuildDownloadUrl(`${API_BASE}/ai-build/download/${jobId}`);
              } else if (status.status === "error") {
                setAiBuildStatus(`AI Build error: ${status.error}`);
              }
              setAiBuilding(false);
            })
            .catch(() => {
              setAiBuildStatus("Error checking final status");
              setAiBuilding(false);
            });
          return;
        }
        try {
          const entry = JSON.parse(event.data);
          setAgentLogs((prev) => [...prev, entry]);
          if (entry.type === "status") {
            setAiBuildStatus(entry.message);
          }
        } catch {}
      };
      evtSource.onerror = () => {
        evtSource.close();
        setAiBuildStatus("SSE connection lost — checking status...");
        fetch(`${API_BASE}/ai-build/status/${jobId}`, { credentials: "include" })
          .then((r) => r.json())
          .then((status) => {
            if (status.status === "complete") {
              setAiBuildStatus(`AI Build complete — ${status.filesGenerated} files generated`);
              setAiBuildDownloadUrl(`${API_BASE}/ai-build/download/${jobId}`);
            } else if (status.status === "error") {
              setAiBuildStatus(`AI Build error: ${status.error}`);
            }
            setAiBuilding(false);
          })
          .catch(() => {
            setAiBuildStatus("Connection lost");
            setAiBuilding(false);
          });
      };
    } catch {
      setAiBuildStatus("Network error during AI build");
      setAiBuilding(false);
    }
  };

  const loadVersions = useCallback(async () => {
    if (isNew || !schemaId) return;
    setVersionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/schemas/${schemaId}/versions`, { credentials: "include" });
      if (res.ok) setVersions(await res.json());
    } catch { /* ignore */ }
    finally { setVersionsLoading(false); }
  }, [schemaId, isNew]);

  useEffect(() => {
    if (activeTab === "history" && !isNew) loadVersions();
  }, [activeTab, isNew, loadVersions]);

  const handleRestoreVersion = useCallback(async (versionId: number) => {
    if (!confirm("Restore this version? Current state will be saved as a snapshot first.")) return;
    setRestoringVersion(versionId);
    try {
      const res = await fetch(`${API_BASE}/schemas/${schemaId}/versions/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ versionId }),
      });
      if (res.ok) {
        const restored = await res.json();
        setTitle(restored.title);
        setVersion(restored.version);
        if (restored.schemaData && typeof restored.schemaData === "object") {
          setSchemaData({ ...structuredClone(EMPTY_SCHEMA_DATA), ...(restored.schemaData as Record<string, unknown>) } as SchemaData);
        }
        setSaveMessage("Version restored!");
        loadVersions();
      }
    } catch { setSaveMessage("Error restoring version."); }
    finally { setRestoringVersion(null); }
  }, [schemaId, loadVersions]);

  const handleCloudBuild = useCallback(async (platform: "webxr" | "apk") => {
    if (isNew || !schemaId) return;
    setCloudBuilding(true);
    setCloudBuildMsg(null);
    setCloudBuildResult(null);
    try {
      const res = await fetch(`${API_BASE}/cloud-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schemaId, platform }),
      });
      if (!res.ok) {
        const err = await res.json();
        setCloudBuildMsg(`Error: ${err.error}`);
        setCloudBuilding(false);
        return;
      }
      const data = await res.json();
      setCloudBuildMsg(`Build #${data.buildId} queued for ${platform}...`);

      const poll = async () => {
        try {
          const statusRes = await fetch(`${API_BASE}/cloud-build/${data.buildId}`, { credentials: "include" });
          if (!statusRes.ok) {
            setCloudBuildMsg("Error checking build status");
            setCloudBuilding(false);
            return;
          }
          const status = await statusRes.json();
          if (status.status === "complete") {
            setCloudBuildMsg(`Build complete!`);
            setCloudBuildResult({ webxrUrl: status.webxrUrl, apkUrl: status.apkUrl });
            setCloudBuilding(false);
          } else if (status.status === "error") {
            setCloudBuildMsg("Build failed.");
            setCloudBuilding(false);
          } else {
            setTimeout(poll, 1500);
          }
        } catch {
          setCloudBuildMsg("Error polling build status");
          setCloudBuilding(false);
        }
      };
      setTimeout(poll, 2000);
    } catch {
      setCloudBuildMsg("Network error starting build.");
      setCloudBuilding(false);
    }
  }, [isNew, schemaId]);

  const handleViewDiff = useCallback((versionId: number) => {
    if (diffVersionId === versionId) {
      setDiffVersionId(null);
      setDiffData(null);
      return;
    }
    const ver = versions.find((v) => v.id === versionId);
    if (ver) {
      setDiffVersionId(versionId);
      setDiffData(ver.schemaData);
    }
  }, [versions, diffVersionId]);

  const computeDiff = useCallback((oldObj: Record<string, unknown>, newObj: Record<string, unknown>, prefix = ""): Array<{ path: string; type: "added" | "removed" | "changed"; oldVal?: string; newVal?: string }> => {
    const diffs: Array<{ path: string; type: "added" | "removed" | "changed"; oldVal?: string; newVal?: string }> = [];
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    for (const key of allKeys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const oldVal = (oldObj || {})[key];
      const newVal = (newObj || {})[key];
      if (oldVal === undefined) {
        diffs.push({ path, type: "added", newVal: JSON.stringify(newVal, null, 2)?.substring(0, 200) });
      } else if (newVal === undefined) {
        diffs.push({ path, type: "removed", oldVal: JSON.stringify(oldVal, null, 2)?.substring(0, 200) });
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({ path, type: "changed", oldVal: JSON.stringify(oldVal, null, 2)?.substring(0, 200), newVal: JSON.stringify(newVal, null, 2)?.substring(0, 200) });
      }
    }
    return diffs;
  }, []);

  const errorsForSection = useCallback((prefix: string) => errors.filter((e) => e.path.startsWith(prefix)), [errors]);

  if (authLoading) {
    return <div className="text-center py-20 font-mono text-muted-foreground">// Initializing authentication...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-primary mb-6" />
        <h2 className="text-2xl font-display font-bold mb-4">AUTHENTICATION REQUIRED</h2>
        <p className="text-muted-foreground font-mono mb-8">Sign in to create and edit GameDNA schemas.</p>
        <CyberButton onClick={() => window.location.href = `${API_BASE}/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
          Sign In
        </CyberButton>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate("/schemas")} className="text-muted-foreground hover:text-primary font-mono text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> BACK TO DATABANKS
        </button>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`font-mono text-xs ${saveMessage.startsWith("Error") || saveMessage.startsWith("Validation") || saveMessage.startsWith("Network") ? "text-destructive" : "text-green-400"}`}>
              {saveMessage}
            </span>
          )}
          <CyberButton variant="outline" size="sm" onClick={handleExport} disabled={!isValid}>
            <Download className="w-4 h-4" /> Export JSON
          </CyberButton>
          <CyberButton variant="outline" size="sm" onClick={handleBuildGodot} disabled={building || aiBuilding || !isValid}>
            {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
            {building ? "Building..." : "Quick Build"}
          </CyberButton>
          <CyberButton variant="outline" size="sm" onClick={handleAiBuild} disabled={aiBuilding || building || !isValid} className="border-fuchsia-500/50 hover:border-fuchsia-500 text-fuchsia-400 hover:text-fuchsia-300">
            {aiBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiBuilding ? "AI Building..." : "AI Build"}
          </CyberButton>
          <CyberButton size="sm" onClick={handleSave} disabled={saving || !isValid}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </CyberButton>
        </div>
      </div>

      {(buildStatus || buildDownloadUrl) && (
        <div className={`p-3 mb-4 font-mono text-sm border ${buildDownloadUrl ? "border-green-500/30 bg-green-500/10 text-green-400" : buildStatus?.startsWith("Error") || buildStatus?.startsWith("Build error") || buildStatus?.startsWith("Network") ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"}`}>
          <div className="flex items-center gap-3">
            {building && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            {!building && buildDownloadUrl && <Hammer className="w-4 h-4 shrink-0" />}
            <span>{buildStatus}</span>
            {buildDownloadUrl && (
              <a href={buildDownloadUrl} className="ml-auto text-primary hover:text-primary/80 flex items-center gap-1 font-bold">
                <Download className="w-4 h-4" /> Download .zip
              </a>
            )}
          </div>
        </div>
      )}

      {(aiBuildStatus || aiBuildDownloadUrl) && (
        <div className={`p-3 mb-4 font-mono text-sm border ${aiBuildDownloadUrl ? "border-green-500/30 bg-green-500/10 text-green-400" : aiBuildStatus?.startsWith("Error") || aiBuildStatus?.startsWith("AI Build error") ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400"}`}>
          <div className="flex items-center gap-3">
            {aiBuilding && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            {!aiBuilding && aiBuildDownloadUrl && <Sparkles className="w-4 h-4 shrink-0" />}
            <span>{aiBuildStatus}</span>
            {aiBuildDownloadUrl && (
              <a href={aiBuildDownloadUrl} className="ml-auto text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 font-bold">
                <Download className="w-4 h-4" /> Download .zip
              </a>
            )}
          </div>
        </div>
      )}

      {agentLogs.length > 0 && (
        <div className="mb-4 border border-fuchsia-500/20 bg-black/50">
          <button
            onClick={() => setAgentLogOpen(!agentLogOpen)}
            className="w-full flex items-center gap-2 p-3 text-sm font-mono text-fuchsia-400 hover:text-fuchsia-300"
          >
            <ScrollText className="w-4 h-4 shrink-0" />
            {agentLogOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Agent Log ({agentLogs.length} {agentLogs.length === 1 ? "entry" : "entries"})
          </button>
          {agentLogOpen && (
            <div className="max-h-64 overflow-y-auto px-3 pb-3 space-y-1.5">
              {agentLogs.map((entry, i) => (
                <div key={i} className={`font-mono text-xs leading-relaxed ${entry.type === "error" ? "text-destructive" : entry.type === "tool_call" ? "text-cyan-400" : entry.type === "tool_result" ? "text-green-400" : entry.type === "agent_message" ? "text-yellow-400" : "text-muted-foreground"}`}>
                  <span className="opacity-50">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>{" "}
                  {entry.type === "tool_call" && (
                    <><span className="text-cyan-300 font-bold">{entry.toolName}</span>({entry.input && entry.input.length > 100 ? entry.input.substring(0, 100) + "..." : entry.input})</>
                  )}
                  {entry.type === "tool_result" && (
                    <><span className="text-green-300">← {entry.toolName}</span>: {entry.output && entry.output.length > 150 ? entry.output.substring(0, 150) + "..." : entry.output}</>
                  )}
                  {entry.type === "status" && <span>{entry.message}</span>}
                  {entry.type === "error" && <span>ERROR: {entry.message}</span>}
                  {entry.type === "agent_message" && <span>Agent: {entry.message && entry.message.length > 200 ? entry.message.substring(0, 200) + "..." : entry.message}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 p-3 mb-6 font-mono text-xs text-destructive max-h-32 overflow-y-auto">
          <div className="flex items-center gap-2 mb-1 font-bold text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {errors.length} validation {errors.length === 1 ? "error" : "errors"}
          </div>
          {errors.slice(0, 10).map((e, i) => (
            <div key={i} className="ml-6">{e.path}: {e.message}</div>
          ))}
          {errors.length > 10 && <div className="ml-6">...and {errors.length - 10} more</div>}
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            {TABS.map((tab) => {
              const sectionPrefix = tab.key === "entities" ? "entity_registry" : tab.key === "recipes" ? "logic_recipes" : tab.key;
              const sectionErrors = errorsForSection(sectionPrefix);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full text-left px-4 py-3 font-mono text-sm tracking-wider uppercase flex items-center gap-3 transition-all duration-200 border-l-2 ${
                    activeTab === tab.key
                      ? "border-primary text-primary bg-primary/10 text-glow"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {sectionErrors.length > 0 && <span className="ml-auto text-destructive text-xs">{sectionErrors.length}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "meta" && (
            <MetaSection
              title={title} setTitle={setTitle}
              version={version} setVersion={setVersion}
              vibePrompt={vibePrompt} setVibePrompt={setVibePrompt}
              targetPlatforms={targetPlatforms} setTargetPlatforms={setTargetPlatforms}
              platformInput={platformInput} setPlatformInput={setPlatformInput}
              goal={goal} setGoal={setGoal}
              isPublic={isPublic} setIsPublic={setIsPublic}
              errors={errorsForSection("meta")}
            />
          )}
          {activeTab === "environment" && (
            <EnvironmentSection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("environment_config")} />
          )}
          {activeTab === "player_rig" && (
            <PlayerRigSection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("player_rig")} />
          )}
          {activeTab === "entities" && (
            <EntitySection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("entity_registry")} />
          )}
          {activeTab === "recipes" && (
            <RecipeSection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("logic_recipes")} />
          )}
          {activeTab === "levels" && (
            <LevelSection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("levels")} />
          )}
          {activeTab === "audio" && (
            <AudioSection schemaData={schemaData} setSchemaData={setSchemaData} errors={errorsForSection("audio")} />
          )}
          {activeTab === "history" && (
            <div className="space-y-6">
              <SectionTitle>Version History</SectionTitle>
              {isNew ? (
                <p className="text-muted-foreground font-mono text-sm">Save this schema first to enable version tracking.</p>
              ) : (
                <>
                  <div className="flex gap-3 flex-wrap items-center mb-6">
                    <CyberButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCloudBuild("webxr")}
                      disabled={cloudBuilding || isNew}
                    >
                      {cloudBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                      Build WebXR
                    </CyberButton>
                    <CyberButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCloudBuild("apk")}
                      disabled={cloudBuilding || isNew}
                    >
                      {cloudBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Build APK
                    </CyberButton>
                    {cloudBuildMsg && (
                      <span className={`font-mono text-xs ${cloudBuildMsg.startsWith("Error") ? "text-destructive" : "text-green-400"}`}>
                        {cloudBuildMsg}
                      </span>
                    )}
                  </div>
                  {cloudBuildResult && (
                    <div className="flex flex-wrap gap-3 p-3 bg-green-900/20 border border-green-500/30">
                      {cloudBuildResult.webxrUrl && (
                        <a href={cloudBuildResult.webxrUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-mono text-xs text-green-400 hover:text-green-300 underline">
                          <Play className="w-3.5 h-3.5" /> Play in Browser (WebXR)
                        </a>
                      )}
                      {cloudBuildResult.apkUrl && (
                        <a href={cloudBuildResult.apkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-mono text-xs text-green-400 hover:text-green-300 underline">
                          <Download className="w-3.5 h-3.5" /> Download APK
                        </a>
                      )}
                    </div>
                  )}
                  {versionsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading version history...
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-primary/20 bg-background/50">
                      <History className="w-10 h-10 text-primary/30 mx-auto mb-3" />
                      <p className="text-muted-foreground font-mono text-sm">No version history yet.</p>
                      <p className="text-muted-foreground font-mono text-xs mt-1">Versions are automatically saved when you update the schema data.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v) => (
                        <div key={v.id} className="space-y-0">
                          <div className="flex items-center justify-between p-4 bg-black/30 border border-primary/20 hover:border-primary/40 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <CyberBadge variant="secondary">v{v.versionLabel}</CyberBadge>
                                {v.title && <span className="font-mono text-sm text-foreground truncate">{v.title}</span>}
                              </div>
                              {v.changeNote && (
                                <p className="font-mono text-xs text-muted-foreground mt-1 truncate">{v.changeNote}</p>
                              )}
                              <p className="font-mono text-xs text-muted-foreground/60 mt-1">
                                {new Date(v.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <CyberButton
                                variant="secondary"
                                size="sm"
                                onClick={() => handleViewDiff(v.id)}
                              >
                                <Eye className="w-3 h-3" />
                                {diffVersionId === v.id ? "Hide Diff" : "Diff"}
                              </CyberButton>
                              <CyberButton
                                variant="secondary"
                                size="sm"
                                onClick={() => handleRestoreVersion(v.id)}
                                disabled={restoringVersion === v.id}
                              >
                                {restoringVersion === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                Restore
                              </CyberButton>
                            </div>
                          </div>
                          {diffVersionId === v.id && diffData && (
                            <div className="border border-primary/20 border-t-0 bg-black/50 p-4 max-h-64 overflow-auto">
                              <p className="font-mono text-xs text-primary/60 mb-2 uppercase tracking-widest">Diff vs Current Schema</p>
                              {(() => {
                                const diffs = computeDiff(diffData, schemaData as unknown as Record<string, unknown>);
                                if (diffs.length === 0) return <p className="font-mono text-xs text-muted-foreground">No differences found.</p>;
                                return (
                                  <div className="space-y-2">
                                    {diffs.map((d, i) => (
                                      <div key={i} className="font-mono text-xs">
                                        <span className={d.type === "added" ? "text-green-400" : d.type === "removed" ? "text-red-400" : "text-yellow-400"}>
                                          [{d.type.toUpperCase()}] {d.path}
                                        </span>
                                        {d.type === "changed" && (
                                          <div className="ml-4 mt-1 space-y-0.5">
                                            <div className="text-red-400/70">- {d.oldVal}</div>
                                            <div className="text-green-400/70">+ {d.newVal}</div>
                                          </div>
                                        )}
                                        {d.type === "added" && d.newVal && <div className="ml-4 mt-1 text-green-400/70">+ {d.newVal}</div>}
                                        {d.type === "removed" && d.oldVal && <div className="ml-4 mt-1 text-red-400/70">- {d.oldVal}</div>}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-display font-bold text-glow mb-6 uppercase">{children}</h2>;
}

function FieldLabel({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <label className={`block font-mono text-xs tracking-widest uppercase mb-2 ${error ? "text-destructive" : "text-muted-foreground"}`}>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-black/50 border ${error ? "border-destructive" : "border-primary/30 focus:border-primary"} text-foreground font-mono text-sm py-2.5 px-4 outline-none transition-all`}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-black/50 border border-primary/30 focus:border-primary text-foreground font-mono text-sm py-2.5 px-4 outline-none transition-all resize-none"
    />
  );
}

function NumberInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      min={min}
      max={max}
      step={step}
      className="w-full bg-black/50 border border-primary/30 focus:border-primary text-foreground font-mono text-sm py-2.5 px-4 outline-none transition-all"
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/50 border border-primary/30 focus:border-primary text-foreground font-mono text-sm py-2.5 px-4 outline-none transition-all appearance-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 group">
      <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? "bg-primary/30 border-primary" : "bg-muted border-border"} border`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${checked ? "left-5 bg-primary" : "left-0.5 bg-muted-foreground"}`} />
      </div>
      <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

function InlineCell({ value, onChange, type = "text", width = "w-24", placeholder, step }: {
  value: string | number; onChange: (v: string) => void; type?: string; width?: string; placeholder?: string; step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      step={step}
      placeholder={placeholder}
      className={`bg-transparent border-b border-primary/20 font-mono text-sm px-1 py-1 outline-none ${width}`}
    />
  );
}

function MetaSection({ title, setTitle, version, setVersion, vibePrompt, setVibePrompt, targetPlatforms, setTargetPlatforms, platformInput, setPlatformInput, goal, setGoal, isPublic, setIsPublic, errors }: {
  title: string; setTitle: (v: string) => void;
  version: string; setVersion: (v: string) => void;
  vibePrompt: string; setVibePrompt: (v: string) => void;
  targetPlatforms: string[]; setTargetPlatforms: (v: string[]) => void;
  platformInput: string; setPlatformInput: (v: string) => void;
  goal: string; setGoal: (v: string) => void;
  isPublic: boolean; setIsPublic: (v: boolean) => void;
  errors: ValidationError[];
}) {
  const hasError = (field: string) => errors.some((e) => e.path.endsWith(field));

  return (
    <div className="space-y-6">
      <SectionTitle>Meta Configuration</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <FieldLabel error={hasError("title")}>Title *</FieldLabel>
          <TextInput value={title} onChange={setTitle} placeholder="My VR Game" error={hasError("title")} />
        </div>
        <div>
          <FieldLabel>Version</FieldLabel>
          <TextInput value={version} onChange={setVersion} placeholder="1.0" />
        </div>
      </div>
      <div>
        <FieldLabel error={hasError("vibe_prompt")}>Vibe Prompt *</FieldLabel>
        <TextArea value={vibePrompt} onChange={setVibePrompt} placeholder="Describe the aesthetic and mood of your VR experience..." rows={3} />
      </div>
      <div>
        <FieldLabel error={hasError("goal")}>Goal *</FieldLabel>
        <TextArea value={goal} onChange={setGoal} placeholder="What is the primary objective of this VR experience?" rows={2} />
      </div>
      <div>
        <FieldLabel>Target Platforms</FieldLabel>
        <div className="flex gap-2 flex-wrap mb-2">
          {targetPlatforms.map((p, i) => (
            <CyberBadge key={i} variant="primary">
              {p}
              <button onClick={() => setTargetPlatforms(targetPlatforms.filter((_, idx) => idx !== i))} className="ml-1 text-destructive hover:text-destructive/80">x</button>
            </CyberBadge>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput value={platformInput} onChange={setPlatformInput} placeholder="e.g. Quest 3, WebXR" />
          <CyberButton variant="outline" size="sm" onClick={() => {
            if (platformInput.trim()) {
              setTargetPlatforms([...targetPlatforms, platformInput.trim()]);
              setPlatformInput("");
            }
          }}>
            <Plus className="w-4 h-4" />
          </CyberButton>
        </div>
      </div>
      <div>
        <FieldLabel>Visibility</FieldLabel>
        <ToggleSwitch checked={isPublic} onChange={setIsPublic} label={isPublic ? "Public — visible in databanks" : "Private — only you can see this"} />
      </div>
    </div>
  );
}

function EnvironmentSection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const env = schemaData.environment_config;
  const pp = env.post_processing || { bloom: 0, chromatic_aberration: 0, color_grading: "" };

  const update = (path: string, value: unknown) => {
    const next = structuredClone(schemaData);
    const parts = path.split(".");
    let obj: Record<string, unknown> = next.environment_config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
    setSchemaData(next);
  };

  return (
    <div className="space-y-8">
      <SectionTitle>Environment Config</SectionTitle>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Physics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Gravity Y</FieldLabel>
            <NumberInput value={env.physics.gravity_vector[1]} onChange={(v) => update("physics.gravity_vector", [0, v, 0] as [number, number, number])} step={0.1} />
          </div>
          <div>
            <FieldLabel>Default Friction</FieldLabel>
            <NumberInput value={env.physics.default_friction} onChange={(v) => update("physics.default_friction", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.05} />
          </div>
          <div>
            <FieldLabel>Terminal Velocity</FieldLabel>
            <NumberInput value={env.physics.terminal_velocity} onChange={(v) => update("physics.terminal_velocity", v)} min={0} step={1} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Skybox</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Type</FieldLabel>
            <SelectInput value={env.skybox.type} onChange={(v) => update("skybox.type", v)} options={[
              { value: "procedural", label: "Procedural" },
              { value: "hdri", label: "HDRI" },
              { value: "solid_color", label: "Solid Color" },
            ]} />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <TextInput value={env.skybox.description} onChange={(v) => update("skybox.description", v)} placeholder="Describe the skybox..." />
          </div>
          <div>
            <FieldLabel>HDR Intensity</FieldLabel>
            <NumberInput value={env.skybox.hdr_intensity ?? 1} onChange={(v) => update("skybox.hdr_intensity", v)} min={0} step={0.1} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Terrain</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Base Type</FieldLabel>
            <SelectInput value={env.terrain.base_type} onChange={(v) => update("terrain.base_type", v)} options={[
              { value: "plane", label: "Plane" },
              { value: "heightmap", label: "Heightmap" },
              { value: "mesh", label: "Mesh" },
            ]} />
          </div>
          <div>
            <FieldLabel>Collision Shape</FieldLabel>
            <SelectInput value={env.terrain.collision_shape} onChange={(v) => update("terrain.collision_shape", v)} options={[
              { value: "box", label: "Box" },
              { value: "trimesh", label: "Trimesh" },
              { value: "convex", label: "Convex" },
            ]} />
          </div>
          <div>
            <FieldLabel>Size (X, Y, Z)</FieldLabel>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <NumberInput key={i} value={env.terrain.size_m[i]} onChange={(v) => {
                  const next: [number, number, number] = [...env.terrain.size_m] as [number, number, number];
                  next[i] = v;
                  update("terrain.size_m", next);
                }} step={1} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>Spawn Points</FieldLabel>
            <CyberButton variant="ghost" size="sm" onClick={() => {
              const next = structuredClone(schemaData);
              next.environment_config.terrain.spawn_points.push({ name: `spawn_${next.environment_config.terrain.spawn_points.length}`, position: [0, 0, 0] });
              setSchemaData(next);
            }}>
              <Plus className="w-3 h-3" /> Add
            </CyberButton>
          </div>
          {env.terrain.spawn_points.map((sp, i) => (
            <div key={i} className="flex items-center gap-2 mb-2 bg-black/30 p-2 border border-primary/10">
              <InlineCell value={sp.name} onChange={(v) => {
                const next = structuredClone(schemaData);
                next.environment_config.terrain.spawn_points[i].name = v;
                setSchemaData(next);
              }} width="w-32" />
              {[0, 1, 2].map((j) => (
                <InlineCell key={j} type="number" value={sp.position[j]} onChange={(v) => {
                  const next = structuredClone(schemaData);
                  next.environment_config.terrain.spawn_points[i].position[j] = parseFloat(v) || 0;
                  setSchemaData(next);
                }} width="w-16" step={1} />
              ))}
              <button onClick={() => {
                const next = structuredClone(schemaData);
                next.environment_config.terrain.spawn_points.splice(i, 1);
                setSchemaData(next);
              }} className="text-destructive hover:text-destructive/80">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Post Processing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Bloom</FieldLabel>
            <NumberInput value={pp.bloom ?? 0} onChange={(v) => update("post_processing.bloom", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.05} />
          </div>
          <div>
            <FieldLabel>Chromatic Aberration</FieldLabel>
            <NumberInput value={pp.chromatic_aberration ?? 0} onChange={(v) => update("post_processing.chromatic_aberration", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.05} />
          </div>
          <div>
            <FieldLabel>Color Grading</FieldLabel>
            <TextInput value={pp.color_grading ?? ""} onChange={(v) => update("post_processing.color_grading", v)} placeholder="LUT name or preset" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerRigSection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const rig = schemaData.player_rig;

  const update = (path: string, value: unknown) => {
    const next = structuredClone(schemaData);
    const parts = path.split(".");
    let obj: Record<string, unknown> = next.player_rig as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
    setSchemaData(next);
  };

  return (
    <div className="space-y-8">
      <SectionTitle>Player Rig</SectionTitle>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Camera</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <FieldLabel>Height Offset</FieldLabel>
            <NumberInput value={rig.camera.height_offset} onChange={(v) => update("camera.height_offset", v)} step={0.1} />
          </div>
          <div>
            <FieldLabel>Near Plane</FieldLabel>
            <NumberInput value={rig.camera.near} onChange={(v) => update("camera.near", v)} step={0.01} min={0.01} />
          </div>
          <div>
            <FieldLabel>Far Plane</FieldLabel>
            <NumberInput value={rig.camera.far} onChange={(v) => update("camera.far", v)} step={10} min={1} />
          </div>
          <div>
            <FieldLabel>Camera Type</FieldLabel>
            <TextInput value={rig.camera.type} onChange={(v) => update("camera.type", v)} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Controllers</h3>
        {rig.controllers.map((ctrl, i) => (
          <div key={i} className="mb-4 p-4 border border-primary/10 bg-black/20">
            <div className="flex items-center gap-3 mb-3">
              <CyberBadge variant="primary">{ctrl.hand.toUpperCase()}</CyberBadge>
              <span className="font-mono text-xs text-muted-foreground">{ctrl.tracker}</span>
            </div>
            <div>
              <FieldLabel>Haptic Curves (JSON)</FieldLabel>
              <TextArea
                value={ctrl.haptic_curves ? JSON.stringify(ctrl.haptic_curves, null, 2) : "{}"}
                onChange={(v) => {
                  try {
                    const parsed = JSON.parse(v);
                    const next = structuredClone(schemaData);
                    next.player_rig.controllers[i].haptic_curves = parsed;
                    setSchemaData(next);
                  } catch { /* invalid JSON, let user keep editing */ }
                }}
                placeholder='{"grab": [0, 0.5, 1, 0.5, 0]}'
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Locomotion</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Mode</FieldLabel>
            <SelectInput value={rig.locomotion.mode} onChange={(v) => update("locomotion.mode", v)} options={[
              { value: "teleport_with_blinder", label: "Teleport with Blinder" },
              { value: "smooth", label: "Smooth" },
              { value: "teleport", label: "Teleport" },
              { value: "none", label: "None" },
            ]} />
          </div>
          <div>
            <FieldLabel>Turn Speed (deg)</FieldLabel>
            <NumberInput value={rig.locomotion.turn_speed_deg} onChange={(v) => update("locomotion.turn_speed_deg", v)} step={5} min={0} />
          </div>
          <div>
            <FieldLabel>Movement Speed</FieldLabel>
            <NumberInput value={rig.locomotion.movement_speed} onChange={(v) => update("locomotion.movement_speed", v)} step={0.5} min={0} />
          </div>
          <div className="flex items-end">
            <ToggleSwitch checked={rig.locomotion.snap_turn} onChange={(v) => update("locomotion.snap_turn", v)} label="Snap Turn" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Collision Capsule</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Radius</FieldLabel>
            <NumberInput value={rig.collision.capsule_radius} onChange={(v) => update("collision.capsule_radius", v)} step={0.1} min={0.1} />
          </div>
          <div>
            <FieldLabel>Height</FieldLabel>
            <NumberInput value={rig.collision.capsule_height} onChange={(v) => update("collision.capsule_height", v)} step={0.1} min={0.1} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">IK Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-end">
            <ToggleSwitch
              checked={rig.ik_settings?.enabled ?? false}
              onChange={(v) => update("ik_settings.enabled", v)}
              label="Enable IK"
            />
          </div>
          <div>
            <FieldLabel>Elbow Offset (X, Y, Z)</FieldLabel>
            <div className="flex gap-2">
              {[0, 1, 2].map((j) => (
                <NumberInput key={j} value={(rig.ik_settings?.elbow_offset ?? [0, 0, 0])[j]} onChange={(v) => {
                  const eo: [number, number, number] = [...(rig.ik_settings?.elbow_offset ?? [0, 0, 0])] as [number, number, number];
                  eo[j] = v;
                  update("ik_settings.elbow_offset", eo);
                }} step={0.1} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntitySection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const entities = schemaData.entity_registry;
  const [expandedEntity, setExpandedEntity] = useState<number | null>(null);

  const addEntity = () => {
    const next = structuredClone(schemaData);
    next.entity_registry.push({
      id: `entity_${next.entity_registry.length}`,
      type: "grabbable",
      model_prompt: "",
      mass_kg: 1,
      physics_material: { friction: 0.5, bounce: 0.3 },
      damage: 0,
      health: 100,
      speed: 0,
      behavior_tree: "",
      navmesh_layer: "",
    });
    setSchemaData(next);
  };

  const removeEntity = (index: number) => {
    const next = structuredClone(schemaData);
    next.entity_registry.splice(index, 1);
    setSchemaData(next);
    if (expandedEntity === index) setExpandedEntity(null);
  };

  const updateEntity = (index: number, field: string, value: unknown) => {
    const next = structuredClone(schemaData);
    const entity = next.entity_registry[index];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      if (!entity[parent as keyof Entity] || typeof entity[parent as keyof Entity] !== "object") {
        (entity as Record<string, unknown>)[parent] = {};
      }
      ((entity as Record<string, unknown>)[parent] as Record<string, unknown>)[child] = value;
    } else {
      (entity as Record<string, unknown>)[field] = value;
    }
    setSchemaData(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Entity Registry</SectionTitle>
        <CyberButton variant="outline" size="sm" onClick={addEntity}>
          <Plus className="w-4 h-4" /> Add Entity
        </CyberButton>
      </div>

      {entities.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-primary/20 bg-background/50">
          <Box className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-display font-bold mb-2">NO ENTITIES</h3>
          <p className="text-muted-foreground font-mono text-sm mb-4">Add items, NPCs, triggers, and props to your VR world.</p>
          <CyberButton variant="outline" size="sm" onClick={addEntity}>
            <Plus className="w-4 h-4" /> Add First Entity
          </CyberButton>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((entity, i) => (
            <div key={i} className="border border-primary/20 bg-card">
              <button
                onClick={() => setExpandedEntity(expandedEntity === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  {expandedEntity === i ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-mono text-sm font-bold">{entity.id}</span>
                  <CyberBadge variant="primary">{entity.type}</CyberBadge>
                  {entity.model_prompt && <span className="text-muted-foreground text-xs font-mono truncate max-w-48">{entity.model_prompt}</span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeEntity(i); }} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </button>

              {expandedEntity === i && (
                <div className="px-4 pb-4 space-y-4 border-t border-primary/10 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FieldLabel>Entity ID</FieldLabel>
                      <TextInput value={entity.id} onChange={(v) => updateEntity(i, "id", v)} />
                    </div>
                    <div>
                      <FieldLabel>Type</FieldLabel>
                      <SelectInput value={entity.type} onChange={(v) => updateEntity(i, "type", v)} options={[
                        { value: "grabbable", label: "Grabbable" },
                        { value: "npc", label: "NPC" },
                        { value: "trigger", label: "Trigger" },
                        { value: "static_prop", label: "Static Prop" },
                      ]} />
                    </div>
                    <div>
                      <FieldLabel>Model Prompt</FieldLabel>
                      <TextInput value={entity.model_prompt || ""} onChange={(v) => updateEntity(i, "model_prompt", v)} placeholder="3D model description..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <FieldLabel>Mass (kg)</FieldLabel>
                      <NumberInput value={entity.mass_kg ?? 0} onChange={(v) => updateEntity(i, "mass_kg", v)} step={0.1} min={0} />
                    </div>
                    <div>
                      <FieldLabel>Damage</FieldLabel>
                      <NumberInput value={entity.damage ?? 0} onChange={(v) => updateEntity(i, "damage", v)} step={1} min={0} />
                    </div>
                    <div>
                      <FieldLabel>Health</FieldLabel>
                      <NumberInput value={entity.health ?? 0} onChange={(v) => updateEntity(i, "health", v)} step={1} min={0} />
                    </div>
                    <div>
                      <FieldLabel>Speed</FieldLabel>
                      <NumberInput value={entity.speed ?? 0} onChange={(v) => updateEntity(i, "speed", v)} step={0.5} min={0} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Friction</FieldLabel>
                      <NumberInput value={entity.physics_material?.friction ?? 0.5} onChange={(v) => updateEntity(i, "physics_material.friction", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.05} />
                    </div>
                    <div>
                      <FieldLabel>Bounce</FieldLabel>
                      <NumberInput value={entity.physics_material?.bounce ?? 0} onChange={(v) => updateEntity(i, "physics_material.bounce", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.05} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Behavior Tree</FieldLabel>
                      <TextInput value={entity.behavior_tree || ""} onChange={(v) => updateEntity(i, "behavior_tree", v)} placeholder="patrol_and_chase" />
                    </div>
                    <div>
                      <FieldLabel>Navmesh Layer</FieldLabel>
                      <TextInput value={entity.navmesh_layer || ""} onChange={(v) => updateEntity(i, "navmesh_layer", v)} placeholder="ground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Grab Offset (X, Y, Z)</FieldLabel>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((j) => (
                          <NumberInput key={j} value={(entity.grab_offset ?? [0, 0, 0])[j]} onChange={(v) => {
                            const go: [number, number, number] = [...(entity.grab_offset ?? [0, 0, 0])] as [number, number, number];
                            go[j] = v;
                            updateEntity(i, "grab_offset", go);
                          }} step={0.1} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Haptic on Hit (comma-sep values)</FieldLabel>
                      <TextInput
                        value={(entity.haptic_on_hit || []).join(", ")}
                        onChange={(v) => updateEntity(i, "haptic_on_hit", v.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n)))}
                        placeholder="0, 0.5, 1, 0.5, 0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeSection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const recipes = schemaData.logic_recipes;
  const [expanded, setExpanded] = useState<number | null>(null);

  const addRecipe = () => {
    const next = structuredClone(schemaData);
    next.logic_recipes.push({
      name: `recipe_${next.logic_recipes.length}`,
      type: "crafting",
      ingredients: [],
      trigger: { type: "", to: "" },
      result: { spawn: "", probability: 1 },
      nodes: [],
    });
    setSchemaData(next);
    setExpanded(next.logic_recipes.length - 1);
  };

  const removeRecipe = (index: number) => {
    const next = structuredClone(schemaData);
    next.logic_recipes.splice(index, 1);
    setSchemaData(next);
    if (expanded === index) setExpanded(null);
  };

  const updateRecipe = (index: number, field: string, value: unknown) => {
    const next = structuredClone(schemaData);
    const recipe = next.logic_recipes[index];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      if (!(recipe as Record<string, unknown>)[parent] || typeof (recipe as Record<string, unknown>)[parent] !== "object") {
        (recipe as Record<string, unknown>)[parent] = {};
      }
      ((recipe as Record<string, unknown>)[parent] as Record<string, unknown>)[child] = value;
    } else {
      (recipe as Record<string, unknown>)[field] = value;
    }
    setSchemaData(next);
  };

  const addNode = (recipeIndex: number) => {
    const next = structuredClone(schemaData);
    const recipe = next.logic_recipes[recipeIndex];
    if (!recipe.nodes) recipe.nodes = [];
    recipe.nodes.push({
      id: recipe.nodes.length,
      type: "action",
      action: "",
    });
    setSchemaData(next);
  };

  const removeNode = (recipeIndex: number, nodeIndex: number) => {
    const next = structuredClone(schemaData);
    next.logic_recipes[recipeIndex].nodes!.splice(nodeIndex, 1);
    setSchemaData(next);
  };

  const updateNode = (recipeIndex: number, nodeIndex: number, field: string, value: unknown) => {
    const next = structuredClone(schemaData);
    (next.logic_recipes[recipeIndex].nodes![nodeIndex] as Record<string, unknown>)[field] = value;
    setSchemaData(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Logic Recipes</SectionTitle>
        <CyberButton variant="outline" size="sm" onClick={addRecipe}>
          <Plus className="w-4 h-4" /> Add Recipe
        </CyberButton>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-primary/20 bg-background/50">
          <Layers className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-display font-bold mb-2">NO RECIPES</h3>
          <p className="text-muted-foreground font-mono text-sm mb-4">Add crafting recipes, behavior trees, triggers, and spawning rules.</p>
          <CyberButton variant="outline" size="sm" onClick={addRecipe}>
            <Plus className="w-4 h-4" /> Add First Recipe
          </CyberButton>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe, i) => (
            <div key={i} className="border border-primary/20 bg-card">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  {expanded === i ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-mono text-sm font-bold">{recipe.name || "Untitled"}</span>
                  <CyberBadge variant="primary">{recipe.type}</CyberBadge>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeRecipe(i); }} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </button>

              {expanded === i && (
                <div className="px-4 pb-4 space-y-4 border-t border-primary/10 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Name</FieldLabel>
                      <TextInput value={recipe.name} onChange={(v) => updateRecipe(i, "name", v)} placeholder="Recipe name" />
                    </div>
                    <div>
                      <FieldLabel>Type</FieldLabel>
                      <SelectInput value={recipe.type} onChange={(v) => updateRecipe(i, "type", v)} options={[
                        { value: "crafting", label: "Crafting" },
                        { value: "behavior_tree", label: "Behavior Tree" },
                        { value: "trigger", label: "Trigger" },
                        { value: "spawning", label: "Spawning" },
                      ]} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Ingredients (comma-separated)</FieldLabel>
                    <TextInput
                      value={(recipe.ingredients || []).join(", ")}
                      onChange={(v) => updateRecipe(i, "ingredients", v.split(",").map((s) => s.trim()).filter(Boolean))}
                      placeholder="item_a, item_b"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Trigger Type</FieldLabel>
                      <TextInput value={recipe.trigger?.type || ""} onChange={(v) => updateRecipe(i, "trigger.type", v)} placeholder="on_enter, on_grab, etc." />
                    </div>
                    <div>
                      <FieldLabel>Trigger Target</FieldLabel>
                      <TextInput value={recipe.trigger?.to || ""} onChange={(v) => updateRecipe(i, "trigger.to", v)} placeholder="Target entity ID" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Result Spawn</FieldLabel>
                      <TextInput value={recipe.result?.spawn || ""} onChange={(v) => updateRecipe(i, "result.spawn", v)} placeholder="Spawned entity ID" />
                    </div>
                    <div>
                      <FieldLabel>Probability</FieldLabel>
                      <NumberInput value={recipe.result?.probability ?? 1} onChange={(v) => updateRecipe(i, "result.probability", Math.max(0, Math.min(1, v)))} min={0} max={1} step={0.1} />
                    </div>
                  </div>

                  {recipe.type === "behavior_tree" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <FieldLabel>Behavior Tree Nodes</FieldLabel>
                        <CyberButton variant="ghost" size="sm" onClick={() => addNode(i)}>
                          <Plus className="w-3 h-3" /> Add Node
                        </CyberButton>
                      </div>
                      {(recipe.nodes || []).length === 0 ? (
                        <p className="font-mono text-xs text-muted-foreground">No nodes defined.</p>
                      ) : (
                        <div className="space-y-2">
                          {(recipe.nodes || []).map((node, ni) => (
                            <div key={ni} className="flex items-center gap-2 bg-black/30 p-2 border border-primary/10">
                              <span className="font-mono text-xs text-muted-foreground w-8">#{node.id}</span>
                              <select
                                value={node.type}
                                onChange={(e) => updateNode(i, ni, "type", e.target.value)}
                                className="bg-black/50 border border-primary/20 font-mono text-sm px-2 py-1 outline-none"
                              >
                                <option value="selector">Selector</option>
                                <option value="sequence">Sequence</option>
                                <option value="condition">Condition</option>
                                <option value="action">Action</option>
                              </select>
                              {(node.type === "action" || node.type === "condition") && (
                                <InlineCell
                                  value={node.type === "action" ? (node.action || "") : (node.condition || "")}
                                  onChange={(v) => updateNode(i, ni, node.type === "action" ? "action" : "condition", v)}
                                  width="flex-1"
                                  placeholder={node.type === "action" ? "Action name..." : "Condition expression..."}
                                />
                              )}
                              {(node.type === "selector" || node.type === "sequence") && (
                                <InlineCell
                                  value={(node.children || []).join(", ")}
                                  onChange={(v) => updateNode(i, ni, "children", v.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)))}
                                  width="flex-1"
                                  placeholder="Child node IDs (comma-sep)"
                                />
                              )}
                              <button onClick={() => removeNode(i, ni)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LevelSection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const levels = schemaData.levels;

  const addLevel = () => {
    const next = structuredClone(schemaData);
    next.levels.push({
      id: `level_${next.levels.length + 1}`,
      description: "",
      layout_prompt: "",
      objectives: [],
      win_condition: { collect_shards: 0, time_limit_seconds: 0 },
    });
    setSchemaData(next);
  };

  const removeLevel = (index: number) => {
    const next = structuredClone(schemaData);
    next.levels.splice(index, 1);
    setSchemaData(next);
  };

  const updateLevel = (index: number, field: string, value: unknown) => {
    const next = structuredClone(schemaData);
    const level = next.levels[index];
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      if (!(level as Record<string, unknown>)[parent] || typeof (level as Record<string, unknown>)[parent] !== "object") {
        (level as Record<string, unknown>)[parent] = {};
      }
      ((level as Record<string, unknown>)[parent] as Record<string, unknown>)[child] = value;
    } else {
      (level as Record<string, unknown>)[field] = value;
    }
    setSchemaData(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Levels</SectionTitle>
        <CyberButton variant="outline" size="sm" onClick={addLevel}>
          <Plus className="w-4 h-4" /> Add Level
        </CyberButton>
      </div>

      {levels.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-primary/20 bg-background/50">
          <Cpu className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-display font-bold mb-2">NO LEVELS</h3>
          <p className="text-muted-foreground font-mono text-sm mb-4">Define levels with objectives, layouts, and win conditions.</p>
          <CyberButton variant="outline" size="sm" onClick={addLevel}>
            <Plus className="w-4 h-4" /> Add First Level
          </CyberButton>
        </div>
      ) : (
        <div className="space-y-6">
          {levels.map((level, i) => (
            <div key={i} className="border border-primary/20 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <CyberBadge variant="primary">{level.id || `Level ${i + 1}`}</CyberBadge>
                <button onClick={() => removeLevel(i)} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <FieldLabel>Level ID</FieldLabel>
                  <TextInput value={level.id} onChange={(v) => updateLevel(i, "id", v)} />
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <TextInput value={level.description} onChange={(v) => updateLevel(i, "description", v)} placeholder="Level description" />
                </div>
              </div>
              <div className="mb-4">
                <FieldLabel>Layout Prompt</FieldLabel>
                <TextArea value={level.layout_prompt || ""} onChange={(v) => updateLevel(i, "layout_prompt", v)} placeholder="Describe the level layout for AI generation..." rows={2} />
              </div>
              <div className="mb-4">
                <FieldLabel>Objectives (comma-separated)</FieldLabel>
                <TextInput
                  value={(level.objectives || []).join(", ")}
                  onChange={(v) => updateLevel(i, "objectives", v.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="Find the key, Escape the room"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Collect Shards</FieldLabel>
                  <NumberInput
                    value={level.win_condition?.collect_shards ?? 0}
                    onChange={(v) => updateLevel(i, "win_condition.collect_shards", Math.round(v))}
                    min={0} step={1}
                  />
                </div>
                <div>
                  <FieldLabel>Time Limit (seconds)</FieldLabel>
                  <NumberInput
                    value={level.win_condition?.time_limit_seconds ?? 0}
                    onChange={(v) => updateLevel(i, "win_condition.time_limit_seconds", Math.round(v))}
                    min={0} step={30}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioSection({ schemaData, setSchemaData, errors }: { schemaData: SchemaData; setSchemaData: (v: SchemaData) => void; errors: ValidationError[] }) {
  const audio = schemaData.audio;

  return (
    <div className="space-y-8">
      <SectionTitle>Audio</SectionTitle>

      <div>
        <h3 className="font-display text-lg font-bold text-primary mb-4 uppercase">Background Music</h3>
        <FieldLabel>BGM Prompt</FieldLabel>
        <TextArea
          value={audio.bgm?.prompt || ""}
          onChange={(v) => {
            const next = structuredClone(schemaData);
            next.audio.bgm = { prompt: v };
            setSchemaData(next);
          }}
          placeholder="Describe the background music style..."
          rows={3}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-primary uppercase">SFX Library</h3>
          <CyberButton variant="ghost" size="sm" onClick={() => {
            const next = structuredClone(schemaData);
            if (!next.audio.sfx_library) next.audio.sfx_library = [];
            next.audio.sfx_library.push({ id: `sfx_${next.audio.sfx_library.length}`, prompt: "" });
            setSchemaData(next);
          }}>
            <Plus className="w-3 h-3" /> Add SFX
          </CyberButton>
        </div>

        {(!audio.sfx_library || audio.sfx_library.length === 0) ? (
          <div className="text-center py-8 border border-dashed border-primary/20 bg-background/50">
            <Mic2 className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-mono text-sm">No sound effects defined yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {audio.sfx_library.map((sfx, i) => (
              <div key={i} className="flex items-center gap-3 bg-black/30 p-3 border border-primary/10">
                <InlineCell value={sfx.id} onChange={(v) => {
                  const next = structuredClone(schemaData);
                  next.audio.sfx_library![i].id = v;
                  setSchemaData(next);
                }} width="w-32" placeholder="sfx_id" />
                <input
                  value={sfx.prompt}
                  onChange={(e) => {
                    const next = structuredClone(schemaData);
                    next.audio.sfx_library![i].prompt = e.target.value;
                    setSchemaData(next);
                  }}
                  className="bg-transparent border-b border-primary/30 text-foreground font-mono text-sm px-2 py-1 outline-none flex-1"
                  placeholder="Describe the sound..."
                />
                <button onClick={() => {
                  const next = structuredClone(schemaData);
                  next.audio.sfx_library!.splice(i, 1);
                  setSchemaData(next);
                }} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
