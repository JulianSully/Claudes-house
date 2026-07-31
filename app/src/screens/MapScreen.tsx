import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAuth } from "@/context/AuthContext";
import { Chip, EmptyState, Loading } from "@/components/ui";
import { VenueCard } from "@/components/VenueCard";
import { VenueMap } from "@/components/VenueMap";
import {
  applyFilters,
  distanceKm,
  fetchVenues,
  sortByPersonalisation,
} from "@/lib/venues";
import { colors, radius, spacing } from "@/lib/theme";
import {
  EMPTY_FILTERS,
  VENUE_CATEGORY_LABELS,
  type AccessibilityFilters,
  type Region,
  type VenueCategory,
  type VenueWithSummary,
} from "@/types";
import type { TabScreenProps } from "@/navigation";

const DEFAULT_REGION: Region = {
  latitude: 37.7793,
  longitude: -122.4193,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Free users get the two basic filters; the rest are premium.
const PREMIUM_FILTER_KEYS = [
  "accessibleParking",
  "liftAvailable",
  "quietPeriods",
] as const satisfies readonly (keyof AccessibilityFilters)[];

type Props = TabScreenProps<"Map">;

export function MapScreen({ navigation }: Props) {
  const { profile, isPremium } = useAuth();
  const [venues, setVenues] = useState<VenueWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AccessibilityFilters>(EMPTY_FILTERS);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [view, setView] = useState<"list" | "map">(
    Platform.OS === "web" ? "list" : "map",
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const position = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(coords);
        setRegion((prev) => ({ ...prev, ...coords }));
      } catch {
        // Location is optional — fall back to the default region.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVenues(await fetchVenues());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleVenues = useMemo(() => {
    const filtered = applyFilters(venues, filters, search);
    return sortByPersonalisation(filtered, profile?.accessibility_needs ?? []);
  }, [venues, filters, search, profile]);

  function toggleFilter(key: keyof AccessibilityFilters) {
    if (
      (PREMIUM_FILTER_KEYS as readonly string[]).includes(key as string) &&
      !isPremium
    ) {
      navigation.navigate("Paywall");
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function selectCategory(category: VenueCategory) {
    setFilters((prev) => ({
      ...prev,
      category: prev.category === category ? null : category,
    }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search venues or addresses"
          accessibilityLabel="Search venues"
          returnKeyType="search"
        />
        <Pressable
          onPress={() => setView(view === "map" ? "list" : "map")}
          accessibilityRole="button"
          accessibilityLabel={view === "map" ? "Show list view" : "Show map view"}
          style={styles.viewToggle}
        >
          <Text style={styles.viewToggleText}>{view === "map" ? "List" : "Map"}</Text>
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Chip
              label={
                (PREMIUM_FILTER_KEYS as readonly string[]).includes(item.key) && !isPremium
                  ? `${item.label} ★`
                  : item.label
              }
              selected={Boolean(filters[item.key])}
              onPress={() => toggleFilter(item.key)}
            />
          )}
        />
      </View>

      <View style={styles.categoryBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={Object.keys(VENUE_CATEGORY_LABELS) as VenueCategory[]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Chip
              label={VENUE_CATEGORY_LABELS[item]}
              selected={filters.category === item}
              onPress={() => selectCategory(item)}
            />
          )}
        />
      </View>

      {loading ? (
        <Loading label="Loading venues" />
      ) : error ? (
        <EmptyState message={`Couldn't load venues: ${error}`} />
      ) : view === "map" ? (
        <View style={styles.mapWrap}>
          <VenueMap
            region={region}
            venues={visibleVenues}
            onSelectVenue={(venue) =>
              navigation.navigate("VenueDetail", { venueId: venue.id })
            }
            onRegionChange={setRegion}
          />
        </View>
      ) : (
        <FlatList
          data={visibleVenues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <EmptyState message="No venues match these filters. Try removing a filter or widening your search." />
          }
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {visibleVenues.length}{" "}
              {visibleVenues.length === 1 ? "venue" : "venues"}
              {profile?.accessibility_needs?.length ? " · sorted for your needs" : ""}
            </Text>
          }
          renderItem={({ item }) => (
            <VenueCard
              venue={item}
              distanceKm={userLocation ? distanceKm(userLocation, item) : undefined}
              onPress={() => navigation.navigate("VenueDetail", { venueId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const FILTER_OPTIONS: { key: keyof AccessibilityFilters; label: string }[] = [
  { key: "stepFreeEntrance", label: "Step-free" },
  { key: "accessibleToilet", label: "Accessible toilet" },
  { key: "accessibleParking", label: "Accessible parking" },
  { key: "liftAvailable", label: "Lift" },
  { key: "quietPeriods", label: "Quiet periods" },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  search: {
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
  viewToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: "center",
  },
  viewToggleText: { color: "#fff", fontWeight: "600" },
  filterBar: { paddingTop: spacing.sm },
  categoryBar: {},
  filterList: { paddingHorizontal: spacing.md },
  mapWrap: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  resultCount: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
