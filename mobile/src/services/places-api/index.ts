export type { ResolvedLocation } from "./types";
export {
  searchPlaces,
  placesApiConfigured,
  type PlaceSearchResult,
  type SearchOutcome,
} from "./client";
export { resolveCurrentLocation, type GpsOutcome } from "./gps";
export { bumpPlacesUsage, type UsageResult } from "./usage-guard";
