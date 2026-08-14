import { enabledMonitors } from '@/config/providers';
import { isDbConfigured } from '@/lib/db/supabase';
import {
  startMonitorRun,
  finishMonitorRun,
  failMonitorRun
} from '@/lib/db/monitor_runs';
import {
  saveOffer,
  recordCheck,
  recordPriceHistory,
  notificationSeen,
  saveNotification
} from '@/lib/db/ops';
import {
  evaluateOffer
} from '@/lib/rules/evaluate';
import { loadRules } from '@/lib/rules/rules-store';
import type { MonitorRules } from '@/lib/rules/types';
import { normalizeOffer } from '@/lib/rules/normalize';
import { getExchangeRate } from '@/lib/utils/currency';
import {
  createOfferHash,
  offerNotificationPayload
} from '@/lib/utils/hash';
import { logger } from '@/lib/utils/logger';
import { sendAlert } from '@/lib/notifications/email';
import { scanLowEndSpirit } from '@/discovery/lowendspirit';
import { scanLowEndTalk } from '@/discovery/lowendtalk';
import { saveDiscoveryItems } from '@/lib/discovery/store';
import type {
  RawVpsOffer
} from '@/monitors/types';

const dbConfigured =
  isDbConfigured();

const dryRun =
  process.env.DRY_RUN === 'true';

if (!dbConfigured) {
  logger.warn(
    'Supabase env not configured - running WITHOUT persistence'
  );
}

if (dryRun) {
  logger.warn(
    'DRY_RUN enabled - no notifications will be sent'
  );
}

const runStats = {
  offersFound: 0,
  offersQualified: 0,
  notificationsSent: 0
};

let activeRules: MonitorRules | null =
  null;

async function processOffer(
  offerInput: RawVpsOffer
) {
  runStats.offersFound += 1;

  const rate =
    await getExchangeRate(
      offerInput.currency
    );

  const offer =
    normalizeOffer(
      offerInput,
      rate.rate
    );

  const result =
    evaluateOffer(
      offer,
      activeRules ?? undefined
    );

  let planId: string | null = null;

  if (dbConfigured) {
    const plan =
      await saveOffer(offer);

    planId = plan.id;

    await recordCheck(
      plan.id,
      offer,
      result,
      offer.priceUsdYear
    );

    if (
      offer.billingPeriod === 'annual'
    ) {
      await recordPriceHistory(
        plan.id,
        offer
      );
    }
  } else {
    logger.info(
      {
        plan: offer.planName,
        priceUsdYear:
          offer.priceUsdYear,
        currency: offer.currency,
        billing: offer.billingPeriod
      },
      '[no-db] offer parsed'
    );
  }

  if (!result.qualified) {
    logger.info(
      {
        plan: offer.planName,
        reasons: result.reasons
      },
      'offer not qualified'
    );

    return;
  }

  runStats.offersQualified += 1;

  const offerHash =
    createOfferHash(
      offerNotificationPayload(offer)
    );

  if (dbConfigured) {
    const alreadySeen =
      await notificationSeen(
        offerHash
      );

    if (alreadySeen) {
      logger.info(
        { plan: offer.planName },
        'already notified, skipping'
      );

      return;
    }
  }

  if (dryRun) {
    logger.info(
      {
        provider: offer.provider,
        plan: offer.planName,
        priceUsdYear:
          offer.priceUsdYear,
        tier: result.tier,
        orderUrl: offer.orderUrl
      },
      '[dry-run] WOULD notify'
    );

    runStats.notificationsSent += 1;

    return;
  }

  if (!dbConfigured) {
    logger.warn(
      {
        plan: offer.planName
      },
      'DB not configured, cannot send notification'
    );

    return;
  }

  await sendAlert(offer);

  if (planId) {
    await saveNotification(
      planId,
      offerHash
    );
  }

  runStats.notificationsSent += 1;

  logger.info(
    {
      provider: offer.provider,
      plan: offer.planName,
      priceUsdYear: offer.priceUsdYear,
      tier: result.tier
    },
    'qualified offer notified'
  );
}

async function main() {
  const started = new Date();

  logger.info(
    'VPS Hunter monitor started'
  );

  activeRules = await loadRules();

  logger.info(
    {
      minVcpu:
        activeRules.hardware.minVcpu,
      minRamMb:
        activeRules.hardware.minRamMb,
      minStorageGb:
        activeRules.hardware.minStorageGb,
      standardMaxUsdYear:
        activeRules.pricing.standardMaxUsdYear,
      rdnsMaxUsdYear:
        activeRules.pricing.rdnsMaxUsdYear
    },
    'active rules loaded'
  );

  let runId: string | null = null;

  if (dbConfigured) {
    runId =
      await startMonitorRun();
  }

  let providersChecked = 0;

  try {
    // Discovery phase: collect leads from forums (never notified directly).
    const discoverySources: Array<{
      source: string;
      scan(): Promise<import('@/lib/discovery/store').DiscoveryItem[]>;
    }> = [
      {
        source: 'lowendspirit',
        scan: scanLowEndSpirit
      },
      {
        source: 'lowendtalk',
        scan: scanLowEndTalk
      }
    ];

    for (const discovery of discoverySources) {
      try {
        const leads =
          await discovery.scan();

        logger.info(
          {
            source: discovery.source,
            count: leads.length
          },
          'discovery scan complete'
        );

        if (leads.length > 0 && dbConfigured) {
          const processed =
            await saveDiscoveryItems(leads);

          const matched =
            processed.filter(
              (p) => p.matched
            );

          logger.info(
            {
              source: discovery.source,
              total: leads.length,
              matched: matched.length,
              providers: [
                ...new Set(
                  matched.map(
                    (m) => m.providerSlug
                  )
                )
              ]
            },
            'discovery leads saved'
          );
        } else if (leads.length > 0) {
          logger.info(
            {
              source: discovery.source,
              sample:
                leads.slice(0, 3).map(
                  (l) => l.title
                )
            },
            '[no-db] discovery leads'
          );
        }
      } catch (error) {
        logger.error(
          {
            source: discovery.source,
            err:
              error instanceof Error
                ? error.message
                : String(error)
          },
          'discovery scan failed'
        );
      }
    }

    for (
      const monitor of enabledMonitors
    ) {
      try {
        const urls =
          await monitor.discover();

        for (const url of urls) {
          const offers =
            await monitor.verify(url);

          for (
            const offer of offers
          ) {
            await processOffer(
              offer
            );
          }
        }

        providersChecked += 1;
      } catch (error) {
        logger.error(
          {
            monitor: monitor.slug,
            err:
              error instanceof Error
                ? error.message
                : String(error)
          },
          'monitor failed'
        );
      }
    }

    if (runId) {
      await finishMonitorRun(runId, {
        providersChecked,
        ...runStats
      });
    }

    logger.info(
      {
        ...runStats,
        providersChecked,
        durationMs:
          Date.now() -
          started.getTime()
      },
      'monitor finished'
    );
  } catch (error) {
    const err =
      error instanceof Error
        ? error
        : new Error(String(error));

    if (runId) {
      await failMonitorRun(runId, err);
    }

    logger.error(
      { err: err.message },
      'monitor aborted'
    );

    process.exitCode = 1;
  }
}

main().catch((error) => {
  const err =
    error instanceof Error
      ? error
      : new Error(String(error));

  logger.error(
    { err: err.message },
    'monitor crashed'
  );

  process.exitCode = 1;
});