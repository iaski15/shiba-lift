import { requireOptionalNativeModule } from 'expo';

type ShibaWear = {
  publish(json: string): Promise<void>;
  pendingActions(): Promise<string[]>;
  addListener(event: 'onAction', listener: () => void): { remove(): void };
};

// Galaxy Watch / Wear OS link. null on iOS, web and Expo Go: the watch features just switch off there.
export default requireOptionalNativeModule<ShibaWear>('ShibaWear');
