import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  Box, 
  Cpu, 
  Globe, 
  Glasses, 
  Layers, 
  Mic2, 
  Terminal,
  ArrowRight
} from "lucide-react";
import { CyberButton, CyberCard } from "@/components/cyber-ui";

const PILLARS = [
  {
    title: "Environment Config",
    icon: Globe,
    description: "Define the physical space: gravity vectors, skybox procedural generation, ambient lighting, and terrain meshes.",
    color: "text-primary"
  },
  {
    title: "Player Rig",
    icon: Glasses,
    description: "Construct the VR user: locomotion parameters, hand tracking rules, height offsets, and collision capsules.",
    color: "text-secondary"
  },
  {
    title: "Entity Registry",
    icon: Box,
    description: "Populate the world: grabbable items with physics properties, dynamic props, and autonomous NPCs.",
    color: "text-accent"
  },
  {
    title: "Logic Recipes",
    icon: Cpu,
    description: "Wire the mechanics: nested behavior trees, conditional crafting systems, and event-driven trigger volumes.",
    color: "text-primary"
  },
  {
    title: "Level Architecture",
    icon: Layers,
    description: "Structure the progression: distinct zones, dynamic layouts, objective sequences, and win/loss conditions.",
    color: "text-secondary"
  },
  {
    title: "Audio Framework",
    icon: Mic2,
    description: "Set the soundscape: generative background music prompts and mapped spatial sound effect libraries.",
    color: "text-accent"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function Home() {
  return (
    <div className="pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center overflow-hidden mb-20 -mt-8 pt-8">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-background/80 z-10" />
          <img 
            src={`${import.meta.env.BASE_URL}images/cyber-grid.png`} 
            alt="Cyber Grid" 
            className="w-full h-full object-cover opacity-60 mix-blend-screen"
          />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-20" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-30 max-w-4xl px-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-primary/50 bg-primary/10 text-primary text-xs font-mono tracking-widest uppercase clip-edges">
            <Terminal className="w-3 h-3" />
            System Online // Engine Ready
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 tracking-tight">
            <span className="text-foreground">DEFINE YOUR</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent animate-pulse">
              VR REALITY
            </span>
            <br />
            <span className="text-foreground text-glow text-3xl md:text-5xl">IN PLAIN TEXT.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground font-sans max-w-2xl mx-auto mb-10">
            ForgeDNA is the master schema for virtual worlds. Write your mechanics, rules, and logic as lightweight JSON. Let AI agents compile it instantly into Godot.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/schemas">
              <CyberButton size="lg" className="w-full sm:w-auto text-lg px-8">
                Initialize Databanks
                <ArrowRight className="w-5 h-5 ml-2" />
              </CyberButton>
            </Link>
            <Link href="/guide">
              <CyberButton variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8">
                Build Guide
                <ArrowRight className="w-5 h-5 ml-2" />
              </CyberButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Pillars Section */}
      <section className="relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-display font-bold text-glow mb-4">THE SIX PILLARS OF GAMEDNA</h2>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-transparent mx-auto" />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {PILLARS.map((pillar, i) => (
            <motion.div key={i} variants={itemVariants}>
              <CyberCard className="h-full flex flex-col">
                <div className={`p-3 rounded bg-background inline-block w-fit mb-4 border border-border shadow-lg ${pillar.color}`}>
                  <pillar.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold mb-3">{pillar.title}</h3>
                <p className="text-muted-foreground font-sans leading-relaxed flex-1">
                  {pillar.description}
                </p>
                <div className="mt-6 font-mono text-xs text-primary/60 uppercase tracking-widest border-t border-primary/10 pt-4">
                  // Data.Node_Ready
                </div>
              </CyberCard>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
