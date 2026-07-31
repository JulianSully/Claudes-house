import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Button, Chip } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import { ACCESSIBILITY_NEED_LABELS, type AccessibilityNeed } from "@/types";

const NEEDS = Object.keys(ACCESSIBILITY_NEED_LABELS) as AccessibilityNeed[];

export function NeedsOnboardingScreen({ onDone }: { onDone?: () => void }) {
  const { profile, updateNeeds } = useAuth();
  const [selected, setSelected] = useState<AccessibilityNeed[]>(
    profile?.accessibility_needs ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(need: AccessibilityNeed) {
    setSelected((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need],
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateNeeds(selected);
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          What should we look out for?
        </Text>
        <Text style={styles.subtitle}>
          Pick everything that applies. We use this to rank venues that suit you and to
          highlight the details that matter most. You can change this any time.
        </Text>

        <View style={styles.chips}>
          {NEEDS.map((need) => (
            <Chip
              key={need}
              label={ACCESSIBILITY_NEED_LABELS[need]}
              selected={selected.includes(need)}
              onPress={() => toggle(need)}
            />
          ))}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button
          title={selected.length ? "Save and continue" : "Skip for now"}
          onPress={save}
          loading={busy}
          style={styles.button}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 15 },
  button: { marginTop: spacing.lg },
});
