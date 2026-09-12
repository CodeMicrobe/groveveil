import { describe, it, expect } from "vitest";
import { colors, typography, spacing, radii } from "../src/presentation/theme/index";

describe("Mobile Botanical Design Tokens", () => {
  it("defines the canonical warm cream and deep forest green color tokens", () => {
    expect(colors.background).toBe("#FBF8F2");
    expect(colors.primaryDark).toBe("#1A382B");
    expect(colors.primary).toBe("#2D6A4F");
  });

  it("defines consistent status surface and border tokens for badges", () => {
    expect(colors.verifiedSurface).toBe("#E8F5E9");
    expect(colors.pendingSurface).toBe("#FFF8E1");
    expect(colors.rejectedSurface).toBe("#FFEBEE");
    expect(colors.warningSurface).toBe("#FEF3C7");
  });

  it("defines proper typography hierarchy", () => {
    expect(typography.h1.fontSize).toBeGreaterThan(typography.h2.fontSize);
    expect(typography.h2.fontSize).toBeGreaterThan(typography.h3.fontSize);
    expect(typography.h3.fontSize).toBeGreaterThan(typography.body.fontSize);
    expect(typography.body.fontSize).toBeGreaterThan(typography.caption.fontSize);
  });

  it("defines valid spacing and radii scales", () => {
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
    expect(spacing.md).toBeLessThan(spacing.lg);
    expect(radii.full).toBe(9999);
  });
});
