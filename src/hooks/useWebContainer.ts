import { useState, useEffect, useRef, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";
import { supabase } from "@/integrations/supabase/client";

let _webcontainerInstance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;

type WebContainerCoepMode = "require-corp" | "none";

function formatBootError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("crossOriginIsolated") || message.includes("SharedArrayBuffer")) {
    return new Error(
      "WebContainer failed to start because browser isolation requirements were not met. Try Chrome/Edge, disable strict privacy blockers for this site, and hard refresh once."
    );
  }

  return error instanceof Error ? error : new Error(message);
}

async function bootWithMode(coep: WebContainerCoepMode): Promise<WebContainer> {
  return WebContainer.boot({ coep });
}

async function getWebContainer(): Promise<WebContainer> {
  if (_webcontainerInstance) return _webcontainerInstance;
  if (_bootPromise) return _bootPromise;

  const primaryMode: WebContainerCoepMode =
    typeof window !== "undefined" && window.crossOriginIsolated ? "require-corp" : "none";

  _bootPromise = (async () => {
    try {
      const instance = await bootWithMode(primaryMode);
      _webcontainerInstance = instance;
      return instance;
    } catch (primaryError) {
      // If strict isolation mode fails, fallback to Chromium's non-isolated mode.
      if (primaryMode === "require-corp") {
        const fallbackInstance = await bootWithMode("none");
        _webcontainerInstance = fallbackInstance;
        return fallbackInstance;
      }

      throw formatBootError(primaryError);
    }
  })().catch((error) => {
    _bootPromise = null;
    _webcontainerInstance = null;
    throw formatBootError(error);
  });

  return _bootPromise;
}

interface UseWebContainerOptions {
  spaceId: string;
  userId: string;
}

export function useWebContainer({ spaceId, userId }: UseWebContainerOptions) {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        setBooting(true);
        setError(null);

        const wc = await getWebContainer();
        if (cancelled) return;

        // Load persisted files from database
        const { data: files } = await supabase
          .from("space_files")
          .select("file_path, content, is_directory")
          .eq("space_id", spaceId);

        if (files && files.length > 0) {
          const tree = buildFileTree(files);
          await wc.mount(tree);
        } else {
          // Mount default project structure
          await wc.mount({
            "package.json": {
              file: {
                contents: JSON.stringify(
                  {
                    name: "my-space",
                    version: "1.0.0",
                    scripts: {
                      start: "node index.js",
                    },
                    dependencies: {},
                  },
                  null,
                  2
                ),
              },
            },
            "index.js": {
              file: {
                contents: 'console.log("Hello from ReScript!");\n',
              },
            },
          });
        }

        // Auto-install dependencies if package.json has any
        try {
          const pkgJson = await wc.fs.readFile("/package.json", "utf-8");
          const pkg = JSON.parse(pkgJson);
          if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
            console.log("[WebContainer] Auto-installing dependencies...");
            const installProcess = await wc.spawn("npm", ["install"]);
            await installProcess.exit;
            console.log("[WebContainer] Dependencies installed.");
          }
        } catch {
          // No package.json or parse error, skip
        }

        mountedRef.current = true;
        setInstance(wc);
      } catch (err: any) {
        if (!cancelled) {
          console.error("WebContainer boot error:", err);
          setError(err.message || "Failed to boot WebContainer");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const persistFiles = useCallback(async () => {
    if (!instance) return;

    try {
      // Read all files from WebContainer
      const files = await readDirRecursive(instance, "/");

      // Delete existing files for this space
      await supabase.from("space_files").delete().eq("space_id", spaceId);

      // Insert all current files
      if (files.length > 0) {
        const rows = files.map((f) => ({
          space_id: spaceId,
          user_id: userId,
          file_path: f.path,
          content: f.content || "",
          is_directory: f.isDirectory,
        }));

        await supabase.from("space_files").insert(rows);
      }
    } catch (err) {
      console.error("Error persisting files:", err);
    }
  }, [instance, spaceId, userId]);

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!instance) return;
      await instance.fs.writeFile(path, content);
    },
    [instance]
  );

  const readFile = useCallback(
    async (path: string): Promise<string> => {
      if (!instance) return "";
      return await instance.fs.readFile(path, "utf-8");
    },
    [instance]
  );

  const listFiles = useCallback(
    async (dir: string = "/"): Promise<{ name: string; isDirectory: boolean }[]> => {
      if (!instance) return [];
      try {
        const entries = await instance.fs.readdir(dir, { withFileTypes: true });
        return entries
          .filter((e) => e.name !== "node_modules" && e.name !== ".npm")
          .map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory(),
          }));
      } catch {
        return [];
      }
    },
    [instance]
  );

  const deleteFile = useCallback(
    async (path: string) => {
      if (!instance) return;
      await instance.fs.rm(path, { recursive: true });
    },
    [instance]
  );

  const mkdir = useCallback(
    async (path: string) => {
      if (!instance) return;
      await instance.fs.mkdir(path, { recursive: true });
    },
    [instance]
  );

  return {
    instance,
    booting,
    error,
    writeFile,
    readFile,
    listFiles,
    deleteFile,
    mkdir,
    persistFiles,
  };
}

function buildFileTree(
  files: { file_path: string; content: string | null; is_directory: boolean | null }[]
): Record<string, any> {
  const tree: Record<string, any> = {};

  // Sort so directories come first
  const sorted = [...files].sort((a, b) => {
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    return a.file_path.localeCompare(b.file_path);
  });

  for (const f of sorted) {
    const parts = f.file_path.replace(/^\//, "").split("/");
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        if (f.is_directory) {
          current[part] = { directory: current[part]?.directory || {} };
        } else {
          current[part] = { file: { contents: f.content || "" } };
        }
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    }
  }

  return tree;
}

async function readDirRecursive(
  wc: WebContainer,
  dir: string
): Promise<{ path: string; content: string | null; isDirectory: boolean }[]> {
  const results: { path: string; content: string | null; isDirectory: boolean }[] = [];

  try {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules and hidden dirs
      if (entry.name === "node_modules" || entry.name === ".npm" || entry.name === ".cache") continue;

      const fullPath = dir === "/" ? `/${entry.name}` : `${dir}/${entry.name}`;

      if (entry.isDirectory()) {
        results.push({ path: fullPath, content: null, isDirectory: true });
        const subResults = await readDirRecursive(wc, fullPath);
        results.push(...subResults);
      } else {
        try {
          const content = await wc.fs.readFile(fullPath, "utf-8");
          results.push({ path: fullPath, content, isDirectory: false });
        } catch {
          results.push({ path: fullPath, content: "", isDirectory: false });
        }
      }
    }
  } catch {
    // ignore read errors
  }

  return results;
}
