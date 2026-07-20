import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { Map as MapIcon, MapPin } from "lucide-react";
import MapViewportController from "./MapViewportController";
import { trackScreenView } from "../services/analyticsService";
import { getMappableSpots, JAPAN_CENTER, JAPAN_ZOOM } from "../utils/mapUtils";
import { resolveSpotImage, stripLeadingEmoji } from "../utils/urlUtils";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const currentLocationIcon = L.divIcon({
  className: "currentLocationMarker",
  html: '<span class="currentLocationMarkerDot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function ResizeMapOnLayout() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const frame = requestAnimationFrame(invalidate);
    const timer = setTimeout(invalidate, 250);
    window.addEventListener("resize", invalidate);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}

function MapView({ spots }) {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const mappableSpots = useMemo(() => getMappableSpots(spots), [spots]);
  const spotPositions = useMemo(
    () => mappableSpots.map(({ position }) => position),
    [mappableSpots]
  );

  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude);
        const longitude = Number(coords.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setCurrentLocation([latitude, longitude]);
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );

    return undefined;
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        trackScreenView("Map", "map-section");
        observer.disconnect();
      },
      { threshold: 0.5 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mapSection" ref={sectionRef}>
      <p className="mapLabel">
        <MapIcon aria-hidden="true" />
        地図
      </p>
      <div
        className="mapWrapper"
        data-tour="map"
        data-map-marker-count={mappableSpots.length}
      >
        <MapContainer center={JAPAN_CENTER} zoom={JAPAN_ZOOM} style={{ height: "100%", width: "100%" }}>
          <ResizeMapOnLayout />
          <MapViewportController
            spotPositions={spotPositions}
            currentLocation={currentLocation}
          />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mappableSpots.map(({ spot, position }) => {
            const thumbnail = resolveSpotImage(spot);
            const title = spot.placeName?.trim() || spot.title || "保存したスポット";
            const address = spot.addressCandidate?.trim() || spot.place?.trim();

            return (
              <Marker key={spot.id} position={position}>
                <Popup className="spotMapPopup" minWidth={220}>
                  <div className="spotMapPopupContent">
                    {thumbnail && <img src={thumbnail} alt="" className="spotMapPopupImage" />}
                    <strong className="spotMapPopupTitle">{title}</strong>
                    {spot.category && (
                      <span className="spotMapPopupCategory">
                        {stripLeadingEmoji(spot.category) || spot.category}
                      </span>
                    )}
                    {address && (
                      <p className="spotMapPopupAddress">
                        <MapPin aria-hidden="true" />
                        <span>{address}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      className="spotMapPopupButton"
                      onClick={() => navigate(`/spot/${spot.id}`)}
                    >
                      詳細を見る
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={currentLocationIcon}
              title="現在地"
              zIndexOffset={1000}
            >
              <Popup>現在地</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      {mappableSpots.length === 0 && (
        <p className="mapHint">緯度・経度があるスポットを保存すると地図に表示されます</p>
      )}
    </div>
  );
}

export default MapView;
