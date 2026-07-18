import { useState, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, Copy, Check, ArrowRight,
  Box, Cpu, Globe, Glasses, Layers, Mic2, Terminal,
  Download, BookOpen, Workflow, Wrench, HelpCircle,
  Zap, Database, Code2, Sparkles, GitFork,
} from "lucide-react";
import { CyberButton, CyberCard, CyberBadge } from "@/components/cyber-ui";
import { Highlight, themes } from "prism-react-renderer";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "export", label: "Export Schema", icon: Download },
  { id: "agents", label: "AI Agent Pipeline", icon: Workflow },
  { id: "godot", label: "Godot Integration", icon: Wrench },
  { id: "alternatives", label: "Other Platforms", icon: Layers },
  { id: "community", label: "Community", icon: GitFork },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-primary transition-colors bg-background/80 border border-primary/20"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const LANG_MAP: Record<string, string> = {
  typescript: "tsx",
  ts: "tsx",
  javascript: "jsx",
  js: "jsx",
  python: "python",
  py: "python",
  bash: "bash",
  sh: "bash",
  gdscript: "python",
  json: "json",
  text: "markdown",
};

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const prismLang = LANG_MAP[language] || "markdown";
  return (
    <div className="relative group">
      <CopyButton text={code} />
      <Highlight theme={themes.nightOwl} code={code.trim()} language={prismLang}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="bg-black/60 border border-primary/20 p-4 overflow-x-auto font-mono text-xs leading-relaxed" style={{ background: "rgba(0,0,0,0.6)" }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} style={{}}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
      <div className="absolute bottom-2 right-2 font-mono text-[10px] text-primary/40 uppercase">{language}</div>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-primary/20 bg-card/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left font-display text-sm uppercase tracking-widest text-foreground hover:text-primary transition-colors cursor-pointer"
      >
        {open ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
        {title}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl md:text-3xl font-display font-bold text-glow mb-6 uppercase scroll-mt-24">
      {children}
    </h2>
  );
}

