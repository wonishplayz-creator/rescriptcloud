import { useState, useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import Terminal from "@/components/Terminal";
import FileExplorer from "@/components/FileExplorer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Square, Cloud } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Space {
  id: string;
  name: string;
  description: string;
  status: string;
}

export default function SpaceView() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [space, setSpace] = useState<Space | null>(null);
  const [fetching, setFetching] = useState(true);

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

  const toggleStatus = async () => {
    if (!space) return;
    const newStatus = space.status === "running" ? "stopped" : "running";
    await supabase.from("spaces").update({ status: newStatus }).eq("id", space.id);
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
                space.status === "running" ? "bg-success" : space.status === "error" ? "bg-destructive" : "bg-muted-foreground"
              }`}
            />
            <span className="text-xs text-muted-foreground capitalize">{space.status}</span>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant={space.status === "running" ? "destructive" : "default"}
              className={space.status !== "running" ? "bg-gradient-brand hover:opacity-90" : ""}
              onClick={toggleStatus}
            >
              {space.status === "running" ? (
                <><Square className="h-3 w-3 mr-1.5" /> Stop</>
              ) : (
                <><Play className="h-3 w-3 mr-1.5" /> Start</>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="terminal" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 w-fit">
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="flex-1 px-4 pb-4 mt-0">
            <Terminal spaceId={space.id} />
          </TabsContent>
          <TabsContent value="files" className="flex-1 px-4 pb-4 mt-0">
            <FileExplorer spaceId={space.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
