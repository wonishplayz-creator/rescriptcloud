import { useState, useEffect, useCallback } from "react";
import { File, Folder, FolderOpen, Plus, Save, Trash2, X, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface WebFileExplorerProps {
  listFiles: (dir?: string) => Promise<{ name: string; isDirectory: boolean }[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  persistFiles: () => Promise<void>;
  ready: boolean;
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
  expanded?: boolean;
}

export default function WebFileExplorer({
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  mkdir,
  persistFiles,
  ready,
}: WebFileExplorerProps) {
  const { toast } = useToast();
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [showNewItem, setShowNewItem] = useState(false);
  const [newItemIsDir, setNewItemIsDir] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshTree = useCallback(async () => {
    if (!ready) return;
    const entries = await listFiles("/");
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    setTree(
      sorted.map((e) => ({
        name: e.name,
        path: `/${e.name}`,
        isDirectory: e.isDirectory,
      }))
    );
  }, [listFiles, ready]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  const openFile = async (path: string) => {
    try {
      const content = await readFile(path);
      setSelectedFile(path);
      setEditContent(content);
      setOriginalContent(content);
    } catch (err: any) {
      toast({ title: "Error reading file", description: err.message, variant: "destructive" });
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await writeFile(selectedFile, editContent);
      setOriginalContent(editContent);
      toast({ title: "Saved" });
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newItemName.trim()) return;
    const path = `/${newItemName.trim()}`;
    try {
      if (newItemIsDir) {
        await mkdir(path);
      } else {
        await writeFile(path, "");
      }
      setNewItemName("");
      setShowNewItem(false);
      await refreshTree();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (path: string) => {
    try {
      await deleteFile(path);
      if (selectedFile === path) {
        setSelectedFile(null);
        setEditContent("");
      }
      await refreshTree();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePersist = async () => {
    try {
      await persistFiles();
      toast({ title: "Files saved to cloud", description: "Your files are persisted and will be restored next time." });
    } catch (err: any) {
      toast({ title: "Error persisting", description: err.message, variant: "destructive" });
    }
  };

  const isDirty = editContent !== originalContent;

  return (
    <div className="h-full flex border border-border/50 rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-56 border-r border-border/50 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Files</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={refreshTree} title="Refresh">
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handlePersist} title="Save to cloud">
              <Download className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setShowNewItem(true); setNewItemIsDir(false); }}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {showNewItem && (
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={newItemIsDir ? "dirname" : "filename.js"}
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setNewItemIsDir(!newItemIsDir)}
              title={newItemIsDir ? "Creating folder" : "Creating file"}
            >
              {newItemIsDir ? <Folder className="h-3 w-3 text-primary" /> : <File className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewItem(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {!ready && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center animate-pulse">Booting...</p>
          )}
          {ready && tree.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No files yet</p>
          )}
          {tree.map((entry) => (
            <div
              key={entry.path}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer group hover:bg-secondary/50 ${
                selectedFile === entry.path ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
              onClick={() => !entry.isDirectory && openFile(entry.path)}
            >
              {entry.isDirectory ? (
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
              ) : (
                <File className="h-3.5 w-3.5" />
              )}
              <span className="truncate flex-1 text-xs">{entry.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(entry.path);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
              <span className="text-sm font-mono text-muted-foreground">
                {selectedFile}
                {isDirty && <span className="text-warning ml-2">●</span>}
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={saveFile}
                disabled={saving || !isDirty}
              >
                <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 p-4 bg-transparent font-mono text-sm text-foreground resize-none outline-none"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  );
}
