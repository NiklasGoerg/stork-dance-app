import type { StorkDataPoint } from "~/types/stork";

type LatLng = [number, number];

export type LeafletRouteLayer = {
  addTo: (map: LeafletRouteMap) => LeafletRouteLayer;
};

export type LeafletRoutePolyline = LeafletRouteLayer & {
  getBounds: () => unknown;
};

export type LeafletRouteMap = {
  remove?: () => void;
  invalidateSize?: () => void;
  removeLayer: (layer: LeafletRouteLayer) => void;
  fitBounds: (
    bounds: unknown,
    options?: {
      padding?: [number, number];
      maxZoom?: number;
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
};

type ColoredRoute = {
  color: string;
  points: StorkDataPoint[];
};

type ColoredPoint = {
  color: string;
  point: StorkDataPoint;
};

export const useLeafletStorkRoute = () => {
  const routeLayers: LeafletRouteLayer[] = [];
  const selectedPointLayers: LeafletRouteLayer[] = [];

  const clearSelectedPoint = (map: LeafletRouteMap | null) => {
    if (!map) return;

    for (const layer of selectedPointLayers) {
      map.removeLayer(layer);
    }

    selectedPointLayers.length = 0;
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
      const latLngs = route.points.map(
        (point): LatLng => [point.lat, point.lng],
      );

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

  return {
    clearRoute,
    drawRoute,
    drawYearRoutes,
    drawSelectedPoint,
    drawSelectedYearPoints,
  };
};
