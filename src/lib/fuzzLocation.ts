/**
 * Privacy fuzz: offset a (lat, lng) by a random amount up to `radiusMeters`.
 * Default 1000m. Returns the new coordinates. Uses uniform-in-disk sampling.
 */
export function fuzzCoords(
  lat: number,
  lng: number,
  radiusMeters = 1000,
): { lat: number; lng: number } {
  const r = radiusMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const dLat = (r * Math.cos(theta)) / 111_320;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
  const dLng = (r * Math.sin(theta)) / (111_320 * cosLat);
  return { lat: lat + dLat, lng: lng + dLng };
}