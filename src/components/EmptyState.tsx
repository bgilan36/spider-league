import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  /** Compact variant fits inside smaller cards */
  compact?: boolean;
}

const renderAction = (a: EmptyStateAction, key: string) => {
  const Icon = a.icon;
  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      {a.label}
    </>
  );
  if (a.to) {
    return (
      <Button key={key} asChild variant={a.variant ?? "default"} className="gap-2">
        <Link to={a.to}>{inner}</Link>
      </Button>
    );
  }
  if (a.href) {
    return (
      <Button key={key} asChild variant={a.variant ?? "default"} className="gap-2">
        <a href={a.href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      </Button>
    );
  }
  return (
    <Button
      key={key}
      onClick={a.onClick}
      variant={a.variant ?? "default"}
      className="gap-2"
    >
      {inner}
    </Button>
  );
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  compact,
}) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-dashed bg-gradient-to-b from-muted/30 to-background",
        compact ? "p-6" : "p-8 sm:p-12",
        className
      )}
    >
      {/* Decorative glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex flex-col items-center text-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 mb-4",
            compact ? "h-12 w-12" : "h-16 w-16"
          )}
        >
          <Icon className={compact ? "h-6 w-6" : "h-8 w-8"} />
        </div>
        <h3
          className={cn(
            "font-display tracking-wide uppercase",
            compact ? "text-lg" : "text-2xl sm:text-3xl"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-2 max-w-md text-muted-foreground",
            compact ? "text-sm" : "text-sm sm:text-base"
          )}
        >
          {description}
        </p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {primaryAction && renderAction(primaryAction, "p")}
            {secondaryAction && renderAction(
              { variant: "outline", ...secondaryAction },
              "s"
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default EmptyState;