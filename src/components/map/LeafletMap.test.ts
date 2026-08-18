import { describe, expect, it } from "vitest";
import leafletMapSource from "~/components/map/LeafletMap.vue?raw";

describe("LeafletMap story marker refresh", () => {
  it("refreshes the stork marker after map viewport changes", () => {
    expect(leafletMapSource).toContain("scheduleStoryMarkerRefresh");
    expect(leafletMapSource).toContain(
      "storyMarkerInterpolation.updateImmediately()",
    );
    expect(leafletMapSource).toContain('"zoomend moveend viewreset resize"');
    expect(leafletMapSource).toContain("handleMapViewportChanged");
  });

  it("refreshes the stork marker after semantic camera changes", () => {
    const migrationCameraIndex = leafletMapSource.indexOf(
      'props.cameraMode === "migration"',
    );
    const firstRefreshAfterCamera = leafletMapSource.indexOf(
      "scheduleStoryMarkerRefresh();",
      migrationCameraIndex,
    );

    expect(migrationCameraIndex).toBeGreaterThanOrEqual(0);
    expect(firstRefreshAfterCamera).toBeGreaterThan(migrationCameraIndex);
  });
});
