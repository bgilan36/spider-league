import { useCallback } from "react";
import { useStartSkillBattle } from "./useStartSkillBattle";

export const PRACTICE_PICKER_TITLE = "Your first training battle";
export const PRACTICE_PICKER_SUBTITLE =
  "Pick one attack and one defense stance — the defaults are a safe start. Your opponent is an AI-controlled practice spider, so nobody else needs to be online. You can't lose your spider.";

/** Opens the stance picker for an AI-controlled practice Training Battle. */
export function usePracticeBattle() {
  const { open, picker, isOpen } = useStartSkillBattle();
  const start = useCallback((spiderId?: string | null) => {
    open({ spiderId: spiderId ?? null, practice: true, title: PRACTICE_PICKER_TITLE, subtitle: PRACTICE_PICKER_SUBTITLE });
  }, [open]);
  return { start, picker, isOpen };
}
