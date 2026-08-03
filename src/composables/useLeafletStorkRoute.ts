import type {
  StorkDataPoint,
  StorkMarkerKind,
  StorkMarkerVisual,
  StorkStoryPoint,
} from "~/types/stork";
import {
  resolveStorkMarkerVisual,
  resolveStorkMarkerVisualForPhase,
} from "~/utils/storkMarker";

type LatLng = [number, number];

export type LeafletRouteLayer = {
  addTo: (map: LeafletRouteMap) => LeafletRouteLayer;
};

export type LeafletStoryMarker = LeafletRouteLayer & {
  setIcon: (icon: unknown) => LeafletStoryMarker;
  setLatLng: (point: LatLng) => LeafletStoryMarker;
};

export type LeafletRoutePolyline = LeafletRouteLayer & {
  getBounds: () => unknown;
};

export type LeafletRouteMap = {
  remove?: () => void;
  stop?: () => void;
  invalidateSize?: () => void;
  removeLayer: (layer: LeafletRouteLayer) => void;
  fitBounds: (
    bounds: unknown,
    options?: {
      padding?: [number, number];
      maxZoom?: number;
      animate?: boolean;
    },
  ) => void;
};

export type LeafletRouteModule = {
  polyline: (
    points: LatLng[],
    options: Record<string, unknown>,
  ) => LeafletRoutePolyline;
  circleMarker: (
    point: LatLng,
    options: Record<string, unknown>,
  ) => LeafletRouteLayer;
  divIcon: (options: Record<string, unknown>) => unknown;
  marker: (
    point: LatLng,
    options: Record<string, unknown>,
  ) => LeafletStoryMarker;
};

type SelectedStoryMarker = {
  layer: LeafletStoryMarker;
  visualKey: string;
};

type ColoredRoute = {
  color: string;
  points: StorkDataPoint[];
};

type ColoredPoint = {
  color: string;
  point: StorkDataPoint;
};

const storkMarkerUrls: Record<StorkMarkerKind, string> = {
  nesting: new URL("../assets/images/stork_nesting.png", import.meta.url).href,
  eating: new URL("../assets/images/stork_eating.png", import.meta.url).href,
  flying: new URL("../assets/images/stork_flying.png", import.meta.url).href,
};

const createStorkMarkerElement = ({ kind, mirrored }: StorkMarkerVisual) => {
  const markerElement = document.createElement("div");
  const markerImage = document.createElement("img");

  markerElement.className = "stork-route-marker";
  markerImage.className = "stork-route-marker__image";
  markerImage.classList.toggle("stork-route-marker__image--mirrored", mirrored);
  markerImage.src = storkMarkerUrls[kind];
  markerImage.alt = "";
  markerImage.setAttribute("aria-hidden", "true");
  markerElement.append(markerImage);

  return markerElement;
};

