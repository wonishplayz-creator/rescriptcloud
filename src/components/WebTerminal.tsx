import { useEffect, useRef, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebContainer } from "@webcontainer/api";
import "@xterm/xterm/css/xterm.css";

interface WebTerminalProps {
  webcontainer: WebContainer | null;
  booting: boolean;
}

export default function WebTerminal({ webcontainer, booting }: WebTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: "#0a0e17",
        foreground: "#c8d6e5",
        cursor: "#3b82f6",
        selectionBackground: "#3b82f640",
        black: "#0a0e17",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#c8d6e5",
      },
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln("\x1b[36mReScript Cloud Terminal\x1b[0m");
    term.writeln("\x1b[90mPowered by WebContainers — real Node.js in your browser\x1b[0m");
    term.writeln("");

    if (booting) {
      term.writeln("\x1b[33mBooting WebContainer...\x1b[0m");
    }

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  // Start shell when WebContainer is ready
  useEffect(() => {
    if (!webcontainer || !xtermRef.current || ready) return;

    async function startShell() {
      const term = xtermRef.current!;
      term.writeln("\x1b[32m✓ WebContainer ready\x1b[0m");
      term.writeln("\x1b[90mYou can run: npm install, node index.js, etc.\x1b[0m");
      term.writeln("");

      const shellProcess = await webcontainer!.spawn("jsh", {
        terminal: {
          cols: term.cols,
          rows: term.rows,
        },
      });

      // Pipe shell output to xterm
      shellProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            term.write(data);
          },
        })
      );

      // Pipe xterm input to shell
      const input = shellProcess.input.getWriter();
      term.onData((data) => {
        input.write(data);
      });

      // Handle resize
      term.onResize(({ cols, rows }) => {
        shellProcess.resize({ cols, rows });
      });

      setReady(true);
    }

    startShell().catch((err) => {
      xtermRef.current?.writeln(`\x1b[31mShell error: ${err.message}\x1b[0m`);
    });
  }, [webcontainer, ready]);

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--terminal-bg))] rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-secondary/30 shrink-0">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-destructive/70" />
          <span className="w-3 h-3 rounded-full bg-warning/70" />
          <span className="w-3 h-3 rounded-full bg-success/70" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">
          terminal — {booting ? "booting..." : ready ? "jsh" : "connecting..."}
        </span>
        {booting && (
          <span className="ml-auto text-xs text-warning animate-pulse">⏳ Booting</span>
        )}
        {ready && (
          <span className="ml-auto text-xs text-success">● Live</span>
        )}
      </div>
      <div ref={terminalRef} className="flex-1 p-1" />
    </div>
  );
}
