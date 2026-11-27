import { db } from "../storage/db";
import { supabase } from "../supabase/supabase";
import { createRoundSync } from "../../application/rounds/sync";
export type { SaveResult } from "../../application/rounds/sync";
export const { saveRound, flushOutbox, discardOutboxItem } = createRoundSync({
  insert: (round) => supabase.from("rounds").insert(round),
  enqueue: (item) => db.outbox.add(item),
  pending: (userId) =>
    db.outbox.where("userId").equals(userId).sortBy("createdAt"),
  remove: (id) => db.outbox.delete(id),
  flag: (id, changes) => db.outbox.update(id, changes),
});
