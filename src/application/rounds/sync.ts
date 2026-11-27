import { isNetworkError, toError } from "../../shared/errors/errors";
import type { RoundInsert } from "../../domain/clinical/models";

import type { ErrorLike } from "../../shared/errors/errors";
import type { OutboxItem } from "../../infrastructure/storage/db";

export interface RoundSyncPorts {
  insert(round: RoundInsert): PromiseLike<{ error: ErrorLike | null }>;
  enqueue(item: OutboxItem): PromiseLike<unknown>;
  pending(userId: string): PromiseLike<OutboxItem[]>;
  remove(id: number): PromiseLike<unknown>;
  flag(
    id: number,
    changes: Pick<OutboxItem, "tries" | "lastError">,
  ): PromiseLike<unknown>;
}

export type SaveResult = "saved" | "queued";

export function createRoundSync(ports: RoundSyncPorts) {
  /**
   * Save a round. If the server can't be reached, keep it on this device and send it later.
   * The round's id is created on the device, so a retry can never make a duplicate.
   */
  async function saveRound(
    round: RoundInsert,
    userId: string,
  ): Promise<SaveResult> {
    const { error } = await ports.insert(round);
    if (!error || error.code === "23505") return "saved"; // 23505 = this exact round was already saved
    if (isNetworkError(error)) {
      await ports.enqueue({
        userId,
        payload: round,
        createdAt: Date.now(),
        tries: 0,
      });
      return "queued";
    }
    throw toError(error);
  }

  let flushing = false;

  /** Try to send everything waiting for this user. Returns how many were sent. */
  async function flushOutbox(userId: string): Promise<number> {
    if (flushing) return 0;
    flushing = true;
    try {
      const items = await ports.pending(userId);
      let sent = 0;
      for (const it of items) {
        const { error } = await ports.insert(it.payload);
        if (!error || error.code === "23505") {
          await ports.remove(it.id!);
          sent++;
          continue;
        }
        if (isNetworkError(error)) break; // still offline: stop and try again later
        // The server answered but refused it (bad data or no permission): keep it and flag it.
        await ports.flag(it.id!, {
          tries: it.tries + 1,
          lastError: toError(error).message,
        });
      }
      return sent;
    } finally {
      flushing = false;
    }
  }

  async function discardOutboxItem(id: number): Promise<void> {
    await ports.remove(id);
  }

  return { saveRound, flushOutbox, discardOutboxItem };
}
