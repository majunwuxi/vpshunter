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

  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',

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

  /**
   * Maps a Location selector option (from checkout) to a target region.
   * Only target regions (JP/KR/HK/SG) are emitted as offers; other options
   * are ignored so the dashboard only shows regions we care about.
   */
  matchLocationOption(
    label: string
  ): {
    countryCode: string;
    city: string;
  } | null {
    if (/Tokyo|Japan/i.test(label)) {
      return {
        countryCode: 'JP',
        city: 'Tokyo'
      };
    }

    if (/Seoul|Korea/i.test(label)) {
      return {
        countryCode: 'KR',
        city: 'Seoul'
      };
    }

    if (/Singapore/i.test(label)) {
      return {
        countryCode: 'SG',
        city: 'Singapore'
      };
    }

    if (/Hong ?Kong/i.test(label)) {
      return {
        countryCode: 'HK',
        city: 'Hong Kong'
      };
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