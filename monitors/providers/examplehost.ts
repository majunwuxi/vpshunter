import type {
  ProviderMonitor
} from '@/monitors/types';

export const exampleHostMonitor: ProviderMonitor = {
  slug: 'examplehost',
  enabled: false,

  async discover() {
    return [
      'https://example.com/vps'
    ];
  },

  async verify(url: string) {
    void url;

    return [];
  }
};