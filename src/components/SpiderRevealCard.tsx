import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Sword, Plus, Loader2, ShieldAlert, Heart, Pencil, Check, X, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PowerScoreArc from "@/components/PowerScoreArc";
import { Progress } from "@/components/ui/progress";
import ShareButton from "@/components/ShareButton";
import { generateSpiderShareImage } from "@/lib/spiderShareImage";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { useConfetti } from "@/hooks/useConfetti";
import RarityDistributionTooltip from "@/components/RarityDistributionTooltip";

interface Stats {
  hit_points: number;
  damage: number;
  speed: number;
  defense: number;
  venom: number;
  webcraft: number;
  power_score: number;
  rarity: string;
}

interface SafetyInfo {
  isUSNative: boolean;
  harmfulToHumans: string;
  dangerLevel: string;
  specialAbilities: string[];
}

interface Candidate {
  species: string;
  confidence: number;
  rank: number;
  reasoning?: string;
  isUSNative?: boolean;
  harmfulToHumans?: string;
  specialAbilities?: string[];
}

interface SpiderRevealCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  nickname: string;
  species: string;
  onNicknameChange?: (next: string) => void;
  stats: Stats;
  safety: SafetyInfo | null;
  uploading: boolean;
  onAddToStarting5: () => Promise<void> | void;
  onBattleNow: () => Promise<void> | void;
  candidates?: Candidate[];
  onSelectCandidate?: (species: string) => void;
  locationName?: string;
  hasLocation?: boolean;
  locationLoading?: boolean;
  citySearchLoading?: boolean;
  onLocationNameChange?: (next: string) => void;
  onUseMyLocation?: () => void;
  onSearchCity?: (query: string) => void;
  onClearLocation?: () => void;
  pendingSpecies?: string | null;
  pendingNickname?: string | null;
  pendingStats?: Stats | null;
  pendingSafety?: SafetyInfo | null;
  onConfirmSpecies?: () => void;
  onCancelPreview?: () => void;
}

const STAT_META: Record<string, { label: string; icon: string }> = {
  hit_points: { label: "Hit Points", icon: "❤️" },
  damage: { label: "Damage", icon: "⚔️" },
  speed: { label: "Speed", icon: "💨" },
  defense: { label: "Defense", icon: "🛡️" },
  venom: { label: "Venom", icon: "☠️" },
  webcraft: { label: "Webcraft", icon: "🕸️" },
};

const rarityClasses = (r: string) => {
  switch (r) {
    case "LEGENDARY":
      return "from-amber-500/30 via-yellow-400/20 to-orange-500/30 border-amber-400/50";
    case "EPIC":
      return "from-purple-500/30 via-fuchsia-500/20 to-purple-600/30 border-purple-400/50";
    case "RARE":
      return "from-blue-500/30 via-cyan-400/20 to-blue-600/30 border-blue-400/50";
    case "UNCOMMON":
      return "from-emerald-500/30 via-green-400/20 to-emerald-600/30 border-emerald-400/50";
    default:
      return "from-muted/40 via-muted/20 to-muted/40 border-border";
  }
};

