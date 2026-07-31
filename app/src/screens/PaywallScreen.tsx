import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const BENEFITS = [
  "Personalised recommendations based on your access needs",
  "Advanced accessibility filters",
  "Save favourite places",
  "AI accessibility assistant",
  "Trip planning",
  "Offline access to saved locations",
];

export function PaywallScreen() {
  const { isPremium, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  async function startCheckout() {
    setBusy(true);
    try {
      const redirectUrl = Linking.createURL("/subscription");
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { successUrl: redirectUrl, cancelUrl: redirectUrl },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned.");

      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      // The webhook is the source of truth; re-read the profile once we're back.
      await refreshProfile();
    } catch (err) {
      Alert.alert("Couldn't start checkout", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          AccessMap Premium
        </Text>
        <Text style={styles.price}>$14.99 / month</Text>

        <View style={styles.card}>
          {BENEFITS.map((benefit) => (
            <Text key={benefit} style={styles.benefit}>
              ✓ {benefit}
            </Text>
          ))}
        </View>

        <Text style={styles.freeNote}>
          Browsing venues, reading reviews, leaving your own reviews and basic filters
          are always free.
        </Text>

        {isPremium ? (
          <View style={styles.activeBox} accessibilityRole="text">
            <Text style={styles.activeText}>You're a Premium member — thank you!</Text>
          </View>
        ) : (
          <Button
            title="Subscribe"
            onPress={startCheckout}
            loading={busy}
            style={styles.button}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  price: { fontSize: 20, fontWeight: "700", color: colors.primary, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  benefit: { fontSize: 16, color: colors.text, lineHeight: 22 },
  freeNote: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  button: { marginTop: spacing.lg },
  activeBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  activeText: { color: "#fff", fontWeight: "700", fontSize: 16, textAlign: "center" },
});
