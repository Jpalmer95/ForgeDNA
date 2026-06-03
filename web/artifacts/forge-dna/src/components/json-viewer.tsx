import { cn } from "@/lib/utils";

interface JsonViewerProps {
  data: unknown;
  className?: string;
}

export function JsonViewer({ data, className }: JsonViewerProps) {
  const formatJson = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  const highlightJson = (jsonStr: string) => {
    // A simple regex replacer to add basic span coloring for JSON
    let result = jsonStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    result = result.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'text-accent'; // numbers
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-primary font-bold'; // keys
        } else {
          cls = 'text-foreground/80'; // strings
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-secondary'; // booleans
      } else if (/null/.test(match)) {
        cls = 'text-muted-foreground'; // nulls
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
    return result;
  };

  return (
    <div className={cn("relative group font-mono text-sm", className)}>
      <div className="absolute top-0 left-0 right-0 h-8 bg-card border-b border-primary/20 flex items-center px-4 rounded-t-sm">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive/80" />
          <div className="w-2 h-2 rounded-full bg-secondary/80" />
          <div className="w-2 h-2 rounded-full bg-primary/80" />
        </div>
        <span className="ml-4 text-xs text-muted-foreground tracking-widest">DATA_PAYLOAD.json</span>
      </div>
      <pre 
        className="pt-10 pb-4 px-4 bg-black/60 border border-primary/20 overflow-x-auto rounded-sm backdrop-blur-md"
        dangerouslySetInnerHTML={{ __html: highlightJson(formatJson(data)) }}
      />
    </div>
  );
}
