import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useSubmission } from "./useSubmission";

it("blocks a second submission synchronously and permits retry after release", () => {
  const { result } = renderHook(() => useSubmission());
  act(() => {
    expect(result.current.begin()).toBe(true);
    expect(result.current.begin()).toBe(false);
  });
  expect(result.current.busy).toBe(true);
  act(() => result.current.end());
  expect(result.current.busy).toBe(false);
  act(() => { expect(result.current.begin()).toBe(true); });
});
