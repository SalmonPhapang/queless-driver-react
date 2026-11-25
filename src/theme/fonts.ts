import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

export { APP_FONT_FAMILY, NAVIGATION_FONTS } from '@queless/core/theme';
import { APP_FONT_FAMILY } from '@queless/core/theme';

export function useAppFonts(): [boolean, Error | null] {
  return useFonts([
    {
      fontFamily: APP_FONT_FAMILY,
      fontDefinitions: [
        { path: PlusJakartaSans_400Regular, weight: 400 },
        { path: PlusJakartaSans_600SemiBold, weight: 600 },
        { path: PlusJakartaSans_700Bold, weight: 700 },
        { path: PlusJakartaSans_800ExtraBold, weight: 800 },
      ],
    },
  ]);
}
