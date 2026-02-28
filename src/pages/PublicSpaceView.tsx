import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, ArrowLeft, FileText, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PublicSpace {
  id: string;
  name: string;
  description: string;
  subdomain: string;
}

interface SpaceFile {
  file_path: string;
  content: string | null;
  is_directory: boolean;
}

export default function PublicSpaceView() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [space, setSpace] = useState<PublicSpace | null>(null);
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<SpaceFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!subdomain) return;
    fetchPublicSpace();
  }, [subdomain]);

  const fetchPublicSpace = async () => {
    const { data: spaceData } = await supabase
      .from("spaces")
      .select("id, name, description, subdomain")
      .eq("subdomain", subdomain)
      .eq("is_public", true)
      .single();

    if (!spaceData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSpace(spaceData as PublicSpace);

    const { data: filesData } = await supabase
      .from("space_files")
      .select("file_path, content, is_directory")
      .eq("space_id", spaceData.id)
      .order("file_path");

    if (filesData) setFiles(filesData as SpaceFile[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">Space not found or not public.</p>
        <Link to="/library">
          <Button variant="secondary">Back to Library</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border/50 flex items-center px-4 gap-4">
        <Link to="/library">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{space?.name}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{space?.subdomain}</span>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* File tree */}
        <div className="w-64 border-r border-border/50 overflow-y-auto p-3">
          <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase">Files</p>
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files</p>
          ) : (
            <div className="space-y-0.5">
              {files.map((f) => (
                <button
                  key={f.file_path}
                  onClick={() => !f.is_directory && setSelectedFile(f)}
                  className={`w-full text-left text-sm px-2 py-1 rounded flex items-center gap-2 transition-colors ${
                    selectedFile?.file_path === f.file_path
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  } ${f.is_directory ? "cursor-default" : "cursor-pointer"}`}
                >
                  {f.is_directory ? (
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{f.file_path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* File content */}
        <div className="flex-1 overflow-auto p-4">
          {selectedFile ? (
            <div>
              <p className="text-sm font-semibold mb-2 text-muted-foreground">{selectedFile.file_path}</p>
              <pre className="bg-[hsl(var(--terminal-bg))] rounded-lg p-4 text-sm font-mono text-[hsl(var(--terminal-fg))] overflow-x-auto whitespace-pre-wrap">
                {selectedFile.content || "(empty)"}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Select a file to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
