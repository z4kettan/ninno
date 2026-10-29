import { PINCODE_PATTERN } from '@ninno/contracts';

export interface PlaceGuess {
  city: string;
  state: string;
}

const LOOKUP_URL = 'https://api.postalpincode.in/pincode/';
const TIMEOUT_MS = 4000;

interface IndiaPostAnswer {
  Status?: string;
  PostOffice?: { District?: string; State?: string }[] | null;
}

/**
 * City (district) and state for a pincode from India Post's free API. Only the pincode
 * leaves the device. Any failure, slowness or odd answer returns null and the resident
 * types the place themselves.
 */
export async function lookupPincode(
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<PlaceGuess | null> {
  if (!PINCODE_PATTERN.test(code)) {
    return null;
  }
  try {
    const res = await fetcher(`${LOOKUP_URL}${code}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) {
      return null;
    }
    const [answer] = (await res.json()) as IndiaPostAnswer[];
    const office = answer?.Status === 'Success' ? answer.PostOffice?.[0] : undefined;
    return office?.District && office.State ? { city: office.District, state: office.State } : null;
  } catch {
    return null;
  }
}
