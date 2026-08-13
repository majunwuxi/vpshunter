import {
  createWhmcsProvider
} from '@/lib/crawler/whmcs';

const hostusConfig = {
  slug: 'hostus',
  name: 'HostUS',
  enabled: true,

  baseUrl: 'https://my.hostus.us',

  categories: [
    '/index.php/store/'
  ],

  locationConfigOptionIds: ['61'],

  matchCountry(
    text: string
  ): string | null {
    if (
      /Tokyo|Japan/i.test(text)
    ) {
      return 'JP';
    }

    if (
      /Seoul|Korea/i.test(text)
    ) {
      return 'KR';
    }

    if (
      /Singapore/i.test(text)
    ) {
      return 'SG';
    }

    if (
      /Hong ?Kong/i.test(text)
    ) {
      return 'HK';
    }

    if (
      /Dallas|Los Angeles|Atlanta|Chicago|New York|Washington|Seattle|Denver|San Jose/i.test(
        text
      )
    ) {
      return 'US';
    }

    if (
      /London|Amsterdam|Paris|Frankfurt/i.test(
        text
      )
    ) {
      return 'DE';
    }

    return null;
  },

  resolveCity(
    text: string
  ): string {
    if (/Tokyo/.test(text)) {
      return 'Tokyo';
    }

    if (/Seoul/.test(text)) {
      return 'Seoul';
    }

    if (/Singapore/.test(text)) {
      return 'Singapore';
    }

    if (/Hong Kong/.test(text)) {
      return 'Hong Kong';
    }

    if (/Los Angeles/.test(text)) {
      return 'Los Angeles';
    }

    if (/Dallas/.test(text)) {
      return 'Dallas';
    }

    return '';
  }
};

export const hostusMonitor =
  createWhmcsProvider(
    hostusConfig
  );