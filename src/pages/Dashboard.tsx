import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import SpaceCard from "@/components/SpaceCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Cloud, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type SpaceStatus = "running" | "starting" | "stopped" | "error";

interface Space {
  id: string;
  name: string;
  description: string;
  status: SpaceStatus;
  updated_at: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchSpaces();

    const channel = supabase
      .channel("spaces-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () => {
        fetchSpaces();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchSpaces = async () => {
    const { data } = await supabase
      .from("spaces")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setSpaces(data as Space[]);
  };

  const createSpace = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("spaces").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      setNewDesc("");
      setDialogOpen(false);
      fetchSpaces();
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: SpaceStatus) => {
    await supabase.from("spaces").update({ status }).eq("id", id);
    fetchSpaces();
  };

  const deleteSpace = async (id: string) => {
    await supabase.from("spaces").delete().eq("id", id);
    fetchSpaces();
  };

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const filtered = spaces.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Your Spaces</h1>
            <p className="text-sm text-muted-foreground mt-1">Cloud environments that run forever</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-brand hover:opacity-90 gap-2">
                <Plus className="h-4 w-4" /> New Space
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Space</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my-project" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="A cool project" />
                </div>
                <Button className="w-full bg-gradient-brand hover:opacity-90" onClick={createSpace} disabled={creating}>
                  {creating ? "Creating..." : "Create Space"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Cloud className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {spaces.length === 0 ? "No spaces yet. Create your first one!" : "No matching spaces."}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                name={space.name}
                description={space.description}
                status={space.status}
                updatedAt={space.updated_at}
                onStart={() => updateStatus(space.id, "running")}
                onStop={() => updateStatus(space.id, "stopped")}
                onDelete={() => deleteSpace(space.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
