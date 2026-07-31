import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button, SectionTitle } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import type { LightingLevel, SensoryLevel } from "@/types";
import type { StackScreenProps } from "@/navigation";

type Props = StackScreenProps<"AddReview">;

type Tri = boolean | null;

export function AddReviewScreen({ route, navigation }: Props) {
  const { venueId } = route.params;
  const { session } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [stepFree, setStepFree] = useState<Tri>(null);
  const [ramp, setRamp] = useState<Tri>(null);
  const [autoDoors, setAutoDoors] = useState<Tri>(null);
  const [doorWidth, setDoorWidth] = useState(0);

  const [parking, setParking] = useState<Tri>(null);
  const [parkingDistance, setParkingDistance] = useState("");

  const [wheelchairSpace, setWheelchairSpace] = useState<Tri>(null);
  const [lift, setLift] = useState<Tri>(null);
  const [seating, setSeating] = useState<Tri>(null);

  const [toilet, setToilet] = useState<Tri>(null);
  const [bathroomRating, setBathroomRating] = useState(0);

  const [noise, setNoise] = useState<SensoryLevel | null>(null);
  const [lighting, setLighting] = useState<LightingLevel | null>(null);
  const [quietPeriods, setQuietPeriods] = useState<Tri>(null);
  const [quietNotes, setQuietNotes] = useState("");

  const [staff, setStaff] = useState(0);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!session?.user) return;
    if (rating < 1) {
      Alert.alert("Rating required", "Please give an overall accessibility rating.");
      return;
    }

    const parsedDistance = parkingDistance.trim() ? Number(parkingDistance) : null;
    if (parsedDistance !== null && (!Number.isFinite(parsedDistance) || parsedDistance < 0)) {
      Alert.alert("Check parking distance", "Enter the distance in metres, e.g. 50.");
      return;
    }

    setBusy(true);
    try {
      // One review per user per venue — upsert so editing works naturally.
      const { error } = await supabase.from("reviews").upsert(
        {
          venue_id: venueId,
          user_id: session.user.id,
          overall_accessibility_rating: rating,
          comment: comment.trim() || null,
          step_free_entrance: stepFree,
          ramp_available: ramp,
          automatic_doors: autoDoors,
          door_width_rating: doorWidth || null,
          accessible_parking: parking,
          parking_distance_m: parsedDistance,
          wheelchair_space: wheelchairSpace,
          lift_available: lift,
          seating_accessible: seating,
          accessible_toilet: toilet,
          bathroom_rating: bathroomRating || null,
          noise_level: noise,
          lighting_level: lighting,
          quiet_periods_available: quietPeriods,
          quiet_periods_notes: quietNotes.trim() || null,
          staff_helpfulness_rating: staff || null,
        },
        { onConflict: "venue_id,user_id" },
      );
      if (error) throw error;
      navigation.goBack();
    } catch (err) {
      Alert.alert("Couldn't save review", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Focus on accessibility rather than food or service — that's what makes these
          reviews useful to other people.
        </Text>

        <SectionTitle>Overall accessibility</SectionTitle>
        <Stars value={rating} onChange={setRating} label="Overall accessibility rating" />

        <SectionTitle>Entrance</SectionTitle>
        <TriRow label="Step-free entrance?" value={stepFree} onChange={setStepFree} />
        <TriRow label="Ramp available?" value={ramp} onChange={setRamp} />
        <TriRow label="Automatic doors?" value={autoDoors} onChange={setAutoDoors} />
        <Text style={styles.label}>Door width</Text>
        <Stars value={doorWidth} onChange={setDoorWidth} label="Door width rating" />

        <SectionTitle>Parking</SectionTitle>
        <TriRow label="Accessible parking?" value={parking} onChange={setParking} />
        <Text style={styles.label}>Distance from entrance (metres)</Text>
        <TextInput
          style={styles.input}
          value={parkingDistance}
          onChangeText={setParkingDistance}
          keyboardType="number-pad"
          placeholder="e.g. 50"
          accessibilityLabel="Distance from entrance in metres"
        />

        <SectionTitle>Inside</SectionTitle>
        <TriRow
          label="Space to move a wheelchair?"
          value={wheelchairSpace}
          onChange={setWheelchairSpace}
        />
        <TriRow label="Lift available?" value={lift} onChange={setLift} />
        <TriRow label="Accessible seating?" value={seating} onChange={setSeating} />

        <SectionTitle>Bathroom</SectionTitle>
        <TriRow label="Accessible toilet?" value={toilet} onChange={setToilet} />
        <Text style={styles.label}>Bathroom rating</Text>
        <Stars value={bathroomRating} onChange={setBathroomRating} label="Bathroom rating" />

        <SectionTitle>Sensory</SectionTitle>
        <Text style={styles.label}>Noise level</Text>
        <OptionRow
          options={["low", "medium", "high"] as SensoryLevel[]}
          value={noise}
          onChange={setNoise}
        />
        <Text style={styles.label}>Lighting</Text>
        <OptionRow
          options={["dim", "moderate", "bright"] as LightingLevel[]}
          value={lighting}
          onChange={setLighting}
        />
        <TriRow label="Quiet periods available?" value={quietPeriods} onChange={setQuietPeriods} />
        <TextInput
          style={styles.input}
          value={quietNotes}
          onChangeText={setQuietNotes}
          placeholder="When is it quietest?"
          accessibilityLabel="Notes about quiet periods"
        />

        <SectionTitle>Staff</SectionTitle>
        <Text style={styles.label}>How helpful were staff with access needs?</Text>
        <Stars value={staff} onChange={setStaff} label="Staff helpfulness rating" />

        <SectionTitle>Anything else?</SectionTitle>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={comment}
          onChangeText={setComment}
          placeholder="Describe what someone should expect when they arrive."
          multiline
          accessibilityLabel="Additional comments"
        />

        <Button title="Submit review" onPress={submit} loading={busy} style={styles.submit} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TriRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Tri;
  onChange: (value: Tri) => void;
}) {
  const options: { key: string; label: string; val: Tri }[] = [
    { key: "yes", label: "Yes", val: true },
    { key: "no", label: "No", val: false },
    { key: "unknown", label: "Not sure", val: null },
  ];

  return (
    <View style={styles.triRow}>
      <Text style={styles.triLabel}>{label}</Text>
      <View style={styles.triOptions}>
        {options.map((option) => {
          const selected = value === option.val;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.val)}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityState={{ selected }}
              style={[styles.triOption, selected && styles.triOptionSelected]}
            >
              <Text style={[styles.triOptionText, selected && styles.triOptionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.triOptions}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityLabel={option}
            accessibilityState={{ selected }}
            style={[styles.triOption, selected && styles.triOptionSelected]}
          >
            <Text style={[styles.triOptionText, selected && styles.triOptionTextSelected]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <View style={styles.stars} accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityLabel={`${n} out of 5`}
          accessibilityState={{ selected: value === n }}
          style={[styles.star, value >= n && styles.starActive]}
        >
          <Text style={[styles.starText, value >= n && styles.starTextActive]}>{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  label: { fontSize: 15, color: colors.text, marginTop: spacing.sm, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
    color: colors.text,
    marginTop: 6,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  triRow: { marginTop: spacing.sm },
  triLabel: { fontSize: 15, color: colors.text, marginBottom: 6 },
  triOptions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  triOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  triOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  triOptionText: { color: colors.text, fontSize: 15 },
  triOptionTextSelected: { color: "#fff", fontWeight: "600" },
  stars: { flexDirection: "row", gap: spacing.sm, marginTop: 6 },
  star: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  starActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  starText: { color: colors.text, fontWeight: "600" },
  starTextActive: { color: "#fff" },
  submit: { marginTop: spacing.lg },
});
