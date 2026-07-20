export const JAPAN_CENTER = [36.2048, 138.2529];
export const JAPAN_ZOOM = 5;

function toCoordinate(value, min, max) {
  if (value === null || value === undefined || value === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : null;
}

export function getSpotCoordinates(spot) {
  const latitude = toCoordinate(spot?.latitude ?? spot?.lat, -90, 90);
  const longitude = toCoordinate(spot?.longitude ?? spot?.lng, -180, 180);

  return latitude === null || longitude === null ? null : [latitude, longitude];
}

export function getMappableSpots(spots = []) {
  return spots.flatMap((spot) => {
    const position = getSpotCoordinates(spot);
    return position ? [{ spot, position }] : [];
  });
}
