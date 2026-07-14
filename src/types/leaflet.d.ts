declare module "leaflet" {
  type LatLng = [number, number];

  type LeafletLayer = {
    addTo: (map: LeafletMap) => LeafletLayer;
  };

  type LeafletPolyline = LeafletLayer & {
    getBounds: () => unknown;
  };

  type LeafletMap = {
    remove: () => void;
    invalidateSize: () => void;
    removeLayer: (layer: LeafletLayer) => void;
    fitBounds: (
      bounds: unknown,
      options?: {
        padding?: [number, number];
        maxZoom?: number;
      },
    ) => void;
  };

  export const map: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => LeafletMap;

  export const tileLayer: (
    urlTemplate: string,
    options: Record<string, unknown>,
  ) => {
    addTo: (map: LeafletMap) => unknown;
  };

  export const polyline: (
    points: LatLng[],
    options: Record<string, unknown>,
  ) => LeafletPolyline;

  export const circleMarker: (
    point: LatLng,
    options: Record<string, unknown>,
  ) => LeafletLayer;
}
