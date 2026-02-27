import { useState, useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import WebTerminal from "@/components/WebTerminal";
import WebFileExplorer from "@/components/WebFileExplorer";
import { useWebContainer } from "@/hooks/useWebContainer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cloud, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Space {
  id: string;
  name: string;
  description: string;
  status: string;
}

export default function SpaceView() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [space, setSpace] = useState<Space | null>(null);
  const [fetching, setFetching] = useState(true);

  const {
    instance,
    booting,
    error: wcError,
    writeFile,
    readFile,
    listFiles,
    deleteFile,
    mkdir,
    persistFiles,
  } = useWebContainer({
    spaceId: id || "",
    userId: user?.id || "",
  });

  useEffect(() => {
    if (!id || !user) return;
    fetchSpace();

    const channel = supabase
      .channel(`space-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "spaces", filter: `id=eq.${id}` }, () => {
        fetchSpace();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  const fetchSpace = async () => {
    const { data } = await supabase.from("spaces").select("*").eq("id", id).single();
    if (data) setSpace(data as Space);
    setFetching(false);
  };

  // Auto-persist files on unmount
  useEffect(() => {
    return () => {
      if (instance) {
        persistFiles();
      }
    };
  }, [instance, persistFiles]);

  const handlePersistAndNotify = async () => {
    await persistFiles();
    toast({ title: "Files saved", description: "All files persisted to cloud storage." });
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (fetching) return <DashboardLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!space) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border/50 shrink-0">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{space.name}</h2>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span
              className={`w-2 h-2 rounded-full ${
                booting ? "bg-warning animate-pulse" : instance ? "bg-success" : "bg-muted-foreground"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {booting ? "Booting WebContainer..." : instance ? "WebContainer Running" : wcError || "Offline"}
            </span>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={handlePersistAndNotify}
              disabled={!instance}
            >
              <Download className="h-3 w-3" /> Save to Cloud
            </Button>
          </div>
        </div>

        <Tabs defaultValue="terminal" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="flex-1 px-4 pb-4 mt-0">
            <WebTerminal webcontainer={instance} booting={booting} />
          </TabsContent>
          <TabsContent value="files" className="flex-1 px-4 pb-4 mt-0">
            <WebFileExplorer
              listFiles={listFiles}
              readFile={readFile}
              writeFile={writeFile}
              deleteFile={deleteFile}
              mkdir={mkdir}
              persistFiles={persistFiles}
              ready={!!instance && !booting}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
