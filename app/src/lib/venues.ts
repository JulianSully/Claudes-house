import { supabase } from "@/lib/supabase";
import type {
  AccessibilityFilters,
  AccessibilityNeed,
  Review,
  VenueWithSummary,
} from "@/types";

/**
 * Loads venues plus their aggregated accessibility/verification data.
 *
 * The summaries live in views, which PostgREST can't embed via a FK, so we
 * fetch them separately and merge by venue_id.
 */
export async function fetchVenues(region?: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}): Promise<VenueWithSummary[]> {
  let query = supabase.from("venues").select("*").limit(200);

  if (region) {
    query = query
      .gte("latitude", region.latitude - region.latitudeDelta)
      .lte("latitude", region.latitude + region.latitudeDelta)
      .gte("longitude", region.longitude - region.longitudeDelta)
      .lte("longitude", region.longitude + region.longitudeDelta);
  }

  const { data: venues, error } = await query;
  if (error) throw error;
  if (!venues?.length) return [];

  const ids = venues.map((v) => v.id);
  const [summaries, verifications] = await Promise.all([
    supabase.from("venue_accessibility_summary").select("*").in("venue_id", ids),
    supabase.from("venue_verification_summary").select("*").in("venue_id", ids),
  ]);

  const summaryMap = new Map((summaries.data ?? []).map((s) => [s.venue_id, s]));
  const verificationMap = new Map(
    (verifications.data ?? []).map((v) => [v.venue_id, v]),
  );

  return venues.map((venue) => ({
    ...venue,
    summary: summaryMap.get(venue.id) ?? null,
    verification: verificationMap.get(venue.id) ?? null,
  }));
}

export async function fetchVenueById(id: string): Promise<VenueWithSummary | null> {
  const [venue, summary, verification] = await Promise.all([
    supabase.from("venues").select("*").eq("id", id).single(),
    supabase.from("venue_accessibility_summary").select("*").eq("venue_id", id).maybeSingle(),
    supabase.from("venue_verification_summary").select("*").eq("venue_id", id).maybeSingle(),
  ]);

  if (venue.error || !venue.data) return null;
  return {
    ...venue.data,
    summary: summary.data ?? null,
    verification: verification.data ?? null,
  };
}

export async function fetchReviews(venueId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*, profiles(full_name)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Review[]) ?? [];
}

/** Applies the user's active filters. A null summary field means "not reported". */
export function applyFilters(
  venues: VenueWithSummary[],
  filters: AccessibilityFilters,
  searchText: string,
): VenueWithSummary[] {
  const search = searchText.trim().toLowerCase();

  return venues.filter((venue) => {
    if (search) {
      const haystack = `${venue.name} ${venue.address ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.category && venue.category !== filters.category) return false;

    const s = venue.summary;
    if (filters.stepFreeEntrance && s?.step_free_entrance !== true) return false;
    if (filters.accessibleToilet && s?.accessible_toilet !== true) return false;
    if (filters.accessibleParking && s?.accessible_parking !== true) return false;
    if (filters.liftAvailable && s?.lift_available !== true) return false;
    if (filters.quietPeriods && s?.quiet_periods_available !== true) return false;

    return true;
  });
}

/**
 * Ranks venues against the user's stated accessibility needs so the profile
 * genuinely personalises what they see. Venues with no reviews sink to the
 * bottom rather than being hidden — someone has to review them first.
 */
export function personalisedScore(
  venue: VenueWithSummary,
  needs: AccessibilityNeed[],
): number {
  const s = venue.summary;
  if (!s || !s.review_count) return -1;

  let score = s.accessibility_score ?? 0;

  for (const need of needs) {
    switch (need) {
      case "wheelchair":
        if (s.step_free_entrance) score += 2;
        if (s.ramp_available) score += 1;
        if (s.wheelchair_space) score += 1;
        if (s.accessible_toilet) score += 1;
        if (s.lift_available) score += 0.5;
        break;
      case "mobility":
        if (s.step_free_entrance) score += 1.5;
        if (s.accessible_parking) score += 1;
        if (s.seating_accessible) score += 1;
        if (s.lift_available) score += 0.5;
        break;
      case "visual":
        if (s.staff_helpfulness_rating && s.staff_helpfulness_rating >= 4) score += 1.5;
        if (s.lighting_level === "bright") score += 1;
        break;
      case "hearing":
        if (s.noise_level === "low") score += 1.5;
        if (s.staff_helpfulness_rating && s.staff_helpfulness_rating >= 4) score += 1;
        break;
      case "sensory":
        if (s.noise_level === "low") score += 2;
        if (s.quiet_periods_available) score += 1.5;
        if (s.lighting_level !== "bright") score += 0.5;
        break;
      case "other":
        break;
    }
  }

  // A small nudge for venues the community has confirmed recently.
  const confirmations = venue.verification?.confirmations_last_90_days ?? 0;
  score += Math.min(confirmations, 5) * 0.1;

  return score;
}

export function sortByPersonalisation(
  venues: VenueWithSummary[],
  needs: AccessibilityNeed[],
): VenueWithSummary[] {
  return [...venues].sort(
    (a, b) => personalisedScore(b, needs) - personalisedScore(a, needs),
  );
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
