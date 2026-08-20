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

  it("fits semantic migration camera to the active migration route context", () => {
    expect(leafletMapSource).toContain("getActiveMigrationPoints");
    expect(leafletMapSource).toContain("getActiveMigrationCameraPhase");
    expect(leafletMapSource).toContain("pendingRuntimeEvent");
    expect(leafletMapSource).toContain(
      "fitCameraToPoints(getActiveMigrationPoints()",
    );
    expect(leafletMapSource).toContain(
      '${route?.id ?? "none"}:migration:${migrationCameraPhase ?? "full"}',
    );
    expect(leafletMapSource).not.toContain("config.center");
    expect(leafletMapSource).not.toContain("config.zoom");
  });

  it("uses a configured cycle start date when no migration runtime date exists", () => {
    expect(leafletMapSource).toContain("getInitialStoryDate");
    expect(leafletMapSource).toContain("if (currentDate.value)");
    expect(leafletMapSource).toContain("configuredCycle?.startDate");
    expect(leafletMapSource).toContain(
      "seekStoryToDate(getInitialStoryDate())",
    );
  });
});
