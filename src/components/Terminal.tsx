import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TerminalProps {
  spaceId: string;
}

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

export default function Terminal({ spaceId }: TerminalProps) {
  const { user } = useAuth();
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "ReScript Cloud Terminal — Ubuntu 22.04 LTS" },
    { type: "system", text: "Type commands below. Files are synced to your space." },
    { type: "system", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const executeCommand = async (cmd: string) => {
    if (!user) return;

    setLines((prev) => [...prev, { type: "input", text: `$ ${cmd}` }]);
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInput("");

    // Record the run
    const { data: run, error } = await supabase
      .from("script_runs")
      .insert({ space_id: spaceId, user_id: user.id, command: cmd, status: "running", started_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      setLines((prev) => [...prev, { type: "error", text: `Error: ${error.message}` }]);
      return;
    }

    // Simulate command processing — in production this would call your container backend
    const output = simulateCommand(cmd);

    setLines((prev) => [...prev, ...output.map((text) => ({ type: "output" as const, text }))]);

    // Update the run
    await supabase
      .from("script_runs")
      .update({ output: output.join("\n"), status: "completed", finished_at: new Date().toISOString() })
      .eq("id", run.id);
  };

  const simulateCommand = (cmd: string): string[] => {
    const parts = cmd.trim().split(/\s+/);
    const base = parts[0];

    switch (base) {
      case "help":
        return [
          "Available commands:",
          "  ls         List files in current directory",
          "  cat <file> Show file content",
          "  touch <f>  Create a file",
          "  echo       Print text",
          "  clear      Clear terminal",
          "  pwd        Print working directory",
          "  whoami     Current user",
          "",
          "⚠️  Full Linux execution requires connecting a compute backend.",
          "   Commands are simulated in this demo.",
        ];
      case "clear":
        setLines([]);
        return [];
      case "pwd":
        return [`/home/user/spaces/${spaceId}`];
      case "whoami":
        return ["user"];
      case "ls":
        return ["index.ts  package.json  node_modules/  README.md"];
      case "echo":
        return [parts.slice(1).join(" ")];
      case "cat":
        if (parts[1] === "index.ts") return ['console.log("Hello from ReScript!");'];
        if (parts[1] === "package.json") return ['{ "name": "my-space", "version": "1.0.0" }'];
        return [`cat: ${parts[1] || ""}: No such file or directory`];
      case "touch":
        return parts[1] ? [`Created ${parts[1]}`] : ["touch: missing file operand"];
      case "node":
      case "bun":
      case "npm":
      case "apt":
        return [
          `⚠️  '${base}' requires a connected Linux compute backend.`,
          "   This terminal is in simulation mode.",
          "   Connect a VPS with Docker to enable full command execution.",
        ];
      default:
        return [`bash: ${base}: command not found. Type 'help' for available commands.`];
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      executeCommand(input.trim());
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(idx);
        setInput(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const idx = historyIndex + 1;
        if (idx >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(idx);
          setInput(history[idx]);
        }
      }
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-terminal-bg rounded-lg border border-border/50 overflow-hidden font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-secondary/30">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-destructive/70" />
          <span className="w-3 h-3 rounded-full bg-warning/70" />
          <span className="w-3 h-3 rounded-full bg-success/70" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">terminal — bash</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-0.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap ${
              line.type === "input"
                ? "text-primary"
                : line.type === "error"
                ? "text-destructive"
                : line.type === "system"
                ? "text-muted-foreground"
                : "text-terminal-fg"
            }`}
          >
            {line.text}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <span className="text-primary">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-foreground caret-terminal-cursor"
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
