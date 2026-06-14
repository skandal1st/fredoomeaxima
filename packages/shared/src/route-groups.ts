/**
 * Default split-tunnel route groups for the MVP.
 *
 * WireGuard routes by IP, not by domain, so these domains are periodically
 * resolved to CIDRs by the route-resolver worker. Each group can be edited /
 * disabled by an admin; this list only seeds the initial state.
 *
 * NOTE: coverage is approximate — CDNs, QUIC and shifting IP ranges mean a
 * domain list never captures 100% of a service's traffic. Ranges are versioned
 * and re-resolved frequently; admins can add CIDRs manually.
 */
export interface RouteGroupSeed {
  key: string;
  name: string;
  domains: string[];
}

export const DEFAULT_ROUTE_GROUPS: RouteGroupSeed[] = [
  {
    key: 'telegram',
    name: 'Telegram',
    domains: ['telegram.org', 'web.telegram.org', 't.me', 'telegram.me', 'telesco.pe', 'cdn-telegram.org'],
  },
  {
    key: 'youtube',
    name: 'YouTube',
    domains: ['youtube.com', 'www.youtube.com', 'youtu.be', 'youtubei.googleapis.com', 'ytimg.com', 'googlevideo.com'],
  },
  {
    key: 'instagram',
    name: 'Instagram',
    domains: ['instagram.com', 'www.instagram.com', 'cdninstagram.com', 'i.instagram.com'],
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    domains: ['tiktok.com', 'www.tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'ibyteimg.com'],
  },
  {
    key: 'chatgpt',
    name: 'ChatGPT',
    domains: ['chat.openai.com', 'chatgpt.com', 'openai.com', 'api.openai.com', 'cdn.oaistatic.com', 'auth0.openai.com'],
  },
  {
    key: 'claude',
    name: 'Claude',
    domains: ['claude.ai', 'www.claude.ai', 'anthropic.com', 'api.anthropic.com', 'console.anthropic.com'],
  },
  {
    key: 'gemini',
    name: 'Gemini',
    domains: ['gemini.google.com', 'bard.google.com', 'generativelanguage.googleapis.com', 'aistudio.google.com'],
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    domains: ['whatsapp.com', 'www.whatsapp.com', 'web.whatsapp.com', 'g.whatsapp.net', 'mmg.whatsapp.net'],
  },
];
