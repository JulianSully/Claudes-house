import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { colors } from "@/lib/theme";
import { scoreLabel } from "@/lib/format";
import { VENUE_CATEGORY_LABELS, type VenueMapProps } from "@/types";

export function VenueMap({
  region,
  venues,
  onSelectVenue,
  onRegionChange,
}: VenueMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_GOOGLE}
      initialRegion={region}
      onRegionChangeComplete={onRegionChange}
      showsUserLocation
      showsMyLocationButton
    >
      {venues.map((venue) => {
        const score = venue.summary?.accessibility_score ?? null;
        return (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
            title={venue.name}
            description={`${VENUE_CATEGORY_LABELS[venue.category]} · Accessibility ${scoreLabel(score)}`}
            pinColor={markerColor(score)}
            onCalloutPress={() => onSelectVenue(venue)}
          />
        );
      })}
    </MapView>
  );
}

function markerColor(score: number | null): string {
  if (score === null) return colors.textMuted;
  if (score >= 4) return colors.success;
  if (score >= 2.5) return colors.warning;
  return colors.danger;
}
