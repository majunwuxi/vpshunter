import { Resend } from 'resend';
import type { VpsOffer } from '@/monitors/types';

let resend: Resend | null = null;

function getResend(): Resend {
  if (resend) return resend;

  const key =
    process.env.RESEND_API_KEY;

  if (!key) {
    throw new Error(
      'RESEND_API_KEY not configured'
    );
  }

  resend = new Resend(key);

  return resend;
}

export async function sendAlert(
  offer: VpsOffer
) {
  if (process.env.DRY_RUN === 'true') {
    console.log(
      'Would notify:',
      offer.provider,
      offer.planName,
      `$${offer.priceUsdYear}/year`
    );

    return;
  }

  if (
    !process.env.RESEND_API_KEY
  ) {
    console.warn(
      'RESEND_API_KEY missing, notification skipped'
    );

    return;
  }

  const html = `
    <h2>VPS Hunter</h2>

    <p>
      <strong>${offer.provider}</strong>
      ${offer.planName}
    </p>

    <p>
      Location:
      ${offer.city ?? ''}
      ${offer.countryCode}
    </p>

    <p>
      CPU: ${offer.cpu} vCPU
    </p>

    <p>
      RAM: ${offer.ramMb / 1024} GB
    </p>

    <p>
      Storage:
      ${offer.storageGb} GB
      ${offer.storageType}
    </p>

    <p>
      IPv4: ${offer.ipv4Count}
    </p>

    <p>
      Price: $${offer.priceUsdYear}/year
    </p>

    <p>
      rDNS: ${offer.rdnsStatus}
    </p>

    <p>
      SMTP 25:
      ${offer.smtp25Policy ?? 'Unknown'}
    </p>

    <p>
      Verification:
      ${offer.verificationLevel}
    </p>

    <a href="${offer.orderUrl ?? offer.productUrl}">
      Buy Now
    </a>
  `;

  if (
    !process.env.ALERT_EMAIL
  ) {
    console.warn(
      'ALERT_EMAIL missing, notification skipped'
    );

    return;
  }

  if (
    !process.env.RESEND_FROM_EMAIL
  ) {
    console.warn(
      'RESEND_FROM_EMAIL missing, notification skipped'
    );

    return;
  }

  const { error } =
    await getResend().emails.send({
      from:
        process.env.RESEND_FROM_EMAIL,
      to: [
        process.env.ALERT_EMAIL
      ],
      subject:
        `VPS deal: ${offer.provider} $${offer.priceUsdYear}/year`,
      html
    });

  if (error) {
    throw new Error(
      `Resend error: ${error.message}`
    );
  }
}