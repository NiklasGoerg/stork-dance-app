import { describe, expect, it } from "vitest";
import {
  migrationActNarrationCatalog,
  resolveMigrationActNarrationCue,
  type MigrationActNarrationId,
} from "~/utils/migrationActs/narrationCatalog";

describe("migration act narration catalog", () => {
  const requiredCueIds = [
    "act3.departure.context",
    "act3.departure.handover",
    "act3.departure.success",
    "act3.migration.context",
    "act3.arrival.context",
    "act3.arrival.handover",
    "act3.arrival.success",
    "act3.cycle.complete",
  ] as const satisfies readonly MigrationActNarrationId[];

  it("contains the required stable Act 3 cue ids", () => {
    const ids = Object.keys(migrationActNarrationCatalog);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("act3."))).toBe(true);
    requiredCueIds.forEach((id) => {
      expect(resolveMigrationActNarrationCue(id).id).toBe(id);
    });
  });

  it("separates placeholders from final positive feedback cues", () => {
    expect(
      resolveMigrationActNarrationCue("act3.departure.success"),
    ).toMatchObject({
      trigger: { type: "gesture-success", gesture: "departure" },
      placeholder: false,
      speak: true,
    });
    expect(
      resolveMigrationActNarrationCue("act3.arrival.success"),
    ).toMatchObject({
      trigger: { type: "gesture-success", gesture: "arrival" },
      placeholder: false,
      speak: true,
    });
    expect(
      resolveMigrationActNarrationCue("act3.arrival.context"),
    ).toMatchObject({
      trigger: { type: "event", eventType: "autumn_arrival" },
      placeholder: true,
    });
  });
});
