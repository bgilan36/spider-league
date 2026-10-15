import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Camera, Plus, Users, Trophy, Bug, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match this route AND any deeper routes that conceptually belong to the tab */
  match?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "This Week", icon: Home, match: (p) => p === "/" || p.startsWith("/week/") },
  {
    to: "/upload",
    label: "Catch",
    icon: Camera,
    match: (p) => p.startsWith("/upload"),
  },
  {
    to: "/pods",
    label: "Pods",
    icon: Users,
    match: (p) => p.startsWith("/pods") || p.startsWith("/leagues") || p.startsWith("/join"),
  },
  {
    to: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    match: (p) => p.startsWith("/leaderboard"),
  },
  {
    to: "/collection",
    label: "Spiders",
    icon: Bug,
    match: (p) => p.startsWith("/collection"),
  },
];

const HIDDEN_ROUTES = ["/auth", "/admin"];

function useShouldHide(pathname: string) {
  return HIDDEN_ROUTES.some((r) => pathname.startsWith(r));
}

export const DesktopTabs: React.FC<{ pathname: string }> = ({ pathname }) => {
  if (useShouldHide(pathname)) return null;
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-lg"
    >
      <div className="container mx-auto px-4">
        <ul className="flex items-center gap-1 h-12">
          {TABS.map((tab) => {
            const active = tab.match ? tab.match(pathname) : pathname === tab.to;
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={cn(
                    "relative inline-flex items-center gap-2 px-3 h-12 text-sm font-medium transition-colors",
                    "text-muted-foreground hover:text-foreground",
                    active && "text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export const MobileTabBar: React.FC<{ pathname: string }> = ({ pathname }) => {
  if (useShouldHide(pathname)) return null;
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "md:hidden fixed bottom-3 left-3 right-3 z-50",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-0.5 rounded-full border border-border/60 px-1.5 py-2",
          "bg-background/90 supports-[backdrop-filter]:bg-background/75",
          "backdrop-blur-2xl backdrop-saturate-150 shadow-xl"
        )}
      >
        {TABS.map((tab, i) => {
          const active = tab.match ? tab.match(pathname) : pathname === tab.to;
          const Icon = tab.icon;
          const isHome = i === 0;
          const isCatch = tab.to === "/upload";
          if (isCatch) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-label="Catch a spider"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center h-12 w-12 -my-1 shrink-0 rounded-full transition-transform",
                  "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
                  "hover:scale-105 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                )}
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </NavLink>
            );
          }
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 h-12 flex-1 rounded-full text-[10px] font-semibold uppercase transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isHome && active && "bg-primary text-primary-foreground",
                !isHome && active && "text-primary bg-primary/10",
                !active && "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "scale-110")} />
              <span className="w-full truncate text-center">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export const AppTabs: React.FC<{ pathname: string }> = ({ pathname }) => {
  return (
    <>
      <DesktopTabs pathname={pathname} />
      <MobileTabBar pathname={pathname} />
    </>
  );
};

export default AppTabs;