import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where this development build was loaded from, e.g. "10.153.78.5:8081": Expo's hostUri on a phone, the page's own
 * host in the web preview (which has no hostUri). Used by lib/local-host.ts to follow the computer's address.
 */
export function metroHostUri(): string | undefined {
  if (Constants.expoConfig?.hostUri) return Constants.expoConfig.hostUri;
  // No DOM types in the app's TypeScript setup: read the page's location through globalThis.
  return Platform.OS === 'web' ? (globalThis as { location?: { host?: string } }).location?.host : undefined;
}
