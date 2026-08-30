import { describe, expect, it } from "vitest";
import playbackCanvasSource from "~/components/record/PlaybackCanvas.vue?raw";
import recordPageSource from "~/pages/record.vue?raw";

describe("PlaybackCanvas", () => {
  it("reuses MovementStage for record playback rendering", () => {
    expect(playbackCanvasSource).toContain("MovementStage");
    expect(playbackCanvasSource).toContain(":landmarks=");
    expect(playbackCanvasSource).toContain(':source-aspect="sourceAspect"');
    expect(playbackCanvasSource).toContain(':fill-background="true"');
    expect(playbackCanvasSource).toContain(":frame-scale=");
    expect(playbackCanvasSource).toContain(":thickness-scale=");
    expect(playbackCanvasSource).toContain("sourceAspect: number");
    expect(playbackCanvasSource).not.toContain("<canvas");
    expect(playbackCanvasSource).not.toContain("CanvasRenderingContext2D");
  });

  it("keeps the record playback background on a fixed widescreen stage", () => {
    expect(recordPageSource).toContain("playback-stage-wrap");
    expect(recordPageSource).toContain("aspect-ratio: 16 / 9");
    expect(recordPageSource).toContain("page--playback");
  });

  it("keeps the avatar frame tied to the recording source aspect", () => {
    expect(recordPageSource).toContain(
      ':source-aspect="recordPlayback.sourceAspect.value"',
    );
  });

  it("uses translated labels for the collapsible record panel", () => {
    expect(recordPageSource).toContain("isPanelCollapsed");
    expect(recordPageSource).toContain("aria-expanded");
    expect(recordPageSource).toContain('t("record.panel.expand")');
    expect(recordPageSource).toContain('t("record.panel.collapse")');
    expect(recordPageSource).toContain('t("record.panel.expandTitle")');
    expect(recordPageSource).toContain('t("record.panel.collapseTitle")');
  });
});
