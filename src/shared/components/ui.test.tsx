import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Field, SearchInput } from "./ui";
afterEach(cleanup);
describe("shared form controls", () => {
  it("associates errors and hints with the native control", () => {
    const { rerender } = render(<Field id="dose" label="Dose" hint="Enter dose"><input id="dose" /></Field>);
    expect(screen.getByLabelText("Dose").getAttribute("aria-describedby")).toBe("dose-hint");
    rerender(<Field id="dose" label="Dose" error="Invalid dose"><input id="dose" aria-describedby="extra" /></Field>);
    const input = screen.getByLabelText("Dose");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("extra dose-err");
  });
  it("defaults to a non-submit button and supports explicit submit", () => {
    const submit = vi.fn(e => e.preventDefault());
    render(<form onSubmit={submit}><Button>Cancel</Button><Button type="submit">Save</Button></form>);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("preserves native search and caller styling", () => {
    render(<SearchInput aria-label="Search" className="input" />);
    expect(screen.getByRole("searchbox").className).toBe("input");
  });
});
