import { describe, expect, it } from "vitest";
import {
  getPresenterActionForEvent,
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

  it("ignores disabled, repeated, and editable presenter key events", () => {
    const pageUp = {
      key: "PageUp",
      repeat: false,
      target: { tagName: "button" } as unknown as EventTarget,
    };

    expect(getPresenterActionForEvent(pageUp, true)).toBe("pageUp");
    expect(getPresenterActionForEvent(pageUp, false)).toBeNull();
    expect(
      getPresenterActionForEvent({ ...pageUp, repeat: true }, true),
    ).toBeNull();
    expect(
      getPresenterActionForEvent(
        {
          ...pageUp,
          target: { tagName: "input" } as unknown as EventTarget,
        },
        true,
      ),
    ).toBeNull();
  });
});
