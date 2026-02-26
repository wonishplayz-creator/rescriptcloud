import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { File, Folder, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface FileExplorerProps {
  spaceId: string;
}

interface SpaceFile {
  id: string;
  file_path: string;
  content: string;
  is_directory: boolean;
}

export default function FileExplorer({ spaceId }: FileExplorerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<SpaceFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, [spaceId]);

  const fetchFiles = async () => {
    const { data } = await supabase
      .from("space_files")
      .select("*")
      .eq("space_id", spaceId)
      .order("file_path");
    if (data) setFiles(data as SpaceFile[]);
  };

  const createFile = async () => {
    if (!newFileName.trim() || !user) return;
    const { error } = await supabase.from("space_files").insert({
      space_id: spaceId,
      user_id: user.id,
      file_path: newFileName.trim(),
      content: "",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewFileName("");
      setShowNewFile(false);
      fetchFiles();
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    const { error } = await supabase
      .from("space_files")
      .update({ content: editContent })
      .eq("id", selectedFile.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved" });
      fetchFiles();
    }
  };

  const deleteFile = async (id: string) => {
    await supabase.from("space_files").delete().eq("id", id);
    if (selectedFile?.id === id) {
      setSelectedFile(null);
      setEditContent("");
    }
    fetchFiles();
  };

  const selectFile = (f: SpaceFile) => {
    setSelectedFile(f);
    setEditContent(f.content);
  };

  return (
    <div className="h-full flex border border-border/50 rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className="w-56 border-r border-border/50 flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Files</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewFile(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showNewFile && (
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ts"
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === "Enter" && createFile()}
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowNewFile(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-1">
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No files yet</p>
          )}
          {files.map((f) => (
            <div
              key={f.id}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer group hover:bg-secondary/50 ${
                selectedFile?.id === f.id ? "bg-secondary text-foreground" : "text-muted-foreground"
              }`}
              onClick={() => selectFile(f)}
            >
              {f.is_directory ? <Folder className="h-3.5 w-3.5 text-primary" /> : <File className="h-3.5 w-3.5" />}
              <span className="truncate flex-1 text-xs">{f.file_path}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFile(f.id);
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
              <span className="text-sm font-mono text-muted-foreground">{selectedFile.file_path}</span>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={saveFile}>
                <Save className="h-3 w-3" /> Save
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
