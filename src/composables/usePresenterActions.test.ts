import { describe, expect, it } from "vitest";
import {
  getPresenterActionForKey,
  isPresenterEditableTarget,
} from "~/composables/usePresenterActions";

describe("usePresenterActions helpers", () => {
  it("maps presenter keys and ignores arrow keys", () => {
    expect(getPresenterActionForKey("PageUp")).toBe("pageUp");
    expect(getPresenterActionForKey("PageDown")).toBe("pageDown");
    expect(getPresenterActionForKey("ArrowUp")).toBeNull();
    expect(getPresenterActionForKey("ArrowDown")).toBeNull();
  });

  it("detects editable targets", () => {
    expect(
      isPresenterEditableTarget({
        tagName: "INPUT",
      } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isPresenterEditableTarget({
        tagName: "textarea",
      } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isPresenterEditableTarget({
        tagName: "select",
      } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isPresenterEditableTarget({
        isContentEditable: true,
        tagName: "div",
      } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isPresenterEditableTarget({
        tagName: "button",
      } as unknown as EventTarget),
    ).toBe(false);
  });
});
