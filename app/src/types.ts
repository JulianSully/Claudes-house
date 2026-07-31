export type AccessibilityNeed =
  | "wheelchair"
  | "mobility"
  | "visual"
  | "hearing"
  | "sensory"
  | "other";

export type VenueCategory =
  | "restaurant"
  | "cafe"
  | "hotel"
  | "shop"
  | "attraction"
  | "other";

export type SensoryLevel = "low" | "medium" | "high";
export type LightingLevel = "dim" | "moderate" | "bright";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  accessibility_needs: AccessibilityNeed[];
  is_premium: boolean;
  stripe_customer_id: string | null;
}

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  description: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  claimed: boolean;
}

export interface AccessibilitySummary {
  venue_id: string;
  review_count: number;
  accessibility_score: number | null;
  step_free_entrance: boolean | null;
  ramp_available: boolean | null;
  automatic_doors: boolean | null;
  door_width_rating: number | null;
  accessible_parking: boolean | null;
  parking_distance_m: number | null;
  wheelchair_space: boolean | null;
  lift_available: boolean | null;
  seating_accessible: boolean | null;
  accessible_toilet: boolean | null;
  bathroom_rating: number | null;
  noise_level: SensoryLevel | null;
  lighting_level: LightingLevel | null;
  quiet_periods_available: boolean | null;
  staff_helpfulness_rating: number | null;
  last_reviewed_at: string | null;
}

export interface VerificationSummary {
  venue_id: string;
  last_verified_at: string | null;
  confirmations_last_90_days: number;
}

/** A venue joined with its aggregated accessibility + verification data. */
export interface VenueWithSummary extends Venue {
  summary: AccessibilitySummary | null;
  verification: VerificationSummary | null;
}

export interface Review {
  id: string;
  venue_id: string;
  user_id: string;
  overall_accessibility_rating: number;
  comment: string | null;
  step_free_entrance: boolean | null;
  ramp_available: boolean | null;
  automatic_doors: boolean | null;
  door_width_rating: number | null;
  accessible_parking: boolean | null;
  parking_distance_m: number | null;
  wheelchair_space: boolean | null;
  lift_available: boolean | null;
  seating_accessible: boolean | null;
  accessible_toilet: boolean | null;
  bathroom_rating: number | null;
  noise_level: SensoryLevel | null;
  lighting_level: LightingLevel | null;
  quiet_periods_available: boolean | null;
  quiet_periods_notes: string | null;
  staff_helpfulness_rating: number | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Shared contract between the native map and its web fallback. */
export interface VenueMapProps {
  region: Region;
  venues: VenueWithSummary[];
  onSelectVenue: (venue: VenueWithSummary) => void;
  onRegionChange?: (region: Region) => void;
}

/** Filters the user can apply on the map screen. */
export interface AccessibilityFilters {
  stepFreeEntrance: boolean;
  accessibleToilet: boolean;
  accessibleParking: boolean;
  liftAvailable: boolean;
  quietPeriods: boolean;
  category: VenueCategory | null;
}

export const EMPTY_FILTERS: AccessibilityFilters = {
  stepFreeEntrance: false,
  accessibleToilet: false,
  accessibleParking: false,
  liftAvailable: false,
  quietPeriods: false,
  category: null,
};

export const ACCESSIBILITY_NEED_LABELS: Record<AccessibilityNeed, string> = {
  wheelchair: "Wheelchair access",
  mobility: "Mobility assistance",
  visual: "Visual impairment",
  hearing: "Hearing impairment",
  sensory: "Sensory needs",
  other: "Other",
};

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  hotel: "Hotel",
  shop: "Shop",
  attraction: "Attraction",
  other: "Other",
};
