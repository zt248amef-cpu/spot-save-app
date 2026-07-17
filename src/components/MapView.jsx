import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Map as MapIcon, MapPin } from "lucide-react";
import { trackScreenView } from "../services/analyticsService";
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

const TOKYO = [35.6762, 139.6503];

function MapView({ spots }) {
  const sectionRef = useRef(null);
  const pinned = spots.filter((s) => s.lat != null && s.lng != null);
  const center = pinned.length > 0 ? [pinned[0].lat, pinned[0].lng] : TOKYO;

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
      <div className="mapWrapper">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pinned.map((spot) => (
            <Marker key={spot.id} position={[spot.lat, spot.lng]}>
              <Popup>
                <strong>{spot.title}</strong>
                <br />
                <MapPin size={12} style={{ verticalAlign: "middle", marginRight: 2 }} aria-hidden="true" />
                {spot.place}
                {spot.memo && <><br />{spot.memo}</>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {pinned.length === 0 && (
        <p className="mapHint">スポットに緯度・経度を追加すると地図に表示されます</p>
      )}
    </div>
  );
}

export default MapView;
