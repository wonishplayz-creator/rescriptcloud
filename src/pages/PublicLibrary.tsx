import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Globe, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface PublicSpace {
  id: string;
  name: string;
  description: string;
  subdomain: string;
  updated_at: string;
}

export default function PublicLibrary() {
  const [spaces, setSpaces] = useState<PublicSpace[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicSpaces();
  }, []);

  const fetchPublicSpaces = async () => {
    const { data } = await supabase
      .from("spaces")
      .select("id, name, description, subdomain, updated_at")
      .eq("is_public", true)
      .not("subdomain", "is", null)
      .order("updated_at", { ascending: false });
    if (data) setSpaces(data as PublicSpace[]);
    setLoading(false);
  };

  const filtered = spaces.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase()) ||
      s.subdomain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border/50 flex items-center px-4 gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-brand">
            <Cloud className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-gradient">ReScript</span>
        </Link>
        <nav className="flex items-center gap-1 ml-6">
          <Link to="/library">
            <Button variant="secondary" size="sm" className="gap-2">
              <Globe className="h-4 w-4" /> Library
            </Button>
          </Link>
        </nav>
        <div className="ml-auto">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Public Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore publicly shared spaces from the community
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search public spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Globe className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {spaces.length === 0 ? "No public spaces yet." : "No matching spaces."}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((space) => (
              <motion.div key={space.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Link to={`/spaces/public/${space.subdomain}`}>
                  <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-secondary">
                          <Cloud className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{space.name}</h3>
                          <p className="text-xs text-muted-foreground">{space.subdomain}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {space.description || "No description"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3">
                        Updated {new Date(space.updated_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
