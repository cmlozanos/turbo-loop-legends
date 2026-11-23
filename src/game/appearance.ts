export type NativeTheme = "light" | "dark";

// The getters remain optional until the canonical kit has been propagated.
export function nativeAppearance(reducedMotion: boolean): { theme: NativeTheme; motion: boolean } {
  const family = typeof window === "undefined" ? undefined : window.FamilyV2;
  const theme = family?.theme?.() ?? (typeof document !== "undefined" && document.documentElement.dataset.familyTheme === "dark" ? "dark" : "light");
  const systemReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return { theme, motion: !reducedMotion && !systemReduced && (family?.motionAllowed?.() ?? true) };
}
