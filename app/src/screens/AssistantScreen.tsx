import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button, EmptyState } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import type { TabScreenProps } from "@/navigation";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Find me a wheelchair accessible restaurant nearby",
  "Can I take my mobility scooter here?",
  "Find a hotel suitable for someone with sensory sensitivities",
];

type Props = TabScreenProps<"Assistant">;

export function AssistantScreen({ navigation }: Props) {
  const { isPremium } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.locked}>
          <Text style={styles.lockedTitle} accessibilityRole="header">
            AI accessibility assistant
          </Text>
          <Text style={styles.lockedText}>
            Ask questions in plain language and get recommendations based on real
            accessibility reports from the community. Available with Premium.
          </Text>
          <Button title="See Premium" onPress={() => navigation.navigate("Paywall")} />
        </View>
      </SafeAreaView>
    );
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: question },
    ]);
    setBusy(true);

    try {
      let coords: { latitude?: number; longitude?: number } = {};
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const position = await Location.getCurrentPositionAsync({});
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      }

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { message: question, ...coords },
      });
      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data?.reply ?? "Sorry, I couldn't answer that.",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Something went wrong: ${(err as Error).message}`,
        },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View>
              <EmptyState message="Ask me anything about accessibility at venues near you." />
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="secondary"
                  title={s}
                  onPress={() => send(s)}
                  style={styles.suggestion}
                />
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
              accessible
              accessibilityLabel={`${item.role === "user" ? "You" : "Assistant"}: ${item.content}`}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === "user" && styles.bubbleTextUser,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
        />

        {busy ? (
          <Text style={styles.thinking} accessibilityLiveRegion="polite">
            Thinking…
          </Text>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about accessibility…"
            accessibilityLabel="Your question"
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Button title="Send" onPress={() => send(input)} disabled={busy || !input.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  list: { padding: spacing.md },
  locked: { flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  lockedTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  lockedText: { fontSize: 16, color: colors.textMuted, lineHeight: 22 },
  suggestion: { marginTop: spacing.sm },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    maxWidth: "90%",
  },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  bubbleAssistant: { backgroundColor: colors.surface, alignSelf: "flex-start" },
  bubbleText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  bubbleTextUser: { color: "#fff" },
  thinking: { paddingHorizontal: spacing.md, color: colors.textMuted },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
    color: colors.text,
  },
});
