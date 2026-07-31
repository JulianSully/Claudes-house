import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button, Chip, EmptyState, SectionTitle } from "@/components/ui";
import { VenueCard } from "@/components/VenueCard";
import { colors, radius, spacing } from "@/lib/theme";
import {
  ACCESSIBILITY_NEED_LABELS,
  type AccessibilityNeed,
  type VenueWithSummary,
} from "@/types";
import type { TabScreenProps } from "@/navigation";

const NEEDS = Object.keys(ACCESSIBILITY_NEED_LABELS) as AccessibilityNeed[];

type Props = TabScreenProps<"Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { profile, session, isPremium, signOut, updateNeeds } = useAuth();
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<VenueWithSummary[]>([]);

  const loadFavorites = useCallback(async () => {
    if (!session?.user || !isPremium) {
      setFavorites([]);
      return;
    }
    const { data } = await supabase
      .from("favorites")
      .select("venues(*)")
      .eq("user_id", session.user.id);

    const venues = (data ?? [])
      .map((row: { venues: unknown }) => row.venues as VenueWithSummary | null)
      .filter(Boolean) as VenueWithSummary[];
    setFavorites(venues.map((v) => ({ ...v, summary: null, verification: null })));
  }, [session, isPremium]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadFavorites);
    return unsubscribe;
  }, [navigation, loadFavorites]);

  async function toggleNeed(need: AccessibilityNeed) {
    const current = profile?.accessibility_needs ?? [];
    const next = current.includes(need)
      ? current.filter((n) => n !== need)
      : [...current, need];
    setSaving(true);
    try {
      await updateNeeds(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.name} accessibilityRole="header">
          {profile?.full_name || "Your profile"}
        </Text>
        <Text style={styles.email}>{session?.user?.email}</Text>

        <View style={[styles.badge, isPremium ? styles.badgePremium : styles.badgeFree]}>
          <Text style={styles.badgeText}>{isPremium ? "Premium" : "Free plan"}</Text>
        </View>

        <SectionTitle>Your accessibility needs</SectionTitle>
        <Text style={styles.hint}>
          We use these to rank venues that suit you. Tap to change them at any time.
        </Text>
        <View style={styles.chips}>
          {NEEDS.map((need) => (
            <Chip
              key={need}
              label={ACCESSIBILITY_NEED_LABELS[need]}
              selected={(profile?.accessibility_needs ?? []).includes(need)}
              onPress={() => toggleNeed(need)}
            />
          ))}
        </View>
        {saving ? <Text style={styles.hint}>Saving…</Text> : null}

        <SectionTitle>Saved places</SectionTitle>
        {!isPremium ? (
          <View>
            <Text style={styles.hint}>
              Saving favourite places is a Premium feature.
            </Text>
            <Button
              variant="secondary"
              title="See Premium"
              onPress={() => navigation.navigate("Paywall")}
              style={styles.spaced}
            />
          </View>
        ) : favorites.length === 0 ? (
          <EmptyState message="You haven't saved any places yet." />
        ) : (
          favorites.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onPress={() => navigation.navigate("VenueDetail", { venueId: venue.id })}
            />
          ))
        )}

        <SectionTitle>Account</SectionTitle>
        {!isPremium ? (
          <Button
            title="Upgrade to Premium"
            onPress={() => navigation.navigate("Paywall")}
            style={styles.spaced}
          />
        ) : null}
        <Button
          variant="secondary"
          title="Sign out"
          onPress={signOut}
          style={styles.spaced}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  name: { fontSize: 26, fontWeight: "800", color: colors.text },
  email: { fontSize: 15, color: colors.textMuted, marginTop: 2 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  badgePremium: { backgroundColor: colors.primary },
  badgeFree: { backgroundColor: colors.textMuted },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  spaced: { marginTop: spacing.sm },
});
