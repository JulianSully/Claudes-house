import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing } from "@/lib/theme";
import { formatRelativeDate, titleCase, yesNo } from "@/lib/format";
import type { Review } from "@/types";

export function ReviewItem({
  review,
  onChanged,
}: {
  review: Review;
  onChanged?: () => void;
}) {
  const { session } = useAuth();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const loadLikes = useCallback(async () => {
    const { count } = await supabase
      .from("review_likes")
      .select("id", { count: "exact", head: true })
      .eq("review_id", review.id);
    setLikeCount(count ?? 0);

    if (session?.user) {
      const { data } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", review.id)
        .eq("user_id", session.user.id)
        .maybeSingle();
      setLiked(Boolean(data));
    }
  }, [review.id, session]);

  useEffect(() => {
    loadLikes();
  }, [loadLikes]);

  async function toggleLike() {
    if (!session?.user) return;
    try {
      if (liked) {
        await supabase
          .from("review_likes")
          .delete()
          .eq("review_id", review.id)
          .eq("user_id", session.user.id);
      } else {
        await supabase
          .from("review_likes")
          .insert({ review_id: review.id, user_id: session.user.id });
      }
      await loadLikes();
    } catch (err) {
      Alert.alert("Something went wrong", (err as Error).message);
    }
  }

  function report() {
    if (!session?.user) return;
    Alert.alert(
      "Report this review",
      "Let us know why this information looks inaccurate.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Out of date",
          onPress: () => submitReport("Out of date"),
        },
        {
          text: "Inaccurate",
          onPress: () => submitReport("Inaccurate"),
        },
      ],
    );
  }

  async function submitReport(reason: string) {
    if (!session?.user) return;
    const { error } = await supabase
      .from("review_reports")
      .insert({ review_id: review.id, reporter_id: session.user.id, reason });
    if (error) {
      Alert.alert("Couldn't report", error.message);
    } else {
      Alert.alert("Thanks", "We'll take a look at this review.");
      onChanged?.();
    }
  }

  const highlights = [
    review.step_free_entrance !== null
      ? `Step-free: ${yesNo(review.step_free_entrance)}`
      : null,
    review.accessible_toilet !== null
      ? `Accessible toilet: ${yesNo(review.accessible_toilet)}`
      : null,
    review.noise_level ? `Noise: ${titleCase(review.noise_level)}` : null,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>{review.profiles?.full_name ?? "Anonymous"}</Text>
        <Text
          style={styles.rating}
          accessibilityLabel={`Rated ${review.overall_accessibility_rating} out of 5 for accessibility`}
        >
          {review.overall_accessibility_rating}/5
        </Text>
      </View>

      <Text style={styles.date}>{formatRelativeDate(review.created_at)}</Text>

      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

      {highlights.length ? (
        <View style={styles.highlights}>
          {highlights.map((h) => (
            <Text key={h} style={styles.highlight}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}

      {review.quiet_periods_notes ? (
        <Text style={styles.notes}>Quiet times: {review.quiet_periods_notes}</Text>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          onPress={toggleLike}
          accessibilityRole="button"
          accessibilityLabel={
            liked ? "Remove your helpful mark" : "Mark this review as helpful"
          }
          accessibilityState={{ selected: liked }}
          style={styles.footerButton}
        >
          <Text style={[styles.footerText, liked && styles.footerTextActive]}>
            {liked ? "✓ Helpful" : "Helpful"} ({likeCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={report}
          accessibilityRole="button"
          accessibilityLabel="Report inaccurate information"
          style={styles.footerButton}
        >
          <Text style={styles.footerText}>Report</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  author: { fontWeight: "700", fontSize: 15, color: colors.text, flex: 1 },
  rating: { fontWeight: "700", fontSize: 15, color: colors.primary },
  date: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  comment: { color: colors.text, fontSize: 15, marginTop: spacing.sm, lineHeight: 21 },
  highlights: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  highlight: {
    fontSize: 13,
    color: colors.textMuted,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  notes: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, fontStyle: "italic" },
  footer: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  footerButton: { minHeight: 44, justifyContent: "center", paddingRight: spacing.sm },
  footerText: { color: colors.textMuted, fontSize: 14, fontWeight: "500" },
  footerTextActive: { color: colors.primary },
});