export const useLeafletStorkRoute = () => {
  const routeLayers: LeafletRouteLayer[] = [];
  const selectedPointLayers: LeafletRouteLayer[] = [];
  const selectedStoryMarkers = new Map<string, SelectedStoryMarker>();

  const clearSelectedPoint = (map: LeafletRouteMap | null) => {
    if (!map) return;

    for (const layer of selectedPointLayers) {
      map.removeLayer(layer);
    }

    for (const { layer } of selectedStoryMarkers.values()) {
      map.removeLayer(layer);
    }

    selectedPointLayers.length = 0;
    selectedStoryMarkers.clear();
  };

  const clearRoute = (map: LeafletRouteMap | null) => {
    if (!map) return;

    clearSelectedPoint(map);

    for (const layer of routeLayers) {
      map.removeLayer(layer);
    }

    routeLayers.length = 0;
  };

  const drawRoute = (
    map: LeafletRouteMap | null,
    leaflet: LeafletRouteModule | null,
    points: StorkDataPoint[],
  ) => {
    clearRoute(map);

    if (!map || !leaflet || points.length === 0) return;

    const latLngs = points.map((point): LatLng => [point.lat, point.lng]);
    const routeLine = leaflet
      .polyline(latLngs, {
        color: "#c1121f",
        weight: 3,
        opacity: 0.86,
        lineCap: "round",
        lineJoin: "round",
      })
      .addTo(map) as LeafletRoutePolyline;

    routeLayers.push(routeLine);

    for (const latLng of latLngs) {
      const marker = leaflet
        .circleMarker(latLng, {
          radius: 2.4,
          color: "#7d0b13",
          weight: 1,
          opacity: 0.75,
          fillColor: "#ffffff",
          fillOpacity: 0.72,
        })
        .addTo(map);

      routeLayers.push(marker);
    }

    if (points.length > 1) {
      map.fitBounds(routeLine.getBounds(), {
        padding: [32, 32],
        maxZoom: 7,
        animate: false,
      });
    }
  };

  const drawYearRoutes = (
    map: LeafletRouteMap | null,
    leaflet: LeafletRouteModule | null,
    routes: ColoredRoute[],
  ) => {
    clearRoute(map);

    if (!map || !leaflet || routes.length === 0) return;

    const allLatLngs: LatLng[] = [];

    for (const route of routes) {
      const latLngs = route.points.map((point): LatLng => [
        point.lat,
        point.lng,
      ]);

      if (!latLngs.length) continue;

      allLatLngs.push(...latLngs);

      const routeLine = leaflet
        .polyline(latLngs, {
          color: route.color,
          weight: 3,
          opacity: 0.72,
          lineCap: "round",
          lineJoin: "round",
        })
        .addTo(map) as LeafletRoutePolyline;

      routeLayers.push(routeLine);

      for (const latLng of latLngs) {
        const marker = leaflet
          .circleMarker(latLng, {
            radius: 2,
            color: route.color,
            weight: 1,
            opacity: 0.65,
            fillColor: "#ffffff",
            fillOpacity: 0.6,
          })
          .addTo(map);

        routeLayers.push(marker);
      }
    }

    if (allLatLngs.length > 1) {
      const boundsLine = leaflet.polyline(allLatLngs, {});

      map.fitBounds(boundsLine.getBounds(), {
        padding: [32, 32],
        maxZoom: 7,
        animate: false,
      });
    }
  };

  const drawSelectedPoint = (
    map: LeafletRouteMap | null,
    leaflet: LeafletRouteModule | null,
    point: StorkDataPoint | null,
  ) => {
    clearSelectedPoint(map);

    if (!map || !leaflet || !point) return;

    const selectedPointLayer = leaflet
      .circleMarker([point.lat, point.lng], {
        radius: 7,
        color: "#161616",
        weight: 2,
        opacity: 0.95,
        fillColor: "#c1121f",
        fillOpacity: 0.95,
      })
      .addTo(map);

    selectedPointLayers.push(selectedPointLayer);
  };

  const drawSelectedYearPoints = (
    map: LeafletRouteMap | null,
    leaflet: LeafletRouteModule | null,
    yearPoints: ColoredPoint[],
  ) => {
    clearSelectedPoint(map);

    if (!map || !leaflet) return;

    for (const yearPoint of yearPoints) {
      const selectedPointLayer = leaflet
        .circleMarker([yearPoint.point.lat, yearPoint.point.lng], {
          radius: 7,
          color: "#161616",
          weight: 2,
          opacity: 0.95,
          fillColor: yearPoint.color,
          fillOpacity: 0.95,
        })
        .addTo(map);

      selectedPointLayers.push(selectedPointLayer);
    }
  };

  const drawSelectedStoryPoints = (
    map: LeafletRouteMap | null,
    leaflet: LeafletRouteModule | null,
    storyPoints: StorkStoryPoint[],
    options: { updatePositions?: boolean } = {},
  ) => {
    if (!map || !leaflet) return;

    for (const [cycleId, marker] of selectedStoryMarkers) {
      if (storyPoints.some((storyPoint) => storyPoint.cycle.id === cycleId)) {
        continue;
      }

      map.removeLayer(marker.layer);
      selectedStoryMarkers.delete(cycleId);
    }

    for (const storyPoint of storyPoints) {
      const markerVisual = storyPoint.point.story
        ? resolveStorkMarkerVisualForPhase(storyPoint.point.story.phase)
        : resolveStorkMarkerVisual(
            storyPoint.cycle,
            storyPoint.point.date,
            storyPoint.cycle.startDate,
          );
      const visualKey = `${markerVisual.kind}:${markerVisual.mirrored}`;
      const existingMarker = selectedStoryMarkers.get(storyPoint.cycle.id);

      if (existingMarker) {
        if (options.updatePositions !== false) {
          existingMarker.layer.setLatLng([
            storyPoint.point.lat,
            storyPoint.point.lng,
          ]);
        }
        if (existingMarker.visualKey !== visualKey) {
          existingMarker.layer.setIcon(
            leaflet.divIcon({
              className: "stork-route-div-icon",
              html: createStorkMarkerElement(markerVisual),
              iconSize: [84, 48],
              iconAnchor: [42, 24],
            }),
          );
          existingMarker.visualKey = visualKey;
        }
        continue;
      }

      const layer = leaflet
        .marker([storyPoint.point.lat, storyPoint.point.lng], {
          icon: leaflet.divIcon({
            className: "stork-route-div-icon",
            html: createStorkMarkerElement(markerVisual),
            iconSize: [84, 48],
            iconAnchor: [42, 24],
          }),
          interactive: false,
          keyboard: false,
        })
        .addTo(map) as LeafletStoryMarker;

      selectedStoryMarkers.set(storyPoint.cycle.id, { layer, visualKey });
    }
  };

  const setSelectedStoryMarkerPosition = (
    cycleId: string,
    lat: number,
    lng: number,
  ) => {
    const marker = selectedStoryMarkers.get(cycleId);
    if (!marker) return false;

    marker.layer.setLatLng([lat, lng]);
    return true;
  };

  return {
    clearRoute,
    drawRoute,
    drawYearRoutes,
    drawSelectedPoint,
    drawSelectedYearPoints,
    drawSelectedStoryPoints,
    setSelectedStoryMarkerPosition,
  };
};