function PipelineDiagram() {
  const steps = [
    { label: "GAMEDNA\nSCHEMA", icon: Database, color: "border-primary text-primary", glow: "shadow-[0_0_15px_hsl(180,100%,50%,0.3)]" },
    { label: "AI AGENT\nPIPELINE", icon: Sparkles, color: "border-secondary text-secondary", glow: "shadow-[0_0_15px_hsl(320,100%,50%,0.3)]" },
    { label: "GODOT 4.x\nPROJECT", icon: Code2, color: "border-accent text-accent", glow: "shadow-[0_0_15px_hsl(280,100%,60%,0.3)]" },
    { label: "VR\nDEVICE", icon: Glasses, color: "border-green-500 text-green-400", glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]" },
  ];
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-0 py-8">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col md:flex-row items-center gap-2 md:gap-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.15 }}
            viewport={{ once: true }}
            className={`flex flex-col items-center justify-center w-36 h-28 border-2 bg-card/80 ${step.color} ${step.glow} clip-edges`}
          >
            <step.icon className="w-7 h-7 mb-2" />
            <span className="font-mono text-[10px] text-center whitespace-pre-line leading-tight uppercase tracking-wider">{step.label}</span>
          </motion.div>
          {i < steps.length - 1 && (
            <div className="hidden md:flex items-center px-3">
              <ArrowRight className="w-6 h-6 text-primary/50" />
            </div>
          )}
          {i < steps.length - 1 && (
            <div className="md:hidden flex items-center py-1">
              <ChevronDown className="w-5 h-5 text-primary/50" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


export default function GuidePage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="pb-20">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 border border-primary/50 bg-primary/10 text-primary text-xs font-mono tracking-widest uppercase clip-edges">
          <Terminal className="w-3 h-3" />
          Implementation Protocol
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-glow mb-4 uppercase">
          Build Guide
        </h1>
        <p className="text-muted-foreground font-sans text-lg max-w-3xl">
          Take your GameDNA schema from this platform and turn it into a real, playable VR experience.
          This guide covers the full pipeline: export, AI agents, Godot setup, and deployment to headset.
        </p>
      </div>

      <PipelineDiagram />

      <div className="flex flex-col lg:flex-row gap-8 mt-10">
        <aside className="lg:w-56 shrink-0">
          <nav className="lg:sticky lg:top-24 space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left font-mono text-xs uppercase tracking-widest transition-all duration-200 cursor-pointer border-l-2 ${
                  activeSection === s.id
                    ? "border-primary text-primary bg-primary/5 text-glow"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                <s.icon className="w-3.5 h-3.5 shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 space-y-16">
          <section>
            <SectionHeading id="overview">Overview</SectionHeading>
            <div className="space-y-6">
              <CyberCard>
                <h3 className="text-lg font-display font-bold mb-3 text-primary">Schema-First Design</h3>
                <p className="text-muted-foreground font-sans leading-relaxed mb-4">
                  ForgeDNA uses a <strong className="text-foreground">schema-first</strong> approach to VR game development.
                  Instead of writing code directly, you define your entire game as a structured JSON document &mdash; the <strong className="text-foreground">GameDNA</strong>.
                  This schema describes everything: environment physics, player rig, entities, game logic, levels, and audio.
                </p>
                <p className="text-muted-foreground font-sans leading-relaxed mb-4">
                  The schema is engine-agnostic and human-readable. AI agents then read this schema and generate
                  engine-specific project files (Godot scenes, GDScript, resources) that you can open, customize, and compile.
                </p>
                <p className="text-muted-foreground font-sans leading-relaxed">
                  This separation means you can iterate on game design here on ForgeDNA &mdash; remixing, forking, and
                  refining schemas &mdash; without needing a game engine installed. When you're ready to build, export the
                  schema and feed it to your AI agent pipeline on any compute infrastructure.
                </p>
              </CyberCard>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Globe, title: "Design Here", desc: "Create, remix, and refine GameDNA schemas using the editor and community templates." },
                  { icon: Sparkles, title: "Generate Anywhere", desc: "Feed your schema to AI agents on any infrastructure to produce Godot projects." },
                  { icon: Glasses, title: "Play Everywhere", desc: "Compile and deploy to Quest, PCVR, WebXR, or any OpenXR-compatible device." },
                ].map((item, i) => (
                  <CyberCard key={i} className="text-center">
                    <item.icon className={`w-8 h-8 mx-auto mb-3 ${i === 0 ? "text-primary" : i === 1 ? "text-secondary" : "text-accent"}`} />
                    <h4 className="font-display font-bold text-sm mb-2">{item.title}</h4>
                    <p className="text-muted-foreground text-xs font-sans">{item.desc}</p>
                  </CyberCard>
                ))}
              </div>

              <div>
                <h3 className="text-lg font-display font-bold mb-3">The Seven Pillars</h3>
                <p className="text-muted-foreground font-sans text-sm mb-4">
                  Every GameDNA schema is organized into seven sections that map directly to game engine concepts:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { icon: Terminal, label: "Meta", color: "text-primary" },
                    { icon: Globe, label: "Environment", color: "text-primary" },
                    { icon: Glasses, label: "Player Rig", color: "text-secondary" },
                    { icon: Box, label: "Entities", color: "text-accent" },
                    { icon: Cpu, label: "Logic Recipes", color: "text-primary" },
                    { icon: Layers, label: "Levels", color: "text-secondary" },
                    { icon: Mic2, label: "Audio", color: "text-accent" },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border border-primary/10 bg-card/50 font-mono text-xs">
                      <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                      <span className="uppercase tracking-wider">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading id="export">Export Your Schema</SectionHeading>
            <div className="space-y-6">
              <p className="text-muted-foreground font-sans leading-relaxed">
                There are three ways to get your GameDNA JSON out of ForgeDNA and into your agent pipeline:
              </p>

              <Collapsible title="1. Download JSON from the Editor" defaultOpen>
                <p className="text-muted-foreground font-sans text-sm">
                  Open any schema in the editor, then click the <strong className="text-foreground">Export JSON</strong> button
                  in the toolbar. This downloads the complete GameDNA as a <code className="text-primary">.json</code> file.
                  On the detail view, use the <strong className="text-foreground">Extract JSON</strong> button instead.
                </p>
                <div className="flex gap-3 mt-3">
                  <Link href="/schemas">
                    <CyberButton size="sm">
                      <Database className="w-3.5 h-3.5" />
                      Browse Schemas
                    </CyberButton>
                  </Link>
                </div>
              </Collapsible>

              <Collapsible title="2. Use the API Endpoint">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  Fetch any public schema programmatically via the REST API. The response includes the full <code className="text-primary">schemaData</code> payload:
                </p>
                <CodeBlock
                  language="bash"
                  code={`# Fetch a schema by ID
curl https://your-forgedna-domain/api/schemas/42

# The response includes:
# {
#   "id": 42,
#   "title": "My VR Game",
#   "schemaData": { ... },   <-- This is the GameDNA
#   "version": "1.0",
#   ...
# }

# You can also search by genre or keyword:
curl "https://your-forgedna-domain/api/schemas?genre=escape-room&sort=stars"`}
                />
              </Collapsible>

              <Collapsible title="3. Copy the GameDNA JSON Schema Contract">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  For AI agents, the canonical JSON Schema contract defines exactly what fields are valid. Your agent should use this to validate schemas:
                </p>
                <CodeBlock
                  language="bash"
                  code={`# Get the GameDNA JSON Schema contract (agent-readable)
curl https://your-forgedna-domain/api/schemas/game-dna

# Returns the full JSON Schema definition that validates
# all GameDNA documents. Feed this to your AI agent so it
# understands the structure it's working with.`}
                />
              </Collapsible>
            </div>
          </section>

          <section>
            <SectionHeading id="agents">AI Agent Pipeline</SectionHeading>
            <div className="space-y-6">
              <CyberCard className="border-secondary/30">
                <div className="flex items-start gap-3">
                  <Zap className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-display font-bold mb-2 text-secondary">The Core Idea</h3>
                    <p className="text-muted-foreground font-sans text-sm leading-relaxed">
                      An AI agent reads your GameDNA schema section by section and generates corresponding
                      Godot 4.x project files &mdash; scenes (.tscn), scripts (.gd), and resources. The agent uses
                      MCP (Model Context Protocol) tools to interact with the schema and write files to a project directory.
                    </p>
                  </div>
                </div>
              </CyberCard>


              <Collapsible title="MCP Server Architecture" defaultOpen>
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  Set up an MCP server that exposes GameDNA-specific tools to your AI agent.
                  The three core tools below mirror ForgeDNA's own internal agent architecture.
                  The agent calls these in a loop to read schema sections, generate code, and write files:
                </p>
                <CodeBlock
                  language="typescript"
                  code={`// MCP Tool Definitions for GameDNA Agent
// These three tools form the core agent loop:
const tools = [
  {
    name: "read_game_dna",
    description: "Read a section of the GameDNA schema",
    parameters: {
      section: {
        type: "string",
        enum: ["meta", "environment_config", "player_rig",
               "entity_registry", "logic_recipes", "levels", "audio"]
      }
    }
  },
  {
    name: "write_gdscript",
    description: "Write a GDScript file to the Godot project",
    parameters: {
      file_path: { type: "string" },        // e.g. "scripts/player_locomotion.gd"
      content: { type: "string" },           // The GDScript source code
      description: { type: "string" },       // What this script does
      target_entity_id: { type: "string" },  // Which entity this binds to
      node_type: { type: "string" },         // Godot node type (CharacterBody3D, etc.)
      attach_mode: { type: "string", enum: ["root", "child"] }
    },
    required: ["file_path", "content", "description", "target_entity_id"]
  },
  {
    name: "write_tscn",
    description: "Write a Godot scene file (.tscn)",
    parameters: {
      file_path: { type: "string" },
      content: { type: "string" },
      description: { type: "string" }
    },
    required: ["file_path", "content", "description"]
  }
];
// Note: Validation is handled server-side after generation.
// Your agent should self-validate by re-reading generated files
// and checking for consistency with the schema.`}
                />
                <p className="text-muted-foreground font-sans text-sm mt-3">
                  This architecture lets the agent iteratively build the project, reading schema sections
                  on demand and writing files as it goes.
                </p>
                <div className="mt-3 p-3 border border-secondary/30 bg-secondary/5">
                  <p className="text-secondary font-mono text-xs font-bold mb-1">VALIDATION APPROACH</p>
                  <p className="text-muted-foreground font-sans text-xs">
                    ForgeDNA handles validation server-side after generation rather than exposing a separate
                    validation tool. For your own agent pipeline, implement a validation step by having the agent
                    re-read the original schema sections via <code className="text-primary">read_game_dna</code> and
                    compare them against the files it just wrote. Common checks: verify all <code className="text-primary">target_entity_id</code> references
                    exist in the entity registry, confirm signal names match, and ensure node paths are valid.
                  </p>
                </div>
              </Collapsible>

              <Collapsible title="Agent Loop Walkthrough">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  Here's the recommended sequence an agent should follow when processing a GameDNA schema:
                </p>
                <div className="space-y-3">
                  {[
                    { step: "1", label: "Read Meta & Environment", desc: "Read the meta section for game title, platforms, and vibe prompt. Read environment_config for physics constants, skybox, and terrain." },
                    { step: "2", label: "Generate project.godot", desc: "Create the Godot project file with physics settings (gravity, friction), renderer config, and OpenXR toggles from the schema." },
                    { step: "3", label: "Build Player Rig Scene", desc: "Read player_rig section and generate an XROrigin3D scene with camera, controllers, collision capsule, and locomotion script." },
                    { step: "4", label: "Generate Entity Scenes", desc: "Read entity_registry and create individual .tscn files for each entity (grabbable items, NPCs, triggers, static props) with appropriate physics." },
                    { step: "5", label: "Process Logic Recipes", desc: "Read logic_recipes and generate GDScript files for each recipe type (behavior trees, crafting systems, triggers, spawners). Bind scripts to entities." },
                    { step: "6", label: "Assemble Level Scenes", desc: "Read levels section and create level .tscn files with spawn points, objective triggers, and entity placements." },
                    { step: "7", label: "Wire Audio", desc: "Read audio section and create audio bus configuration, BGM nodes, and SFX trigger mappings." },
                    { step: "8", label: "Validate & Iterate", desc: "Run validation checks to ensure all scripts reference valid nodes, all entities are placed, and the project can be opened in Godot." },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3 p-3 bg-black/30 border border-primary/10">
                      <div className="w-7 h-7 flex items-center justify-center border border-primary/30 bg-primary/10 text-primary font-mono text-xs font-bold shrink-0">
                        {s.step}
                      </div>
                      <div>
                        <h4 className="font-display text-sm font-bold mb-0.5">{s.label}</h4>
                        <p className="text-muted-foreground font-sans text-xs">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Collapsible>

              <Collapsible title="Prompt Engineering Tips">
                <div className="space-y-4">
                  <p className="text-muted-foreground font-sans text-sm">
                    Getting high-quality Godot code from LLMs requires targeted prompting. Here are key strategies:
                  </p>
                  <div className="space-y-3">
                    {[
                      { title: "Include the Vibe Prompt", desc: "Pass the schema's vibe_prompt to the agent. This gives atmospheric context (\"rain-slick neon streets, distant sirens\") that helps generate thematically consistent variable names, comments, and shader parameters." },
                      { title: "Specify Godot Version Explicitly", desc: "Always tell the agent you need Godot 4.x code. GDScript changed significantly from 3.x to 4.x (typed signals, @export annotations, Node.get_tree() patterns)." },
                      { title: "Provide the Entity Registry as Context", desc: "When generating logic recipe scripts, include the full entity_registry in the prompt so the agent knows which entities exist, their physics properties, and how to reference them." },
                      { title: "Use Recipe-Type-Specific Prompts", desc: "Different recipe types need different prompt templates: behavior_tree recipes should generate state machines, crafting recipes need ingredient validation, trigger recipes need signal wiring, and spawning recipes need instantiation patterns." },
                      { title: "Validate target_entity_id Bindings", desc: "Scripts need to know which entity scene to attach to. Include the entity ID in tool call parameters so the agent can generate correct node path references." },
                    ].map((tip, i) => (
                      <div key={i} className="border-l-2 border-secondary/30 pl-4">
                        <h4 className="font-display text-sm font-bold mb-1">{tip.title}</h4>
                        <p className="text-muted-foreground font-sans text-xs">{tip.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Collapsible>

              <Collapsible title="Example: Minimal Agent Script">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  Here's a minimal Python script that demonstrates the agent loop pattern using OpenAI:
                </p>
                <CodeBlock
                  language="python"
                  code={`import openai
import json

client = openai.OpenAI()

# Load your GameDNA schema
with open("my_game.gamedna.json") as f:
    schema = json.load(f)

# System prompt for the agent
SYSTEM_PROMPT = """You are a Godot 4.x VR game generator.
You will receive a GameDNA schema and must generate a complete
Godot project. Use the provided tools to read schema sections
and write files.

Target: Godot 4.3+ with OpenXR
Output: .tscn scenes, .gd scripts, project.godot

Rules:
- Use GDScript (not C#)
- All XR nodes use XROrigin3D hierarchy
- Use @export annotations for configurable properties
- Follow the entity_registry exactly for physics materials
"""

# Run the agent loop
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": f"Generate a Godot project from this GameDNA:\\n{json.dumps(schema, indent=2)}"}
]

for iteration in range(20):  # Max iterations
    response = client.chat.completions.create(
        model="your-preferred-model",  # Any capable LLM with tool-calling support
        messages=messages,
        tools=MCP_TOOLS,  # Your tool definitions
    )

    msg = response.choices[0].message
    if msg.tool_calls:
        for tc in msg.tool_calls:
            result = execute_tool(tc.function.name, json.loads(tc.function.arguments))
            messages.append({"role": "tool", "content": json.dumps(result), "tool_call_id": tc.id})
    elif msg.content and "DONE" in msg.content:
        print("Project generation complete!")
        break
    messages.append(msg)`}
                />
              </Collapsible>
            </div>
          </section>

          <section>
            <SectionHeading id="godot">Godot Integration</SectionHeading>
            <div className="space-y-6">
              <Collapsible title="1. Installing Godot with XR Support" defaultOpen>
                <div className="space-y-3">
                  <p className="text-muted-foreground font-sans text-sm">
                    GameDNA targets <strong className="text-foreground">Godot 4.3+</strong> with OpenXR support.
                    Download the standard build from the official site:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`# Download Godot 4.3+ (standard, not .NET)
# https://godotengine.org/download

# On Linux:
wget https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip Godot_v4.3-stable_linux.x86_64.zip

# Verify OpenXR is available:
# Editor > Project Settings > Plugins > Search "OpenXR"`}
                  />
                  <p className="text-muted-foreground font-sans text-sm">
                    For <strong className="text-foreground">headless generation</strong> (CI/CD or server builds), use the headless export:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`# Headless Godot for server-side generation
./Godot --headless --export-release "Android" build/game.apk
./Godot --headless --export-release "Web" build/index.html`}
                  />
                </div>
              </Collapsible>

              <Collapsible title="2. Project Structure">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  AI-generated projects follow this structure, which maps directly to GameDNA pillars:
                </p>
                <CodeBlock
                  language="text"
                  code={`my_vr_game/
├── project.godot          # Physics, OpenXR, renderer settings
├── player_rig.tscn        # XROrigin3D + camera + controllers
├── main.tscn              # Main scene with terrain + spawn points
├── entities/
│   ├── health_potion.tscn # Grabbable RigidBody3D
│   ├── goblin_npc.tscn    # CharacterBody3D with AI
│   ├── door_trigger.tscn  # Area3D trigger zone
│   └── torch_prop.tscn    # StaticBody3D decoration
├── levels/
│   ├── level_1.tscn       # Level scene with objectives
│   └── level_2.tscn
├── scripts/
│   ├── locomotion.gd      # Player movement (teleport/smooth)
│   ├── grab_system.gd     # Hand grab mechanics
│   ├── npc_patrol.gd      # NPC behavior tree
│   ├── crafting.gd        # Crafting recipe logic
│   └── trigger_zone.gd    # Event triggers
└── audio/
    └── audio_bus.tres      # Audio bus layout`}
                />
              </Collapsible>

              <Collapsible title="3. OpenXR Configuration">
                <p className="text-muted-foreground font-sans text-sm mb-3">
                  GameDNA schemas target OpenXR, the universal VR standard. Here's how to configure it in your generated project:
                </p>
                <CodeBlock
                  language="gdscript"
                  code={`# project.godot OpenXR settings (auto-generated from schema)
[xr]
openxr/enabled=true
openxr/startup_alert=true
openxr/form_factor="Head Mounted Display"
openxr/view_configuration="Stereo"
openxr/reference_space="Stage"

# Physics from GameDNA environment_config
[physics]
3d/default_gravity=9.8          # From environment_config.physics.gravity_vector.y
3d/default_linear_damp=0.1
3d/default_angular_damp=0.1

# Renderer
[rendering]
renderer/rendering_method="forward_plus"  # Default; change to "mobile" for Quest-only`}
                />
              </Collapsible>

              <Collapsible title="4. Testing Workflow">
                <div className="space-y-3">
                  <p className="text-muted-foreground font-sans text-sm">
                    After your agent generates the project, follow this testing workflow:
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Desktop Preview", desc: "Open in Godot editor and press F5 to run. Use WASD + mouse to navigate in flat mode. Check that scenes load, entities are placed, and scripts don't error." },
                      { label: "OpenXR Desktop", desc: "If you have SteamVR or Oculus Link, enable OpenXR in project settings and test with your PCVR headset. Verify hand tracking and locomotion." },
                      { label: "Quest Sideloading", desc: "Export as Android APK, enable Developer Mode on your Quest, and sideload via ADB. This is the closest-to-production test." },
                      { label: "WebXR Browser", desc: "Export as HTML5/Web, serve locally, and open in a WebXR-capable browser. Use the Quest browser for on-device testing." },
                    ].map((t, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-black/30 border border-primary/10">
                        <CyberBadge variant="primary">{i + 1}</CyberBadge>
                        <div>
                          <h4 className="font-display text-xs font-bold mb-0.5">{t.label}</h4>
                          <p className="text-muted-foreground font-sans text-xs">{t.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Collapsible>

              <Collapsible title="5. Export Templates">
                <div className="space-y-3">
                  <p className="text-muted-foreground font-sans text-sm">
                    To compile your Godot project for distribution, you need export templates:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`# Install export templates (match your Godot version)
# Editor > Manage Export Templates > Download

# Quest / Android APK:
# 1. Install Android SDK + NDK
# 2. Editor > Export > Add Preset > Android
# 3. Set min SDK to 29 (Quest requirement)
# 4. Enable "Use Gradle Build" for OpenXR
# 5. Export as .apk

# WebXR:
# 1. Editor > Export > Add Preset > Web
# 2. Enable "Progressive Web App"
# 3. Export to folder (index.html + .wasm + .pck)
# 4. Serve with any HTTPS web server

# PCVR (Windows):
# 1. Editor > Export > Add Preset > Windows Desktop
# 2. Export as .exe
# 3. Launch with SteamVR / Oculus runtime active`}
                  />
                </div>
              </Collapsible>
            </div>
          </section>

          <section>
            <SectionHeading id="alternatives">Alternative Platforms</SectionHeading>
            <div className="space-y-6">
              <p className="text-muted-foreground font-sans leading-relaxed">
                While GameDNA is optimized for Godot 4.x, the schema is engine-agnostic. With the right agent
                prompts and tool definitions, you can target other platforms:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: "Unity (XR Interaction Toolkit)",
                    status: "Viable",
                    statusColor: "text-green-400",
                    desc: "Unity's XRI toolkit maps well to GameDNA's player_rig and entity concepts. Agent would generate C# scripts and prefabs instead of GDScript and .tscn files. Strong Quest support through Meta's Unity SDK.",
                    considerations: "Requires Unity license for commercial use. Agent needs C# expertise. Scene format (.unity) is less human-readable than .tscn.",
                  },
                  {
                    title: "Unreal Engine (OpenXR)",
                    status: "Complex",
                    statusColor: "text-yellow-400",
                    desc: "Unreal has excellent VR support but its Blueprint system and C++ are harder for AI agents to generate reliably. Best for teams with existing Unreal expertise.",
                    considerations: "Steep learning curve for agents. Blueprint JSON format is very verbose. Build times are significantly longer. 5% royalty above $1M revenue.",
                  },
                  {
                    title: "A-Frame / Three.js (WebXR)",
                    status: "Web-Only",
                    statusColor: "text-primary",
                    desc: "For browser-only VR experiences, A-Frame or raw Three.js with WebXR API works well. AI agents are excellent at generating HTML/JS. No installation needed for players.",
                    considerations: "Limited to web capabilities. Performance ceiling lower than native. No access to Quest-specific features (passthrough, hand mesh). Best for demos and prototypes.",
                  },
                  {
                    title: "Bevy (Rust)",
                    status: "Experimental",
                    statusColor: "text-accent",
                    desc: "Bevy's ECS architecture is a natural fit for GameDNA's entity_registry. Rust compilation provides excellent performance. OpenXR support is maturing.",
                    considerations: "Ecosystem is still young. Fewer AI training examples for Bevy code. Requires Rust toolchain. VR plugin ecosystem is limited compared to Godot/Unity.",
                  },
                ].map((platform, i) => (
                  <CyberCard key={i}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-sm font-bold">{platform.title}</h3>
                      <CyberBadge variant={platform.statusColor === "text-green-400" ? "primary" : "default"}>
                        <span className={platform.statusColor}>{platform.status}</span>
                      </CyberBadge>
                    </div>
                    <p className="text-muted-foreground font-sans text-xs leading-relaxed mb-3">{platform.desc}</p>
                    <div className="border-t border-primary/10 pt-2">
                      <p className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Considerations</p>
                      <p className="text-muted-foreground/80 font-sans text-xs">{platform.considerations}</p>
                    </div>
                  </CyberCard>
                ))}
              </div>
            </div>
          </section>

          <section>
            <SectionHeading id="community">Community Recipes</SectionHeading>
            <div className="space-y-6">
              <CyberCard>
                <h3 className="text-lg font-display font-bold mb-3 text-secondary">Start From Templates</h3>
                <p className="text-muted-foreground font-sans text-sm leading-relaxed mb-4">
                  The fastest way to get started is to fork an existing template from the community gallery.
                  Each template is a complete GameDNA schema with thematic vibe prompts, entity registries,
                  logic recipes, and level definitions &mdash; ready to customize and export.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { genre: "Escape Room", color: "text-primary" },
                    { genre: "Dungeon Crawler", color: "text-secondary" },
                    { genre: "Exploration", color: "text-accent" },
                    { genre: "Puzzle Room", color: "text-green-400" },
                  ].map((t) => (
                    <div key={t.genre} className="p-3 border border-primary/20 bg-black/30 text-center">
                      <span className={`font-mono text-xs uppercase tracking-wider ${t.color}`}>{t.genre}</span>
                    </div>
                  ))}
                </div>
                <Link href="/schemas">
                  <CyberButton size="sm">
                    <Database className="w-3.5 h-3.5" />
                    Browse Community Templates
                    <ArrowRight className="w-3.5 h-3.5" />
                  </CyberButton>
                </Link>
              </CyberCard>

              <div>
                <h3 className="text-lg font-display font-bold mb-4">Workflow Tips</h3>
                <div className="space-y-3">
                  {[
                    { title: "Fork First, Customize Later", desc: "Start with a genre template that matches your concept. Fork it to your account, then modify the vibe prompt, entities, and logic to fit your vision. This is faster than starting from scratch." },
                    { title: "Iterate on the Schema, Not the Code", desc: "Make changes in the ForgeDNA editor, re-export, and re-run your agent. This is much faster than manually editing Godot files. The schema is your source of truth." },
                    { title: "Version Your Schemas", desc: "ForgeDNA automatically saves version snapshots when you update a schema. Use the History tab to compare versions and restore previous states if something breaks." },
                    { title: "Share What Works", desc: "If you create a great template or discover an effective agent configuration, share it. Make your schema public so others can fork and build on it." },
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-black/30 border border-primary/10">
                      <div className="w-7 h-7 flex items-center justify-center border border-secondary/30 bg-secondary/10 text-secondary font-mono text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="font-display text-sm font-bold mb-0.5">{tip.title}</h4>
                        <p className="text-muted-foreground font-sans text-xs">{tip.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading id="faq">Troubleshooting & FAQ</SectionHeading>
            <div className="space-y-3">
              {[
                {
                  q: "My agent generates Godot 3.x code instead of 4.x. How do I fix this?",
                  a: "Explicitly state \"Godot 4.3+\" in your system prompt and mention specific 4.x features: @export annotations, typed signals, XROrigin3D (not ARVROrigin). Include a brief GDScript 4.x syntax reference in the prompt."
                },
                {
                  q: "The generated project has script errors when I open it in Godot.",
                  a: "This is normal for first-pass generation. Have your agent re-read its own generated files using read_game_dna to catch common issues (missing node references, wrong signal names). Re-run the agent with error messages as context for a second pass."
                },
                {
                  q: "How do I handle entities that reference each other in logic recipes?",
                  a: "Include the full entity_registry in your agent's context when processing logic_recipes. Each recipe should specify target_entity_id so the agent knows which scene to bind scripts to. Cross-entity references use Godot's group system or direct NodePath references."
                },
                {
                  q: "Can I use GameDNA for non-VR games?",
                  a: "The schema is VR-focused (player_rig assumes XR origin, controllers, etc.), but you can strip the XR-specific fields and use the entity_registry, logic_recipes, and levels sections for any 3D game. The environment_config physics are universal."
                },
                {
                  q: "What's the best way to handle large schemas with many entities?",
                  a: "Process entities in batches. Read the entity_registry and group entities by type (grabbable, npc, trigger, static_prop). Generate one type at a time, validating each batch before moving to the next. This prevents context window overflow."
                },
                {
                  q: "How do I deploy a WebXR build from a generated Godot project?",
                  a: "In Godot, add a Web export preset, enable 'Progressive Web App', and export to a folder. Upload the output (index.html, .wasm, .pck files) to any HTTPS-enabled web server. Users can then access your experience from any WebXR browser, including Quest's built-in browser."
                },
                {
                  q: "Is there a reference implementation of the agent pipeline?",
                  a: "ForgeDNA itself includes an AI build system that demonstrates the full pattern: schema reading, tool calling, GDScript generation, and .tscn assembly. Check the platform's architecture for inspiration, then adapt it to your own infrastructure."
                },
              ].map((item, i) => (
                <Collapsible key={i} title={item.q}>
                  <p className="text-muted-foreground font-sans text-sm leading-relaxed">{item.a}</p>
                </Collapsible>
              ))}
            </div>
          </section>

          <div className="border-t border-primary/20 pt-10 mt-10">
            <CyberCard className="text-center">
              <h3 className="text-xl font-display font-bold mb-3 text-glow">Ready to Build?</h3>
              <p className="text-muted-foreground font-sans text-sm mb-6 max-w-lg mx-auto">
                Start by forking a template from the community gallery, export the GameDNA JSON,
                and feed it to your AI agent pipeline. Your VR experience is a schema away.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/schemas">
                  <CyberButton size="md">
                    <Database className="w-4 h-4" />
                    Browse Templates
                  </CyberButton>
                </Link>
                <Link href="/schemas/new">
                  <CyberButton variant="secondary" size="md">
                    <Sparkles className="w-4 h-4" />
                    Create Schema
                  </CyberButton>
                </Link>
              </div>
            </CyberCard>
          </div>
        </div>
      </div>
    </div>
  );
}
