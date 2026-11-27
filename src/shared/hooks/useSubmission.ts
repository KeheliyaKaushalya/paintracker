import { useRef, useState } from "react";

/** Synchronous lock: prevents duplicate requests before React re-renders. */
export function useSubmission() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  function begin() {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }
  function end() {
    locked.current = false;
    setBusy(false);
  }
  return { busy, begin, end };
}
