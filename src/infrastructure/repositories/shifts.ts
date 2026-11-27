import { toError } from "../../shared/errors/errors";
import type {
  ShiftAssignment,
  ShiftTemplate,
} from "../../domain/clinical/models";
import { supabase } from "../supabase/supabase";

export async function fetchShiftTemplates(
  includeInactive = false,
): Promise<ShiftTemplate[]> {
  const q = supabase.from("shift_templates").select("*");
  const { data, error } = includeInactive
    ? await q.order("start_time")
    : await q.eq("active", true).order("start_time");
  if (error) throw toError(error);
  return (data ?? []) as ShiftTemplate[];
}

export async function fetchShiftAssignments(
  from: string,
  to: string,
): Promise<ShiftAssignment[]> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*")
    .gte("shift_date", from)
    .lte("shift_date", to);
  if (error) throw toError(error);
  return (data ?? []) as ShiftAssignment[];
}

export async function saveShiftAssignment(a: {
  shift_date: string;
  template_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("shift_assignments")
    .upsert(a, { onConflict: "shift_date,template_id" });
  if (error) throw toError(error);
}

export async function createShiftTemplate(t: {
  name: string;
  start_time: string;
  end_time: string;
}): Promise<void> {
  const { error } = await supabase.from("shift_templates").insert(t);
  if (error) throw toError(error);
}

export async function setShiftTemplateActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("shift_templates")
    .update({ active })
    .eq("id", id);
  if (error) throw toError(error);
}
