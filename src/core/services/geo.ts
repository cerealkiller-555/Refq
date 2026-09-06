// ============================================================
// رِفق — موقع المستخدم (بلا انهيار أبدًا)
// getCoordinates: يُرجع null عند الرفض/الغياب/المهلة — المتصل يقرر الـfallback.
// ============================================================

export interface Coordinates {
  lat: number;
  lon: number;
}

const TIMEOUT_MS = 8000;
const MAX_AGE_MS = 10 * 60 * 1000;

export function getCoordinates(): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS }
    );
  });
}