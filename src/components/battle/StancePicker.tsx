import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  ATTACK_STANCES, DEFENSE_STANCES,
  type AttackStance, type DefenseStance,
} from "@/lib/battle/stances";

interface StancePickerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (picks: { attack: AttackStance; defense: DefenseStance }) => Promise<void> | void;
  onAutoResolve?: () => Promise<void> | void;
  loading?: boolean;
  title?: string;
  subtitle?: string;
}

export default function StancePicker({
  open, onOpenChange, onConfirm, onAutoResolve, loading, title, subtitle,
}: StancePickerProps) {
  const [attack, setAttack] = useState<AttackStance>("power_strike");
  const [defense, setDefense] = useState<DefenseStance>("iron_web");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Pick your battle stances"}</DialogTitle>
          <DialogDescription>
            {subtitle || "Each stance is a tradeoff. Smart picks plus good timing can beat a stronger opponent."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Attack stance</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {ATTACK_STANCES.map((s) => {
                const Icon = s.icon;
                const active = attack === s.id;
                return (
                  <Card key={s.id}
                    onClick={() => setAttack(s.id as AttackStance)}
                    className={cn(
                      "p-3 cursor-pointer transition border-2",
                      active ? "border-primary bg-primary/10" : "border-transparent hover:border-border",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" />
                      <div className="font-semibold text-sm">{s.label}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.tagline}</div>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Defense stance</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {DEFENSE_STANCES.map((s) => {
                const Icon = s.icon;
                const active = defense === s.id;
                return (
                  <Card key={s.id}
                    onClick={() => setDefense(s.id as DefenseStance)}
                    className={cn(
                      "p-3 cursor-pointer transition border-2",
                      active ? "border-primary bg-primary/10" : "border-transparent hover:border-border",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" />
                      <div className="font-semibold text-sm">{s.label}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.tagline}</div>
                  </Card>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2">
            {onAutoResolve ? (
              <Button variant="ghost" onClick={() => onAutoResolve()} disabled={loading}>
                Skip — auto-resolve
              </Button>
            ) : <span />}
            <Button onClick={() => onConfirm({ attack, defense })} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Starting…</> : "Enter battle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
