import { describe, expect, it } from "vitest";
import coverSource from "~/components/story/CycleTransitionCover.vue?raw";
import stageSourceText from "~/components/story/MigrationActStage.vue?raw";
import { isCycleTransitionCoverMounted } from "~/utils/migrationActs/cycleTransitionCover";

describe("CycleTransitionCover", () => {
  it("binds the label and both cycle years as the persistent cover payload", () => {
    expect(coverSource).toContain('data-testid="cycle-transition-cover"');
    expect(coverSource).toContain("{{ label }}");
    expect(coverSource).toContain("{{ fromTitle }}");
    expect(coverSource).toContain("{{ toTitle }}");
  });

  it("mounts for every non-idle transition state", () => {
    expect(isCycleTransitionCoverMounted("idle")).toBe(false);
    expect(isCycleTransitionCoverMounted("covering")).toBe(true);
    expect(isCycleTransitionCoverMounted("swapping")).toBe(true);
    expect(isCycleTransitionCoverMounted("ready")).toBe(true);
    expect(isCycleTransitionCoverMounted("revealing")).toBe(true);
  });

  it("is styled as an absolute full-pane cover above Leaflet", () => {
    expect(coverSource).toContain("position: absolute;");
    expect(coverSource).toContain("inset: 0;");
    expect(coverSource).toContain("z-index: 1000;");
    expect(coverSource).toContain("pointer-events: auto;");
  });

  it("is rendered as a stable map-shell sibling after the Leaflet map", () => {
    expect(stageSourceText.indexOf("<BirdMap")).toBeLessThan(
      stageSourceText.indexOf("<CycleTransitionCover"),
    );
    expect(stageSourceText).toContain('v-if="cycleTransitionCoverMounted"');
    expect(stageSourceText).not.toContain("migration-cycle-transition-overlay");
  });
});
