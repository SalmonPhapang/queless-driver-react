// Shared neutral/crimson palette. Source of truth: @queless/core.
import {
  DarkColors as CoreDarkColors,
  LightColors as CoreLightColors,
  legacyColorAliases,
} from '@queless/core/theme';

export const LightColors = { ...CoreLightColors, ...legacyColorAliases.light };
export const DarkColors = { ...CoreDarkColors, ...legacyColorAliases.dark };

export type ThemeColors = typeof LightColors;
export type AppColors = ThemeColors;

export const lightColors = LightColors;
export const darkColors = DarkColors;
export const palette = LightColors;
