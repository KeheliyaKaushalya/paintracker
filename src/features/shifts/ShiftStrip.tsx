import { Link } from "react-router-dom";
import { Tag } from "../../shared/components/ui";
import { todayISO } from "../../domain/clinical/dates";
import { addDays, currentShifts } from "../../domain/clinical/shifts";
import { useNameLookup } from "../patients/hooks";
import { useShiftAssignments, useShiftTemplates } from "./hooks";

/** "Day shift · Dr Perera" for each shift running right now. */
export function ShiftStrip() {
  const templates = useShiftTemplates();
  const today = todayISO();
  const assignments = useShiftAssignments(addDays(today, -1), today);
  const nameOf = useNameLookup();
  const running = currentShifts(templates.data ?? []);
  if (running.length === 0) return null;
  return (
    <Link
      to="/shifts"
      className="row wrap"
      style={{ marginBottom: 8, textDecoration: "none" }}
      aria-label="On duty now, open shifts"
    >
      {running.map(({ date, template }) => {
        const a = (assignments.data ?? []).find(
          (x) => x.shift_date === date && x.template_id === template.id,
        );
        const who = a?.assignee_id
          ? nameOf(a.assignee_id)
          : a?.assignee_name || "Unassigned";
        const assigned = !!(a?.assignee_id || a?.assignee_name);
        return (
          <Tag
            key={`${date}-${template.id}`}
            tone={assigned ? "primary" : "warn"}
          >
            {template.name} shift · {who}
          </Tag>
        );
      })}
    </Link>
  );
}
