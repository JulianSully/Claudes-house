import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, fullName.trim());
        setNotice(
          "Account created. If your project requires email confirmation, check your inbox before signing in.",
        );
        setMode("signin");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">
            AccessMap
          </Text>
          <Text style={styles.subtitle}>
            Find places you can confidently visit — rated for accessibility by people
            with lived experience.
          </Text>

          {mode === "signup" ? (
            <View style={styles.field}>
              <Text style={styles.label} nativeID="nameLabel">
                Your name
              </Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Alex Morgan"
                autoComplete="name"
                accessibilityLabelledBy="nameLabel"
                accessibilityLabel="Your name"
              />
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Password"
            />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}

          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={handleSubmit}
            loading={busy}
            style={styles.submit}
          />

          <Button
            variant="secondary"
            title={
              mode === "signin"
                ? "New here? Create an account"
                : "Already have an account? Sign in"
            }
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            style={styles.toggle}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: 32, fontWeight: "800", color: colors.primary },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  field: { marginBottom: spacing.md },
  label: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    minHeight: 48,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 15 },
  notice: { color: colors.success, marginBottom: spacing.md, fontSize: 15 },
  submit: { marginTop: spacing.sm },
  toggle: { marginTop: spacing.md },
});
