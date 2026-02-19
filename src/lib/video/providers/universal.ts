import type { Platform, TranscriptSegment } from '@/types';

const API_HOST = 'video-transcript-scraper.p.rapidapi.com';

/**
 * Universal transcript fetcher via RapidAPI's Video Transcript Scraper.
 * Uses /transcript first (free, for videos with existing captions),
 * falls back to /transcribe (AI-powered, for videos without captions).
 */
export async function getUniversalTranscript(
  url: string,
  platform: Platform
): Promise<{ segments: TranscriptSegment[]; title?: string; thumbnailUrl?: string }> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  // Try /transcript first (cheaper, uses existing captions)
  const transcriptRes = await fetch(`https://${API_HOST}/transcript`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': API_HOST,
    },
    body: JSON.stringify({ video_url: url }),
  });

  if (transcriptRes.ok) {
    const data = await transcriptRes.json();
    if (data.status !== 'error' && data.data?.transcript?.length) {
      console.log('[Transcript] Got captions via /transcript');
      return {
        segments: parseSegments(data.data.transcript),
        title: data.data.video_info?.title,
        thumbnailUrl: data.data.video_info?.thumbnail,
      };
    }
  }

  // Fall back to /transcribe (AI transcription)
  console.log('[Transcript] No captions, using /transcribe (AI)');
  const transcribeRes = await fetch(`https://${API_HOST}/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': API_HOST,
    },
    body: JSON.stringify({ video_url: url }),
  });

  if (!transcribeRes.ok) {
    const errText = await transcribeRes.text().catch(() => '');
    throw new Error(
      `Transcript API error (${transcribeRes.status}): ${errText.substring(0, 200)}`
    );
  }

  const data = await transcribeRes.json();

  if (data.status === 'error') {
    throw new Error(data.message || 'Transcription failed');
  }

  const transcript = data.data?.transcript || data.transcript;
  if (!transcript?.length) {
    throw new Error('No transcript returned from API');
  }

  return {
    segments: parseSegments(transcript),
    title: data.data?.video_info?.title,
    thumbnailUrl: data.data?.video_info?.thumbnail,
  };
}

function parseSegments(transcript: unknown[]): TranscriptSegment[] {
  return transcript.map((s) => {
    if (typeof s === 'string') return { text: s };
    if (s && typeof s === 'object') {
      const obj = s as Record<string, unknown>;
      return {
        text: String(obj.text || obj.subtitle || obj.content || ''),
        offset: typeof obj.start === 'number' ? obj.start * 1000 : undefined,
        duration:
          typeof obj.start === 'number' && typeof obj.end === 'number'
            ? (obj.end - obj.start) * 1000
            : undefined,
      };
    }
    return { text: String(s) };
  });
}
