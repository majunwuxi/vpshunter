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
import {
  detectWhmcsStore,
  buildAutoWhmcsConfig,
  upsertAutoProvider,
  updateAdapterProgress
} from '@/lib/discovery/auto-provider';
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

type ProviderStat = {
  status: 'success' | 'failed';
  offers: number;
  verification: { A: number; B: number; C: number };
  checkout: 'passed' | 'failed' | 'not_attempted';
  cloudflare: 'passed' | 'failed' | 'not_applicable';
  error?: string;
};

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

/**
 * Auto-joins providers discovered from forum leads whose official site is a
 * WHMCS store reachable over HTTP. Only the first official URL per lead is
 * probed; a lead that matches an existing enabled monitor is skipped.
 */
async function autoJoinProviderLeads(
  leads: Array<import('@/lib/discovery/store').DiscoveryItem>
): Promise<number> {
  if (!dbConfigured) {
    return 0;
  }

  const monitoredSlugs = new Set(
    enabledMonitors.map(
      (m) => m.slug
    )
  );

  let joined = 0;

  for (const lead of leads) {
    // Skip providers we already monitor.
    const leadSlug = lead.providerName
      ? lead.providerName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40)
      : '';

    if (
      leadSlug &&
      monitoredSlugs.has(leadSlug)
    ) {
      continue;
    }

    const official =
      lead.officialUrls?.[0];

    if (!official) {
      await updateAdapterProgress({
        slug: leadSlug || 'unknown',
        name: lead.providerName || '未知供应商',
        status: 'discovered',
        progress: 10,
        note: '已发现线索，尚未提取到官网 URL'
      });
      continue;
    }

    let baseUrl = official;

    try {
      const u = new URL(official);
      baseUrl = u.origin;
    } catch {
      continue;
    }

    try {
      await updateAdapterProgress({
        slug: leadSlug || new URL(baseUrl).hostname.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        name: lead.providerName || new URL(baseUrl).hostname,
        status: 'analyzing',
        progress: 20,
        officialUrl: baseUrl,
        note: '正在探测标准 WHMCS 商品页'
      });

      const storeUrl =
        await detectWhmcsStore(
          baseUrl
        );

      if (!storeUrl) {
        await updateAdapterProgress({
          slug: leadSlug || new URL(baseUrl).hostname.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
          name: lead.providerName || new URL(baseUrl).hostname,
          status: 'analyzing',
          progress: 20,
          officialUrl: baseUrl,
          note: '非标准 WHMCS、Cloudflare 或需要专用 Adapter'
        });
        continue;
      }

      const name =
        lead.providerName ||
        new URL(baseUrl).hostname;

      const config =
        buildAutoWhmcsConfig(
          name,
          baseUrl,
          storeUrl,
          lead.sourceUrl
        );

      const saved =
        await upsertAutoProvider(
          config
        );

      if (saved) {
        joined += 1;

        await updateAdapterProgress({
          slug: saved.slug,
          name: saved.name,
          status: 'enabled',
          progress: 100,
          officialUrl: baseUrl,
          note: '已自动加入 WHMCS 监控'
        });

        logger.info(
          {
            provider: saved.name,
            slug: saved.slug,
            storeUrl
          },
          'auto-joined WHMCS provider'
        );
      }
    } catch (error) {
      logger.info(
        {
          provider:
            lead.providerName,
          url: baseUrl,
          err:
            error instanceof Error
              ? error.message
              : String(error)
        },
        'auto-join probe failed'
      );
    }
  }

  return joined;
}

async function main() {
  const started = new Date();

  logger.info(
    'VPS Hunter monitor started'
  );

  activeRules = await loadRules();

  if (dbConfigured) {
    for (const monitor of enabledMonitors) {
      const displayName: Record<string, string> = {
        bytevirt: 'ByteVirt',
        hostus: 'HostUS',
        racknerd: 'RackNerd'
      };
      await updateAdapterProgress({
        slug: monitor.slug,
        name: displayName[monitor.slug] ?? monitor.slug,
        status: 'enabled',
        progress: 100,
        note: '固定 Provider Adapter 已启用并参与监控'
      });
    }
  }

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
  const providerStats: Record<string, ProviderStat> = {};

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

          const monitoredSlugs =
            new Set(
              enabledMonitors.map(
                (m) => m.slug
              )
            );

          const covered =
            matched.filter(
              (m) =>
                m.providerSlug &&
                monitoredSlugs.has(
                  m.providerSlug
                )
            );

          const pending =
            leads.filter(
              (l) =>
                !matched.some(
                  (m) =>
                    m.url ===
                    l.sourceUrl
                ) &&
                l.officialUrls &&
                l.officialUrls.length > 0
            );

          logger.info(
            {
              source: discovery.source,
              total: leads.length,
              matched: matched.length,
              covered:
                covered.length,
              pendingVerification:
                pending.length,
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

          const joined =
            await autoJoinProviderLeads(
              leads
            );

          if (joined > 0) {
            logger.info(
              {
                source: discovery.source,
                joined
              },
              'auto-joined providers'
            );
          }
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

    // Static monitors + auto-discovered WHMCS providers.
    const allMonitors = [
      ...enabledMonitors
    ];

    if (dbConfigured) {
      const { listAutoProviders, monitorFromAutoProvider } =
        await import(
          '@/lib/discovery/auto-provider'
        );

      const autoRows =
        await listAutoProviders();

      for (const row of autoRows) {
        if (
          !allMonitors.some(
            (m) => m.slug === row.slug
          )
        ) {
          allMonitors.push(
            monitorFromAutoProvider(
              row
            )
          );
        }
      }
    }

    for (
      const monitor of allMonitors
    ) {
      const stats: ProviderStat = providerStats[monitor.slug] = {
        status: 'success',
        offers: 0,
        verification: { A: 0, B: 0, C: 0 },
        checkout: 'not_attempted',
        cloudflare: monitor.slug === 'racknerd' ? 'failed' : 'not_applicable'
      };
      try {
        const urls =
          await monitor.discover();

        for (const url of urls) {
          const offers =
            await monitor.verify(url);

          for (
            const offer of offers
          ) {
            stats.offers += 1;
            stats.verification[offer.verificationLevel] += 1;
            if (offer.verificationLevel === 'A') {
              stats.checkout = 'passed';
              if (monitor.slug === 'racknerd') stats.cloudflare = 'passed';
            } else if (
              offer.verificationLevel === 'B' &&
              stats.checkout === 'not_attempted'
            ) {
              // B means the official product/config page was reached, but
              // Playwright checkout was not attempted for this offer.
              stats.checkout = 'not_attempted';
            } else if (
              offer.verificationLevel === 'C' &&
              stats.checkout === 'not_attempted'
            ) {
              stats.checkout = 'failed';
            }
            await processOffer(
              offer
            );
          }
        }

        providersChecked += 1;
        if (stats.verification.A > 0) {
          stats.checkout = 'passed';
          if (monitor.slug === 'racknerd') {
            stats.cloudflare = 'passed';
          }
        } else if (stats.verification.B > 0) {
          stats.checkout = 'not_attempted';
        } else if (stats.verification.C > 0) {
          stats.checkout = 'failed';
        }
        logger.info({ provider: monitor.slug, ...stats }, 'provider monitor summary');
      } catch (error) {
        stats.status = 'failed';
        stats.error = error instanceof Error ? error.message : String(error);
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
        providerStats,
        ...runStats
      });
    }

    logger.info(
      {
        ...runStats,
        providersChecked,
        providerStats,
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