const rarityBadge = (r: string) => {
  switch (r) {
    case "LEGENDARY":
      return "bg-gradient-to-r from-amber-500 to-orange-500 text-white";
    case "EPIC":
      return "bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white";
    case "RARE":
      return "bg-gradient-to-r from-blue-500 to-cyan-500 text-white";
    case "UNCOMMON":
      return "bg-gradient-to-r from-emerald-500 to-green-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const SpiderRevealCard = ({
  open,
  onOpenChange,
  previewUrl,
  nickname,
  species,
  onNicknameChange,
  stats,
  safety,
  uploading,
  onAddToStarting5,
  onBattleNow,
  candidates,
  onSelectCandidate,
  locationName,
  hasLocation,
  locationLoading,
  citySearchLoading,
  onLocationNameChange,
  onUseMyLocation,
  onSearchCity,
  onClearLocation,
  pendingSpecies,
  pendingNickname,
  pendingStats,
  pendingSafety,
  onConfirmSpecies,
  onCancelPreview,
}: SpiderRevealCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fireConfetti } = useConfetti();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(nickname);
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);

  const isPreviewing = !!pendingSpecies && pendingSpecies !== species;
  const displaySpecies = pendingSpecies ?? species;
  const displayNickname = pendingNickname ?? nickname;
  const displayStats = pendingStats ?? stats;
  const displaySafety = pendingSafety ?? safety;

  const isLegendary = displayStats.rarity === "LEGENDARY";
  const isEpicPlus = isLegendary || displayStats.rarity === "EPIC";

  useEffect(() => {
    if (open && stats.rarity === "LEGENDARY") {
      // Fanfare: badge burst + sustained victory rain
      fireConfetti("badge");
      setTimeout(() => fireConfetti("victory"), 200);
    }
  }, [open, stats.rarity, fireConfetti]);

  useEffect(() => {
    if (isPreviewing && editing) {
      setEditing(false);
    }
  }, [isPreviewing, editing]);

  const startEdit = () => {
    setDraft(nickname);
    setEditing(true);
  };
  const saveEdit = () => {
    const next = draft.trim();
    if (next && onNicknameChange) onNicknameChange(next);
    setEditing(false);
  };
  const cancelEdit = () => {
    setDraft(nickname);
    setEditing(false);
  };

  const strongest = useMemo(() => {
    const entries = Object.entries(STAT_META).map(([k, meta]) => ({
      key: k,
      label: meta.label,
      icon: meta.icon,
      value: (displayStats as any)[k] as number,
    }));
    return entries.reduce((best, cur) => (cur.value > best.value ? cur : best), entries[0]);
  }, [displayStats]);

  const statEntries = useMemo(
    () =>
      Object.entries(STAT_META).map(([k, meta]) => ({
        key: k,
        label: meta.label,
        icon: meta.icon,
        value: (displayStats as any)[k] as number,
      })),
    [displayStats],
  );
  const maxStat = useMemo(
    () => Math.max(100, ...statEntries.map((s) => s.value)),
    [statEntries],
  );

  const harmful = (displaySafety?.harmfulToHumans || "").toLowerCase().startsWith("yes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none ${
          isLegendary ? "sm:max-w-lg" : ""
        }`}
      >
        {isLegendary && (
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-orange-500/20 blur-3xl" />
          </div>
        )}
        <div
          className={`relative rounded-2xl border-2 bg-gradient-to-br ${
            isLegendary ? "rarity-legendary-glow" : ""
          } ${rarityClasses(
            displayStats.rarity,
          )} p-[2px] animate-scale-in`}
        >
          <div className="rounded-[14px] bg-card/95 backdrop-blur-xl p-5 space-y-4">
            {/* Header */}
            <div
              className={`flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase ${
                isLegendary ? "text-amber-500 animate-pulse" : "text-primary"
              }`}
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
              {isLegendary ? "🚨 LEGENDARY Fighter Revealed 🚨" : "New Fighter Revealed"}
              <Sparkles className="h-4 w-4 animate-pulse" />
            </div>

            {/* Image with rarity glow */}
            <div className="relative mx-auto w-40 h-40">
              <div
                className={`absolute inset-0 rounded-full blur-2xl opacity-60 bg-gradient-to-br ${rarityClasses(
                  displayStats.rarity,
                )}`}
              />
              <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-card shadow-2xl">
                {previewUrl ? (
                  <img src={previewUrl} alt={displayNickname} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <RarityDistributionTooltip rarity={displayStats.rarity}>
                <Badge
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${rarityBadge(
                    displayStats.rarity,
                  )} px-3 py-1 text-[10px] font-bold tracking-wider shadow-lg border-0 cursor-help`}
                >
                  {displayStats.rarity}
                </Badge>
              </RarityDistributionTooltip>
            </div>

            {/* Identity */}
            <div className="text-center space-y-1 pt-2">
              {editing ? (
                <div className="flex items-center justify-center gap-1">
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    maxLength={32}
                    className="h-9 text-center text-lg font-bold max-w-[220px]"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={saveEdit} aria-label="Save nickname">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={cancelEdit} aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={!isPreviewing && onNicknameChange ? startEdit : undefined}
                  className={`group inline-flex items-center justify-center gap-2 ${!isPreviewing && onNicknameChange ? "cursor-pointer" : "cursor-default"}`}
                  aria-label={!isPreviewing && onNicknameChange ? "Edit nickname" : undefined}
                >
                  <h2 className="text-2xl font-bold leading-tight">{displayNickname}</h2>
                  {!isPreviewing && onNicknameChange && (
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              )}
              <p className="text-sm italic text-muted-foreground">{displaySpecies}</p>
              {onSelectCandidate && candidates && candidates.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSpeciesPickerOpen((v) => !v)}
                  className="text-[11px] text-primary hover:underline mt-1"
                >
                  {speciesPickerOpen ? "Hide other matches" : `Not quite right? Pick from ${candidates.length} matches`}
                </button>
              )}
              {speciesPickerOpen && candidates && onSelectCandidate && (
                <div className="mt-2 space-y-1.5 text-left">
                  {candidates.slice(0, 5).map((c, i) => {
                    const selected = c.species === displaySpecies;
                    return (
                      <button
                        type="button"
                        key={c.species + i}
                        onClick={() => {
                          onSelectCandidate(c.species);
                          setSpeciesPickerOpen(false);
                        }}
                        className={`w-full rounded-lg border p-2 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={i === 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                              #{c.rank ?? i + 1}
                            </Badge>
                            <span className="text-sm font-medium truncate">{c.species}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {c.confidence}%
                          </Badge>
                        </div>
                        {c.reasoning && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                            {c.reasoning}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isPreviewing && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-center space-y-2">
                <p className="text-sm font-semibold text-primary">
                  Previewing: {pendingSpecies}
                </p>
                <p className="text-xs text-muted-foreground">
                  Review the fighter profile below, then save or keep the original.
                </p>
              </div>
            )}

            {/* Power + strongest stat */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-background/50 p-3 flex flex-col items-center justify-center">
                <PowerScoreArc score={displayStats.power_score} size="small" />
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3 flex flex-col items-center justify-center text-center">
                <div className="text-2xl">{strongest.icon}</div>
                <div className="text-2xl font-bold leading-none mt-1">{strongest.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  Strongest · {strongest.label}
                </div>
              </div>
            </div>

            {/* All attributes */}
            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Attributes
              </div>
              <div className="space-y-1.5">
                {statEntries.map((s) => {
                  const isMax = s.key === strongest.key;
                  return (
                    <div key={s.key} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span aria-hidden>{s.icon}</span>
                          <span className={isMax ? "font-semibold text-foreground" : "text-muted-foreground"}>
                            {s.label}
                          </span>
                        </span>
                        <span className={`font-mono tabular-nums ${isMax ? "font-bold text-primary" : "text-foreground"}`}>
                          {s.value}
                        </span>
                      </div>
                      <Progress value={(s.value / maxStat) * 100} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Safety */}
            {displaySafety && (
              <div
                className={`rounded-xl border p-3 flex items-start gap-2 text-xs ${
                  harmful
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-muted/30"
                }`}
              >
                {harmful ? (
                  <ShieldAlert className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                ) : (
                  <Heart className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-semibold">
                    {harmful ? "Handle with caution: " : "Safety: "}
                  </span>
                  <span className="text-muted-foreground">{displaySafety.harmfulToHumans}</span>
                  {displaySafety.isUSNative && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">US Native</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Location tagging */}
            {(onUseMyLocation || onSearchCity) && (
              <div className={`rounded-xl border p-3 space-y-2 ${
                hasLocation ? "border-primary/40 bg-primary/5" : "border-dashed border-primary/40 bg-muted/30"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {hasLocation ? "Location" : "Tag location"}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </div>
                  {hasLocation && onClearLocation && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onClearLocation}
                      className="h-6 px-2 text-[11px]"
                    >
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {onUseMyLocation && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onUseMyLocation}
                      disabled={locationLoading}
                      className="sm:w-auto"
                    >
                      {locationLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Use my location
                    </Button>
                  )}
                  {onSearchCity && (
                    <div className="flex flex-1 gap-1.5">
                      <Input
                        placeholder="Type a city (e.g., Austin, TX)"
                        value={locationName ?? ""}
                        onChange={(e) => onLocationNameChange?.(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onSearchCity(locationName ?? "");
                          }
                        }}
                        className="h-9 text-sm"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onSearchCity(locationName ?? "")}
                        disabled={citySearchLoading || !(locationName ?? "").trim()}
                      >
                        {citySearchLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Locations are fuzzed to ~1 km — your exact spot is never stored.
                </p>
              </div>
            )}

            {/* Actions */}
            {isPreviewing ? (
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onConfirmSpecies}
                >
                  Save this species
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={onCancelPreview}
                >
                  Keep original
                </Button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={onAddToStarting5}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add to Starting Lineup
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onBattleNow}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Sword className="h-4 w-4" />
                    Battle Now
                  </Button>
                  <ShareButton
                    title={`${nickname} — ${stats.rarity} Spider`}
                    text={`🕷️ Just recruited ${nickname} (${species}) — ${stats.rarity} • ${stats.power_score} Power. Strongest stat: ${strongest.label} ${strongest.value}. Join me on Spider League!`}
                    variant="outline"
                    size="default"
                    imageFileName={`spider-league-${nickname.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
                    getShareImage={() =>
                      generateSpiderShareImage({
                        nickname,
                        species,
                        rarity: stats.rarity,
                        powerScore: stats.power_score,
                        imageUrl: previewUrl || "",
                        tagline: "Upload your spider. Battle for glory. spiderleague.app",
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpiderRevealCard;
