import { useState, useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import WebTerminal from "@/components/WebTerminal";
import WebFileExplorer from "@/components/WebFileExplorer";
import { useWebContainer } from "@/hooks/useWebContainer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Cloud, Download, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Space {
  id: string;
  name: string;
  description: string;
  status: string;
  is_public: boolean;
  subdomain: string | null;
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

  // Publishing state
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [subdomain, setSubdomain] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (space?.subdomain) setSubdomain(space.subdomain);
  }, [space]);

  const handlePublish = async () => {
    if (!subdomain.trim() || !id) return;
    const slug = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setPublishing(true);
    if (instance) await persistFiles();

    const { error } = await supabase
      .from("spaces")
      .update({ is_public: true, subdomain: slug })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Published!", description: `Available at /spaces/public/${slug}` });
      setPublishDialogOpen(false);
      fetchSpace();
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!id) return;
    await supabase.from("spaces").update({ is_public: false }).eq("id", id);
    toast({ title: "Unpublished", description: "Space is now private." });
    fetchSpace();
  };

  const hasIsolationIssue = !!wcError && /crossoriginisolated|sharedarraybuffer|isolation/i.test(wcError);

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
              {booting ? "Booting WebContainer..." : instance ? "WebContainer Running" : wcError ? "WebContainer unavailable" : "Offline"}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            {space.is_public ? (
              <>
                <Link to={`/spaces/public/${space.subdomain}`} target="_blank">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Globe className="h-3 w-3" /> View Public
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={handleUnpublish}>
                  Unpublish
                </Button>
              </>
            ) : (
              <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Globe className="h-3 w-3" /> Publish
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Publish Space</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Subdomain</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={subdomain}
                          onChange={(e) => setSubdomain(e.target.value)}
                          placeholder="my-project"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Will be accessible at /spaces/public/{subdomain || "my-project"}
                      </p>
                    </div>
                    <Button
                      className="w-full bg-gradient-brand hover:opacity-90"
                      onClick={handlePublish}
                      disabled={publishing || !subdomain.trim()}
                    >
                      {publishing ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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

        {hasIsolationIssue && (
          <div className="mx-4 mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
            WebContainer couldn't start due to browser isolation requirements. Try Chrome/Edge, disable strict privacy blockers for this site, then hard refresh.
          </div>
        )}

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
