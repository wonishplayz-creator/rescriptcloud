import { Cloud, Play, Square, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface SpaceCardProps {
  id: string;
  name: string;
  description: string;
  status: string;
  updatedAt: string;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: "bg-success", label: "Running" },
  starting: { color: "bg-warning", label: "Starting" },
  stopped: { color: "bg-muted-foreground", label: "Stopped" },
  error: { color: "bg-destructive", label: "Error" },
};

export default function SpaceCard({ id, name, description, status, updatedAt, onStart, onStop, onDelete }: SpaceCardProps) {
  const s = statusConfig[status] ?? statusConfig.stopped;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="border-border/50 hover:border-primary/30 transition-colors group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <Link to={`/space/${id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-secondary">
                <Cloud className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{description || "No description"}</p>
              </div>
            </Link>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              Updated {new Date(updatedAt).toLocaleDateString()}
            </span>
            <div className="flex gap-1.5">
              {status === "stopped" || status === "error" ? (
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={onStart}>
                  <Play className="h-3 w-3" /> Start
                </Button>
              ) : (
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={onStop}>
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
