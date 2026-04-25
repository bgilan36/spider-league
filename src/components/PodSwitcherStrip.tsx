import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import PodThumbnail from "@/components/PodThumbnail";

export interface PodSwitcherItem {
  id: string;
  name: string;
  image_url?: string | null;
  member_count: number;
}

interface PodSwitcherStripProps {
  pods: PodSwitcherItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  createSlot?: ReactNode;
}

const PodSwitcherStrip = ({ pods, selectedId, onSelect, createSlot }: PodSwitcherStripProps) => {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {pods.map((pod) => {
        const active = pod.id === selectedId;
        return (
          <button
            key={pod.id}
            type="button"
            onClick={() => onSelect(pod.id)}
            className={cn(
              "flex min-w-[180px] shrink-0 items-center gap-3 rounded-lg border p-3 text-left transition",
              active
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5",
            )}
            aria-pressed={active}
          >
            <PodThumbnail imageUrl={pod.image_url} podName={pod.name} className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{pod.name}</div>
              <div className="text-xs text-muted-foreground">
                {pod.member_count} {pod.member_count === 1 ? "member" : "members"}
              </div>
            </div>
          </button>
        );
      })}
      {createSlot ?? (
        <div className="flex min-w-[160px] shrink-0 items-center gap-3 rounded-lg border border-dashed border-border p-3 text-muted-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border">
            <Plus className="h-4 w-4" />
          </div>
          <div className="text-sm font-medium">New pod</div>
        </div>
      )}
    </div>
  );
};

export default PodSwitcherStrip;