// Haversine distance between two lat/lng points in km
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Approximate distance from a PIN code using a small lookup table of Indian PIN centroids.
// In production this would use the Google Geocoding API.
const PIN_CENTROIDS: Record<string, { lat: number; lng: number; label: string }> = {
  '532440': { lat: 16.9034, lng: 82.0175, label: 'Amalapuram, Andhra Pradesh' },
  '533001': { lat: 16.9890, lng: 82.2470, label: 'Kakinada, Andhra Pradesh' },
  '500001': { lat: 17.3850, lng: 78.4867, label: 'Hyderabad, Telangana' },
  '600001': { lat: 13.0827, lng: 80.2707, label: 'Chennai, Tamil Nadu' },
  '110001': { lat: 28.6139, lng: 77.2090, label: 'New Delhi' },
  '400001': { lat: 18.9433, lng: 72.8234, label: 'Mumbai, Maharashtra' },
  '700001': { lat: 22.5726, lng: 88.3639, label: 'Kolkata, West Bengal' },
  '560001': { lat: 12.9716, lng: 77.5946, label: 'Bengaluru, Karnataka' },
  '411001': { lat: 18.5204, lng: 73.8567, label: 'Pune, Maharashtra' },
};

export function getPinCentroid(pin: string): { lat: number; lng: number; label: string } | null {
  return PIN_CENTROIDS[pin] ?? null;
}

export function getAllPinCentroids() {
  return PIN_CENTROIDS;
}

export function estimateWalkTime(km: number): number {
  return Math.max(1, Math.round((km / 5) * 60));
}

export function estimateDriveTime(km: number): number {
  return Math.max(1, Math.round((km / 30) * 60));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
