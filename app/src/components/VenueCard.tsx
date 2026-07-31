import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/lib/theme";
import { formatRelativeDate, scoreLabel } from "@/lib/format";
import { VENUE_CATEGORY_LABELS, type VenueWithSummary } from "@/types";

export function VenueCard({
  venue,
  onPress,
  distanceKm,
}: {
  venue: VenueWithSummary;
  onPress: () => void;
  distanceKm?: number;
}) {
  const summary = venue.summary;
  const reviewCount = summary?.review_count ?? 0;
  const confirmations = venue.verification?.confirmations_last_90_days ?? 0;

  const a11yLabel = [
    venue.name,
    VENUE_CATEGORY_LABELS[venue.category],
    reviewCount
      ? `accessibility score ${scoreLabel(summary?.accessibility_score)} out of 5 from ${reviewCount} reviews`
      : "no accessibility reviews yet",
    confirmations ? `verified by ${confirmations} people recently` : null,
    distanceKm !== undefined ? `${distanceKm.toFixed(1)} kilometres away` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens the full accessibility profile"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {venue.name}
        </Text>
        <View style={[styles.scorePill, !reviewCount && styles.scorePillEmpty]}>
          <Text style={styles.scoreText}>
            {reviewCount ? scoreLabel(summary?.accessibility_score) : "—"}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {VENUE_CATEGORY_LABELS[venue.category]}
        {distanceKm !== undefined ? ` · ${distanceKm.toFixed(1)} km` : ""}
      </Text>

      {venue.address ? (
        <Text style={styles.address} numberOfLines={1}>
          {venue.address}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {reviewCount === 1 ? "1 review" : `${reviewCount} reviews`}
        </Text>
        <Text style={styles.footerText}>
          Verified {formatRelativeDate(venue.verification?.last_verified_at)}
        </Text>
      </View>

      {confirmations > 0 ? (
        <Text style={styles.verified}>
          ✓ Confirmed by {confirmations} {confirmations === 1 ? "person" : "people"} in
          the last 90 days
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.text },
  scorePill: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: "center",
  },
  scorePillEmpty: { backgroundColor: colors.textMuted },
  scoreText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  address: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  footerText: { color: colors.textMuted, fontSize: 13 },
  verified: { color: colors.success, fontSize: 13, marginTop: 6, fontWeight: "600" },
});
