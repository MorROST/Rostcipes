import type { Platform } from '@/types';
import { getUniversalTranscript } from './providers/universal';

export async function getTranscript(
  url: string,
  platform: Platform
): Promise<{ text: string; title?: string; thumbnailUrl?: string }> {
  console.log(`[Transcript] Fetching for ${platform}: ${url}`);

  const result = await getUniversalTranscript(url, platform);

  const fullText = result.segments.map((s) => s.text).join(' ');

  if (!fullText.trim()) {
    throw new Error('Empty transcript — video may not have speech');
  }

  console.log(`[Transcript] Got ${result.segments.length} segments, ${fullText.length} chars`);
  return {
    text: fullText,
    title: result.title,
    thumbnailUrl: result.thumbnailUrl,
  };
}
