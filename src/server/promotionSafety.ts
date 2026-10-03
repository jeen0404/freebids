const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly',
  'shorturl.at', 'tiny.cc', 'rb.gy', 'bl.ink', 'lnkd.in', 'shorte.st', 'adf.ly', 'v.gd', 'soo.gd',
  's.id', 'qr.ae', 'tr.im', 'bitly.com', 'short.io', 'l.ead.me',
]);

const BLOCKED_TLDS = new Set(['xxx', 'porn', 'sex', 'adult', 'casino', 'bet', 'poker', 'sexy', 'cam', 'webcam']);

const BLOCKED_HOST_KEYWORDS = [
  'porn', 'xxx', 'xvideo', 'xhamster', 'onlyfans', 'fansly', 'escort', 'hentai', 'nsfw', 'camgirl',
  'casino', 'gambl', 'betting', 'sportsbook', '1xbet', 'bet365', 'jackpot',
  'airdrop', 'giveaway', 'freemoney', 'free-money', 'doubler', 'walletconnect', 'claim-reward',
  'viagra', 'cialis',
];

/**
 * Deliberately short: catches obvious slurs and profanity in the main launch
 * languages. Matching is on normalised tokens, so embedded substrings in
 * legitimate words (e.g. "Scunthorpe") do not trigger.
 */
const BLOCKED_TERMS = [
  // English
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'whore',
  'slut', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink', 'gook', 'wetback',
  'paki', 'raghead', 'towelhead', 'tranny', 'rapist', 'nazi', 'hitler', 'kkk',
  // Hindi / Urdu (romanised)
  'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'randi', 'gaandu',
  // Spanish
  'puta', 'puto', 'pendejo', 'cabron', 'mierda', 'maricon', 'verga', 'culero',
  // Portuguese
  'caralho', 'buceta', 'viado', 'arrombado',
];

const BLOCKED_TERMS_SET = new Set(BLOCKED_TERMS);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function normaliseTokens(text: string): string[] {
  const lowered = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[013457@$!]/g, (ch) => LEET[ch] || ch);
  const tokens = lowered.split(/[^a-z]+/).filter(Boolean);
  // Also check the text with separators removed, to catch "f.u.c.k" / "f u c k".
  const joinedSingles = lowered
    .split(/[^a-z]+/)
    .filter((t) => t.length === 1)
    .join('');
  if (joinedSingles.length >= 3) tokens.push(joinedSingles);
  return tokens.map((t) => t.replace(/(.)\1{2,}/g, '$1$1'));
}

export function isShortener(host: string): boolean {
  return SHORTENER_DOMAINS.has(host.toLowerCase().replace(/^www\./, ''));
}

function containsBlockedTerm(text?: string | null): boolean {
  if (!text) return false;
  return normaliseTokens(text).some((t) => BLOCKED_TERMS_SET.has(t) || BLOCKED_TERMS_SET.has(t.replace(/(.)\1+/g, '$1')));
}

export function checkUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return 'That link is not a valid URL.';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Links must start with http:// or https://.';
  if (url.username || url.password) return 'Links cannot contain credentials.';
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || !host.includes('.')) {
    return 'Please link to a real domain name.';
  }
  if (host === 'freebids.lol' || host.endsWith('.freebids.lol')) return 'You cannot link to FreeBids itself.';
  if (SHORTENER_DOMAINS.has(host)) return 'Link shorteners and redirect services are not allowed. Use the full URL.';
  const tld = host.split('.').pop() || '';
  if (BLOCKED_TLDS.has(tld)) return 'Adult, gambling and scam sites are not allowed on the board.';
  if (BLOCKED_HOST_KEYWORDS.some((k) => host.includes(k))) return 'Adult, gambling and scam sites are not allowed on the board.';
  if (containsBlockedTerm(url.pathname + ' ' + url.search)) return 'That link contains language that is not allowed.';
  return null;
}

/** Returns a user-facing error message, or null when the flag text is acceptable. */
export function screenFlagText(input: { name?: string; tagline?: string }): string | null {
  const fields: [string, string | undefined, number][] = [
    ['Name', input.name, 40],
    ['Tagline', input.tagline, 90],
  ];
  for (const [label, value, max] of fields) {
    if (!value) continue;
    if (value.length > max) return `${label} is too long (max ${max} characters).`;
    if (containsBlockedTerm(value)) return `${label} contains language that is not allowed. See the rules.`;
    if (/https?:\/\/|www\./i.test(value)) return `${label} cannot contain links.`;
  }
  return null;
}
