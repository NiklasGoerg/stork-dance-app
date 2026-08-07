import { describe, expect, it } from "vitest";
import {
  migrationActNarrationCatalog,
  resolveMigrationActNarrationCue,
  type MigrationActNarrationId,
} from "~/utils/migrationActs/narrationCatalog";

describe("migration act narration catalog", () => {
  const requiredCueIds = [
    "act4.departure.context",
    "act4.departure.handover",
    "act4.departure.success",
    "act4.migration.context",
    "act4.arrival.context",
    "act4.arrival.handover",
    "act4.arrival.success",
    "act4.cycle.complete",
  ] as const satisfies readonly MigrationActNarrationId[];

  it("contains the required stable Act 4 cue ids", () => {
    const ids = Object.keys(migrationActNarrationCatalog);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("act4."))).toBe(true);
    requiredCueIds.forEach((id) => {
      expect(resolveMigrationActNarrationCue(id).id).toBe(id);
    });
  });

  it("separates placeholders from final positive feedback cues", () => {
    expect(
      resolveMigrationActNarrationCue("act4.departure.success"),
    ).toMatchObject({
      trigger: { type: "gesture-success", gesture: "departure" },
      placeholder: false,
      speak: true,
    });
    expect(
      resolveMigrationActNarrationCue("act4.arrival.success"),
    ).toMatchObject({
      trigger: { type: "gesture-success", gesture: "arrival" },
      placeholder: false,
      speak: true,
    });
    expect(
      resolveMigrationActNarrationCue("act4.arrival.context"),
    ).toMatchObject({
      trigger: { type: "event", eventType: "autumn_arrival" },
      placeholder: true,
    });
  });
});
