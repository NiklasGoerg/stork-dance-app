import { describe, expect, it } from "vitest";
import pauseOverlaySource from "~/components/story/PauseOverlay.vue?raw";

describe("PauseOverlay", () => {
  it("renders one shared modal pause surface with back and resume actions", () => {
    expect(pauseOverlaySource).toContain('role="dialog"');
    expect(pauseOverlaySource).toContain('aria-modal="true"');
    expect(pauseOverlaySource).toContain('title: "Paused"');
    expect(pauseOverlaySource).toContain(
      'text: "Continue when you\'re ready."',
    );
    expect(pauseOverlaySource).toContain('backLabel: "Back to Start"');
    expect(pauseOverlaySource).toContain('resumeLabel: "Resume"');
    expect(pauseOverlaySource).toContain("@click=\"$emit('back')\"");
    expect(pauseOverlaySource).toContain("@click=\"$emit('resume')\"");
  });

  it("blocks click-through and keeps the paused act visible underneath", () => {
    expect(pauseOverlaySource).toContain(".pause-overlay__scrim");
    expect(pauseOverlaySource).toContain("pointer-events: auto;");
    expect(pauseOverlaySource).toContain("rgb(18 24 20 / 0.46)");
    expect(pauseOverlaySource).toContain("backdrop-filter");
    expect(pauseOverlaySource).not.toContain("display: none");
  });
});
