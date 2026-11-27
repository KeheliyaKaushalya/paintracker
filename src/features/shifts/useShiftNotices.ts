import { useEffect } from "react";
import { hhmm, todayISO } from "../../domain/clinical/dates";
import { addDays, currentShifts } from "../../domain/clinical/shifts";
import { useShiftAssignments, useShiftTemplates } from "./hooks";

export function useShiftNotices(userId: string | undefined) {
  const templates = useShiftTemplates();
  const today = todayISO();
  const assignments = useShiftAssignments(addDays(today, -1), today);

  useEffect(() => {
    if (!userId || typeof Notification === "undefined") return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      for (const { date, template } of currentShifts(templates.data ?? [])) {
        const a = (assignments.data ?? []).find(
          (x) => x.shift_date === date && x.template_id === template.id,
        );
        if (a?.assignee_id !== userId) continue;
        const key = `shift-notice:${date}:${template.id}`;
        try {
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, "1");
        } catch {
          // storage unavailable: skip the once-only memory and still notify
        }
        new Notification(`Your ${template.name} shift has started`, {
          body: `${hhmm(template.start_time)}–${hhmm(template.end_time)}`,
        });
      }
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [userId, templates.data, assignments.data]);
}
