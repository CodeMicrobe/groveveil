/**
 * Groveveil Botanical Design System
 * Visual Identity: Nature x Premium x Paper
 */

export const colors = {
  // Brand greens
  primary: "#2D6A4F",       // Deep leaf green (Primary CTA & highlights)
  primaryDark: "#1A382B",   // Deep forest green (Headings & major cards)
  primaryLight: "#40916C",  // Fresh foliage green
  primaryMuted: "#74C69D",  // Soft sage accent

  // Warm paper surfaces
  background: "#FBF8F2",    // Warm cream textured base
  surface: "#FFFFFF",       // Pristine card surface
  surfaceMuted: "#F4F1EA",  // Subtle inset background
  surfaceTint: "#EDF4EE",   // Soft leafy wash for selected cards

  // Borders & Dividers
  border: "#E2DCD2",        // Warm paper border
  borderLight: "#EDE8E1",
  borderActive: "#52B788",

  // Typography
  textPrimary: "#1C2D23",   // Deep forest text
  textSecondary: "#526B5C", // Calming green-tinted grey
  textMuted: "#889C90",     // Subdued metadata text
  textInverse: "#FFFFFF",

  // Accents & Milestones
  goldBadge: "#DDA15E",     // Wooden / bronze achievement glow
  goldBadgeDark: "#BC6C25",
  streakOrange: "#D97706",
  badgeBg: "#FAF0CA",

  // Semantic
  success: "#2D6A4F",
  warning: "#D97706",
  danger: "#C1121F",
  info: "#3A86C8",

  // Verification & Status Badges
  verified: "#2D6A4F",
  verifiedSurface: "#E8F5E9",
  verifiedBorder: "#C8E6C9",

  pending: "#B45309",
  pendingSurface: "#FFF8E1",
  pendingBorder: "#FFE082",

  rejected: "#991B1B",
  rejectedSurface: "#FFEBEE",
  rejectedBorder: "#FFCDD2",

  warningSurface: "#FEF3C7",
  warningBorder: "#F59E0B",
  warningText: "#92400E",
};

export const typography = {
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    color: colors.textSecondary,
  },
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    color: colors.textMuted,
  },
  badge: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  hero: 36,
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
  full: 9999,
};

export const shadows = {
  paper: {
    shadowColor: "#1C2D23",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: "#1C2D23",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: "#1A382B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
};
