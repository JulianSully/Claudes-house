import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { fetchReviews, fetchVenueById } from "@/lib/venues";
import { Button, Card, EmptyState, FactRow, Loading, SectionTitle } from "@/components/ui";
import { ReviewItem } from "@/components/ReviewItem";
import { colors, radius, spacing } from "@/lib/theme";
import { formatRelativeDate, scoreLabel, titleCase, verificationLabel, yesNo } from "@/lib/format";
import { VENUE_CATEGORY_LABELS, type Review, type VenueWithSummary } from "@/types";
import type { StackScreenProps } from "@/navigation";

type Props = StackScreenProps<"VenueDetail">;

export function VenueDetailScreen({ route, navigation }: Props) {
  const { venueId } = route.params;
  const { session, isPremium } = useAuth();
  const [venue, setVenue] = useState<VenueWithSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [venueData, reviewData] = await Promise.all([
        fetchVenueById(venueId),
        fetchReviews(venueId),
      ]);
      setVenue(venueData);
      setReviews(reviewData);

      if (session?.user) {
        const { data } = await supabase
          .from("favorites")
          .select("id")
          .eq("venue_id", venueId)
          .eq("user_id", session.user.id)
          .maybeSingle();
        setIsFavorite(Boolean(data));
      }
    } finally {
      setLoading(false);
    }
  }, [venueId, session]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", load);
    return unsubscribe;
  }, [navigation, load]);

  async function handleVerify() {
    if (!session?.user) return;
    setVerifying(true);
    try {
      const { error } = await supabase
        .from("verifications")
        .insert({ venue_id: venueId, user_id: session.user.id });
      if (error) throw error;
      Alert.alert("Thank you", "Your confirmation helps other people trust this listing.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't confirm", (err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function toggleFavorite() {
    if (!session?.user) return;
    if (!isPremium) {
      navigation.navigate("Paywall");
      return;
    }
    try {
      if (isFavorite) {
        await supabase
          .from("favorites")
          .delete()
          .eq("venue_id", venueId)
          .eq("user_id", session.user.id);
        setIsFavorite(false);
      } else {
        await supabase
          .from("favorites")
          .insert({ venue_id: venueId, user_id: session.user.id });
        setIsFavorite(true);
      }
    } catch (err) {
      Alert.alert("Something went wrong", (err as Error).message);
    }
  }

  if (loading) return <Loading label="Loading venue" />;
  if (!venue) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState message="This venue could not be found." />
      </SafeAreaView>
    );
  }

  const s = venue.summary;
  const confirmations = venue.verification?.confirmations_last_90_days ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.name} accessibilityRole="header">
          {venue.name}
        </Text>
        <Text style={styles.meta}>
          {VENUE_CATEGORY_LABELS[venue.category]}
          {venue.address ? ` · ${venue.address}` : ""}
        </Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreBox} accessible
            accessibilityLabel={
              s?.review_count
                ? `Accessibility score ${scoreLabel(s.accessibility_score)} out of 5, based on ${s.review_count} reviews`
                : "No accessibility score yet"
            }
          >
            <Text style={styles.scoreValue}>
              {s?.review_count ? scoreLabel(s.accessibility_score) : "—"}
            </Text>
            <Text style={styles.scoreCaption}>accessibility</Text>
          </View>
          <View style={styles.scoreMeta}>
            <Text style={styles.scoreMetaText}>
              {s?.review_count === 1 ? "1 review" : `${s?.review_count ?? 0} reviews`}
            </Text>
            <Text style={styles.scoreMetaText}>
              Last verified {formatRelativeDate(venue.verification?.last_verified_at)}
            </Text>
            <Text
              style={[styles.verified, !confirmations && styles.verifiedNone]}
              accessibilityRole="text"
            >
              {verificationLabel(confirmations)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Add your review"
            onPress={() => navigation.navigate("AddReview", { venueId })}
            style={styles.action}
          />
          <Button
            variant="secondary"
            title="Still accurate"
            accessibilityHint="Confirms this venue's accessibility information is still correct"
            onPress={handleVerify}
            loading={verifying}
            style={styles.action}
          />
        </View>

        <Button
          variant="secondary"
          title={isFavorite ? "★ Saved to favourites" : "☆ Save to favourites"}
          onPress={toggleFavorite}
        />

        {s?.review_count ? (
          <>
            <SectionTitle>Entrance</SectionTitle>
            <Card>
              <FactRow label="Step-free entrance" value={yesNo(s.step_free_entrance)} />
              <FactRow label="Ramp available" value={yesNo(s.ramp_available)} />
              <FactRow label="Automatic doors" value={yesNo(s.automatic_doors)} />
              <FactRow
                label="Door width"
                value={s.door_width_rating ? `${scoreLabel(s.door_width_rating)} / 5` : "Not reported"}
              />
            </Card>

            <SectionTitle>Parking</SectionTitle>
            <Card>
              <FactRow label="Accessible parking" value={yesNo(s.accessible_parking)} />
              <FactRow
                label="Distance from entrance"
                value={s.parking_distance_m !== null ? `${s.parking_distance_m} m` : "Not reported"}
              />
            </Card>

            <SectionTitle>Inside</SectionTitle>
            <Card>
              <FactRow label="Space to move a wheelchair" value={yesNo(s.wheelchair_space)} />
              <FactRow label="Lift available" value={yesNo(s.lift_available)} />
              <FactRow label="Accessible seating" value={yesNo(s.seating_accessible)} />
            </Card>

            <SectionTitle>Bathroom</SectionTitle>
            <Card>
              <FactRow label="Accessible toilet" value={yesNo(s.accessible_toilet)} />
              <FactRow
                label="Bathroom rating"
                value={s.bathroom_rating ? `${scoreLabel(s.bathroom_rating)} / 5` : "Not reported"}
              />
            </Card>

            <SectionTitle>Sensory</SectionTitle>
            <Card>
              <FactRow label="Noise level" value={titleCase(s.noise_level)} />
              <FactRow label="Lighting" value={titleCase(s.lighting_level)} />
              <FactRow label="Quiet periods" value={yesNo(s.quiet_periods_available)} />
            </Card>

            <SectionTitle>Staff</SectionTitle>
            <Card>
              <FactRow
                label="Staff helpfulness"
                value={
                  s.staff_helpfulness_rating
                    ? `${scoreLabel(s.staff_helpfulness_rating)} / 5`
                    : "Not reported"
                }
              />
            </Card>
          </>
        ) : (
          <Card style={styles.noData}>
            <Text style={styles.noDataText}>
              No accessibility information has been reported for this venue yet. If
              you've been here, your review would be the first — and genuinely useful to
              someone deciding whether they can visit.
            </Text>
          </Card>
        )}

        <SectionTitle>Community reviews</SectionTitle>
        {reviews.length === 0 ? (
          <EmptyState message="No reviews yet." />
        ) : (
          reviews.map((review) => (
            <ReviewItem key={review.id} review={review} onChanged={load} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  name: { fontSize: 26, fontWeight: "800", color: colors.text },
  meta: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  scoreBox: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  scoreValue: { color: "#fff", fontSize: 28, fontWeight: "800" },
  scoreCaption: { color: "#fff", fontSize: 12 },
  scoreMeta: { flex: 1, gap: 2 },
  scoreMetaText: { color: colors.textMuted, fontSize: 14 },
  verified: { color: colors.success, fontSize: 14, fontWeight: "600", marginTop: 2 },
  verifiedNone: { color: colors.textMuted, fontWeight: "400" },
  actions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  action: { flex: 1 },
  noData: { backgroundColor: colors.surface },
  noDataText: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
});
