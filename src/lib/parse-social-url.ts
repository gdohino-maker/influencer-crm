export type ParsedSocialUrl = {
  platform: "instagram" | "x" | "tiktok";
  username: string;
};

const PATTERNS: { platform: ParsedSocialUrl["platform"]; hosts: string[] }[] = [
  { platform: "instagram", hosts: ["instagram.com", "www.instagram.com"] },
  { platform: "tiktok", hosts: ["tiktok.com", "www.tiktok.com"] },
  { platform: "x", hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"] },
];

// Instagram/TikTok/XのプロフィールURLからplatformとusernameを推定する。
// 例: https://instagram.com/foo, https://www.tiktok.com/@foo, https://x.com/foo
export function parseSocialUrl(input: string): ParsedSocialUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const match = PATTERNS.find((p) => p.hosts.includes(url.hostname));
  if (!match) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const username = segments[0].replace(/^@/, "");
  if (!username) return null;

  return { platform: match.platform, username };
}
