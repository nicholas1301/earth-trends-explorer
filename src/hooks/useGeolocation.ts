import { useCallback, useState } from "react";

export type GeolocationStatus =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "found" }
  | { kind: "error"; message: string; canRetry: boolean };

/**
 * One-shot browser geolocation. The browser asks the user for permission first.
 * Resolves the position through `onFound`; failures become user-facing messages.
 */
export function useGeolocation(onFound: (lat: number, lon: number) => void) {
  const [status, setStatus] = useState<GeolocationStatus>({ kind: "idle" });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", canRetry: false, message: "This browser cannot share its location. Click the map or type the coordinates instead." });
      return;
    }
    if (!window.isSecureContext) {
      setStatus({ kind: "error", canRetry: false, message: "Location only works on a secure (https) page. Click the map or type the coordinates instead." });
      return;
    }
    setStatus({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onFound(pos.coords.latitude, pos.coords.longitude);
        setStatus({ kind: "found" });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus({ kind: "error", canRetry: false, message: "Permission denied — your location was not shared. Click the map or pick a place instead." });
        } else if (err.code === err.TIMEOUT) {
          setStatus({ kind: "error", canRetry: true, message: "Finding your location took too long." });
        } else {
          setStatus({ kind: "error", canRetry: false, message: "Your location could not be determined. Click the map or pick a place instead." });
        }
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }, [onFound]);

  const reset = useCallback(() => setStatus({ kind: "idle" }), []);

  return { status, locate, reset };
}
