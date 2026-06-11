import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Swords, Users, Trophy, Bug, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match this route AND any deeper routes that conceptually belong to the tab */
  match?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    to: "/battle-history",
    label: "Battles",
    icon: Swords,
    match: (p) => p.startsWith("/battle-history") || p.startsWith("/battle/"),
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
    match: (p) => p.startsWith("/collection") || p.startsWith("/upload"),
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
        "md:hidden fixed bottom-0 inset-x-0 z-50",
        "bg-background/90 backdrop-blur-lg border-t border-border/40",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match ? tab.match(pathname) : pathname === tab.to;
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex">
              <NavLink
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-full py-2 text-[10px] font-medium tracking-wide uppercase transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
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