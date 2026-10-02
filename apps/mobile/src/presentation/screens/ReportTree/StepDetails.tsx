import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, typography, spacing, radii, shadows } from "../../theme/index";
import { useTreeDraftStore, type PlantingContextType } from "../../../application/useTreeDraftStore";
import { acquireDeviceGps, LocationError } from "../../../domain/location.service";
import { apiClient } from "../../../data/api/api-client";
import type { ReportTreeParamList } from "../../navigation/types";

interface SpeciesItem {
  id: string;
  commonName: string;
  scientificName: string;
  aliases: string[];
}

const CONTEXT_OPTIONS: { label: string; value: PlantingContextType }[] = [
  { label: "Backyard", value: "BACKYARD" },
  { label: "Community Garden", value: "COMMUNITY_GARDEN" },
  { label: "Park", value: "PARK" },
  { label: "Farmland", value: "FARMLAND" },
  { label: "Forest", value: "FOREST" },
  { label: "Roadside", value: "ROADSIDE" },
  { label: "Other", value: "OTHER" },
];

export const StepDetails: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ReportTreeParamList, "StepDetails">>();
  const {
    speciesId,
    speciesName,
    scientificName,
    plantedAt,
    latitude,
    longitude,
    locationAccuracy,
    locationName,
    context,
    notes,
    setSpecies,
    setPlantedAt,
    setLocation,
    setLocationName,
    setContext,
    setNotes,
    setStep,
  } = useTreeDraftStore();

  useFocusEffect(
    useCallback(() => {
      setStep(1);
    }, [setStep])
  );

  const [speciesList, setSpeciesList] = useState<SpeciesItem[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState("");
  const [isLoadingSpecies, setIsLoadingSpecies] = useState(false);
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false);

  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Load database-driven species catalogue
  useEffect(() => {
    let isMounted = true;
    async function loadSpecies() {
      setIsLoadingSpecies(true);
      try {
        const queryParam = speciesSearch ? `?q=${encodeURIComponent(speciesSearch)}` : "";
        const data = await apiClient.get<SpeciesItem[]>(`/species${queryParam}`);
        if (isMounted) {
          setSpeciesList(data);
        }
      } catch {
        // Handled gracefully
      } finally {
        if (isMounted) setIsLoadingSpecies(false);
      }
    }

    loadSpecies();
    return () => {
      isMounted = false;
    };
  }, [speciesSearch]);

  const handleCaptureGps = async () => {
    setIsCapturingGps(true);
    setGpsError(null);
    try {
      const pos = await acquireDeviceGps();
      setLocation(pos.latitude, pos.longitude, pos.accuracy);
    } catch (err: any) {
      if (err instanceof LocationError) {
        setGpsError(err.message);
      } else {
        setGpsError("Unable to acquire GPS coordinates. Please retry.");
      }
    } finally {
      setIsCapturingGps(false);
    }
  };

  const handleContinue = () => {
    setFormError(null);
    if (!speciesId) {
      setFormError("Please select a tree species.");
      return;
    }
    if (latitude === null || longitude === null) {
      setFormError("Hardware GPS coordinates are required as proof.");
      return;
    }
    if (!locationName.trim()) {
      setFormError("Please provide a display location name (e.g. City, Park).");
      return;
    }
    setStep(2);
    navigation.navigate("StepProof");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={[typography.h2, styles.title]}>Step 1 — Tree Details</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Provide the botanical species, planting timestamp, and capture authoritative GPS location.
      </Text>

      {formError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{formError}</Text>
        </View>
      ) : null}

      {/* 1. Species Selection (Database-driven) */}
      <View style={styles.section}>
        <Text style={styles.label}>TREE SPECIES *</Text>
        <Pressable
          style={({ pressed }) => [
            styles.selectorButton,
            Boolean(speciesId) ? styles.selectorButtonSelected : undefined,
            pressed && styles.pressed,
          ]}
          onPress={() => setShowSpeciesPicker(!showSpeciesPicker)}
          accessibilityRole="button"
          accessibilityLabel="Select botanical species"
        >
          <View>
            <Text style={speciesId ? styles.selectorTextSelected : styles.selectorTextPlaceholder}>
              {speciesName || "Select botanical species..."}
            </Text>
            {scientificName ? (
              <Text style={styles.scientificNameText}>{scientificName}</Text>
            ) : null}
          </View>
          <Text style={styles.selectorChevron}>{showSpeciesPicker ? "▲" : "▼"}</Text>
        </Pressable>

        {showSpeciesPicker ? (
          <View style={[styles.pickerDropdown, shadows.paper]}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search common name or regional alias..."
              placeholderTextColor={colors.textMuted}
              value={speciesSearch}
              onChangeText={setSpeciesSearch}
            />
            {isLoadingSpecies ? (
              <ActivityIndicator style={{ padding: spacing.md }} color={colors.primary} />
            ) : (
              speciesList.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    pressed && styles.dropdownItemPressed,
                  ]}
                  onPress={() => {
                    setSpecies(item.id, item.commonName, item.scientificName);
                    setShowSpeciesPicker(false);
                    setSpeciesSearch("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.commonName}
                >
                  <Text style={styles.dropdownItemName}>{item.commonName}</Text>
                  <Text style={styles.dropdownItemScientific}>{item.scientificName}</Text>
                  {item.aliases.length > 0 ? (
                    <Text style={styles.dropdownItemAliases}>
                      Aliases: {item.aliases.join(", ")}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* 2. Planting Date */}
      <View style={styles.section}>
        <Text style={styles.label}>PLANTING DATE *</Text>
        <TextInput
          style={styles.input}
          value={plantedAt}
          onChangeText={setPlantedAt}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* 3. Hardware GPS Location Proof */}
      <View style={styles.section}>
        <Text style={styles.label}>GPS LOCATION PROOF (DEVICE_GPS) *</Text>
        <View style={[styles.gpsCard, shadows.paper]}>
          {latitude !== null && longitude !== null ? (
            <View>
              <View style={styles.gpsRow}>
                <Text style={styles.gpsSuccessDot}>●</Text>
                <Text style={styles.gpsCoordinates}>
                  {latitude.toFixed(6)}°, {longitude.toFixed(6)}°
                </Text>
              </View>
              {locationAccuracy != null ? (
                <View style={styles.accuracyPill}>
                  <Text style={styles.accuracyText}>± {locationAccuracy.toFixed(1)}m accuracy</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.gpsPlaceholderText}>
              Device GPS has not been captured yet. GPS coordinates are required proof.
            </Text>
          )}

          {gpsError ? (
            <View style={styles.gpsErrorBanner}>
              <Text style={styles.gpsErrorText}>{gpsError}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.gpsButton,
              pressed && !isCapturingGps && styles.pressed,
            ]}
            onPress={handleCaptureGps}
            disabled={isCapturingGps}
            accessibilityRole="button"
            accessibilityLabel={latitude !== null ? "Re-capture Device GPS" : "Capture Device GPS"}
            accessibilityState={{ disabled: isCapturingGps, busy: isCapturingGps }}
          >
            {isCapturingGps ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={styles.gpsButtonText}>
                {latitude !== null ? "Re-capture Device GPS" : "Capture Device GPS"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* 4. Display Location Name */}
      <View style={styles.section}>
        <Text style={styles.label}>LOCATION DISPLAY NAME *</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g. Cubbon Park, Bengaluru"
          placeholderTextColor={colors.textMuted}
          maxLength={120}
        />
        <Text style={styles.helperText}>User-provided display name for your personal journal.</Text>
      </View>

      {/* 5. Planting Context */}
      <View style={styles.section}>
        <Text style={styles.label}>PLANTING CONTEXT (OPTIONAL)</Text>
        <View style={styles.pillContainer}>
          {CONTEXT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.pill,
                context === opt.value ? styles.pillSelected : undefined,
                pressed && styles.pressed,
              ]}
              onPress={() => setContext(context === opt.value ? null : opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: context === opt.value }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.pillText, context === opt.value ? styles.pillTextSelected : undefined]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 6. Notes */}
      <View style={styles.section}>
        <Text style={styles.label}>PLANTING NOTES (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Specific location details, seedling condition, soil notes..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          maxLength={1000}
        />
      </View>

      {/* Navigation Button */}
      <Pressable
        style={({ pressed }) => [
          styles.continueButton,
          pressed && styles.pressed,
        ]}
        onPress={handleContinue}
        accessibilityRole="button"
        accessibilityLabel="Continue to Photo Proof"
      >
        <Text style={styles.continueButtonText}>Continue to Photo Proof →</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.hero,
  },
  title: {
    ...typography.h2,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  selectorButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  selectorButtonSelected: {
    borderColor: colors.primary,
  },
  selectorTextPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
  },
  selectorTextSelected: {
    ...typography.bodyBold,
    color: colors.primaryDark,
  },
  scientificNameText: {
    ...typography.caption,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  selectorChevron: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pickerDropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    maxHeight: 220,
  },
  searchInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    padding: spacing.sm + 2,
    fontSize: 14,
    color: colors.textPrimary,
  },
  dropdownItem: {
    padding: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  dropdownItemName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  dropdownItemScientific: {
    ...typography.caption,
    fontStyle: "italic",
    color: colors.textSecondary,
  },
  dropdownItemAliases: {
    ...typography.caption,
    color: colors.primaryMuted,
    marginTop: 2,
  },
  gpsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  gpsSuccessDot: {
    color: colors.success,
    fontSize: 16,
    marginRight: spacing.sm,
  },
  gpsCoordinates: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  accuracyPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  accuracyText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  gpsPlaceholderText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  gpsButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  gpsButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  gpsErrorBanner: {
    backgroundColor: colors.rejectedSurface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  gpsErrorText: {
    ...typography.caption,
    color: colors.rejected,
    fontWeight: "500",
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  pillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  pillTextSelected: {
    color: colors.textInverse,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  continueButtonText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  errorBanner: {
    backgroundColor: colors.rejectedSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.rejected,
    padding: spacing.md,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.rejected,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.75,
  },
  dropdownItemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
