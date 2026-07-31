import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/lib/theme";
import type { VenueMapProps } from "@/types";

// Web/fallback implementation. Metro resolves `VenueMap.native.tsx` on iOS and
// Android, so react-native-maps (which has no web build) is never bundled here.
// The Map tab falls back to the list view on web.
export function VenueMap(_props: VenueMapProps) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>
        The interactive map is available in the iOS and Android apps. Use the list view
        to browse venues here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  fallbackText: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
});
