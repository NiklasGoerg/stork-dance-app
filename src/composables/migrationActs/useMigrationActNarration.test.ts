import { describe, expect, it, vi } from "vitest";
import { useMigrationActNarration } from "~/composables/migrationActs/useMigrationActNarration";
import type { NarrationResult } from "~/types/narration";

describe("useMigrationActNarration", () => {
  it("presents catalog text without requiring text-to-speech", async () => {
    const stop = vi.fn();
    const narration = useMigrationActNarration({ stop });

    await expect(narration.present("act3.arrival.context")).resolves.toEqual({
      status: "disabled",
    });
    expect(narration.panelContent.value).toEqual({
      id: "act3.arrival.context",
      title: "Arrival",
      text: "Prepare to land.",
    });
    expect(narration.diagnostics.value.lastResult).toEqual({
      status: "disabled",
    });
  });

  it("speaks enabled cues without changing the caller's timing", async () => {
    const result = { status: "completed" } satisfies NarrationResult;
    const speakText = vi.fn(async () => result);
    const narration = useMigrationActNarration({
      speakText,
      stop: vi.fn(),
    });

    await expect(narration.present("act3.departure.success")).resolves.toBe(
      result,
    );
    expect(speakText).toHaveBeenCalledWith("Bravo! Great take-off.", {
      behavior: "replace",
    });
    expect(narration.diagnostics.value.lastResult).toEqual(result);
  });
});
