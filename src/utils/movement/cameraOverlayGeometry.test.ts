import { describe, expect, it } from "vitest";
import { getCoverGeometry } from "./cameraOverlayGeometry";

describe("camera overlay cover geometry", () => {
  it("crops a 4:3 camera feed in a portrait viewport around the same center", () => {
    expect(getCoverGeometry(640, 480, 720, 900)).toEqual({
      x: -240,
      y: 0,
      width: 1200,
      height: 900,
    });
  });

  it("crops a 16:9 camera feed in a portrait viewport", () => {
    expect(getCoverGeometry(1600, 900, 640, 720)).toEqual({
      x: -320,
      y: 0,
      width: 1280,
      height: 720,
    });
  });
});
