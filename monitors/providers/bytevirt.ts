import {
  createWhmcsProvider
} from '@/lib/crawler/whmcs';

const bytevirtConfig = {
  slug: 'bytevirt',
  name: 'ByteVirt',
  enabled: true,

  baseUrl: 'https://bytevirt.com',

  categories: [
    '/store/vps-jp-kvm',
    '/store/vps-sg-kvm',
    '/store/vps-hk-kvm'
  ],

  locationConfigOptionIds: ['63'],

  enableCheckoutUpgrade: true,

  matchCountry(
    text: string
  ): string | null {
    if (
      /Tokyo|Osaka|Japan/i.test(text)
    ) {
      return 'JP';
    }

    if (
      /Singapore/i.test(text)
    ) {
      return 'SG';
    }

    if (
      /Hong ?Kong|, CN/i.test(text)
    ) {
      return 'HK';
    }

    if (
      /Seoul|Korea/i.test(text)
    ) {
      return 'KR';
    }

    return null;
  },

  resolveCity(
    text: string
  ): string {
    if (
      text.includes('Osaka')
    ) {
      return 'Osaka';
    }

    if (
      text.includes('Singapore')
    ) {
      return 'Singapore';
    }

    if (
      text.includes('Hong Kong') ||
      text.includes('HongKong')
    ) {
      return 'Hong Kong';
    }

    return 'Tokyo';
  }
};

export const bytevirtMonitor =
  createWhmcsProvider(
    bytevirtConfig
  );

export {
  parsePackages,
  parseConfProduct
} from '@/lib/crawler/whmcs';