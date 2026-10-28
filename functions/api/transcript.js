// Cloudflare Pages Function: GET /api/transcript?id=VIDEO_ID
// Fetches YouTube captions server-side (browsers can't, due to CORS). Unofficial, so it can break if YouTube changes things.
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': s === 200 ? 'public, max-age=86400' : 'no-store' }
});
const dec = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[\w-]{11}$/.test(id)) return json({ error: 'Bad video id' }, 400);
  try {
    const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip' },
      body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'en', gl: 'US' } }, videoId: id })
    });
    const d = await r.json();
    const tracks = (d.captions && d.captions.playerCaptionsTracklistRenderer && d.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    if (!tracks.length) return json({ error: 'No captions available for this video' }, 404);
    const t = tracks.find(x => x.languageCode === 'en' && x.kind !== 'asr') || tracks.find(x => (x.languageCode || '').startsWith('en')) || tracks[0];
    const xml = await (await fetch(t.baseUrl.replace(/&fmt=\w+/, ''))).text();
    const items = [];
    for (const m of xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) {
      const text = dec(m[2]); if (text) items.push({ start: parseFloat(m[1]), text });
    }
    if (!items.length) for (const m of xml.matchAll(/<p t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)) {
      const text = dec(m[2]); if (text) items.push({ start: +m[1] / 1000, text });
    }
    if (!items.length) return json({ error: 'No captions available for this video' }, 404);
    return json({ items });
  } catch (e) {
    return json({ error: 'Could not fetch captions' }, 502);
  }
}
