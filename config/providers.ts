import type {
  ProviderMonitor
} from '@/monitors/types';
import { bytevirtMonitor } from '@/monitors/providers/bytevirt';
import { racknerdMonitor } from '@/monitors/providers/racknerd';
import { hostusMonitor } from '@/monitors/providers/hostus';

export const monitors: ProviderMonitor[] = [
  bytevirtMonitor,
  racknerdMonitor,
  hostusMonitor
];

export const enabledMonitors =
  monitors.filter(
    (monitor) => monitor.enabled
  );