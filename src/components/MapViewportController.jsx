import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { JAPAN_CENTER, JAPAN_ZOOM } from "../utils/mapUtils";

function MapViewportController({ spotPositions, currentLocation }) {
  const map = useMap();

  useEffect(() => {
    if (spotPositions.length > 0) {
      map.fitBounds(L.latLngBounds(spotPositions), {
        padding: [32, 32],
        maxZoom: 15,
      });
      return;
    }

    if (currentLocation) {
      map.setView(currentLocation, 15);
      return;
    }

    map.setView(JAPAN_CENTER, JAPAN_ZOOM);
  }, [currentLocation, map, spotPositions]);

  return null;
}

export default MapViewportController;
