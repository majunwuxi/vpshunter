export interface ExchangeRate {
  rate: number;
  time: Date;
}

let cached: ExchangeRate | null = null;

const TTL_MS = 12 * 60 * 60 * 1000;

export async function getExchangeRate(
  currency: string
): Promise<ExchangeRate> {
  if (currency === 'USD') {
    return {
      rate: 1,
      time: new Date()
    };
  }

  if (
    cached &&
    Date.now() - cached.time.getTime() < TTL_MS
  ) {
    return cached;
  }

  const response = await fetch(
    'https://api.exchangerate.host/latest?base=USD'
  );

  if (!response.ok) {
    throw new Error(
      `Exchange rate HTTP ${response.status}`
    );
  }

  const data =
    (await response.json()) as {
      rates?: Record<string, number>;
    };

  const rate =
    data.rates?.[currency.toUpperCase()];

  if (!rate || rate <= 0) {
    throw new Error(
      `No exchange rate for ${currency}`
    );
  }

  cached = {
    rate,
    time: new Date()
  };

  return cached;
}