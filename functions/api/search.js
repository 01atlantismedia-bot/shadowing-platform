// Cloudflare Pages Function: GET /api/search?q=...  (needs env var YOUTUBE_API_KEY, optional)
const json = (o, s = 200, cache = false) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache ? 'public, max-age=86400' : 'no-store' }
});
export async function onRequestGet({ request, env }) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (!q) return json({ error: 'Missing query' }, 400);
  if (!env.YOUTUBE_API_KEY) return json({ error: 'No YOUTUBE_API_KEY set' }, 501);
  const url = 'https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '8', q, videoEmbeddable: 'true', videoCaption: 'closedCaption',
    videoDuration: 'medium', relevanceLanguage: 'en', safeSearch: 'strict', key: env.YOUTUBE_API_KEY
  });
  try {
    const r = await fetch(url); const d = await r.json();
    if (!r.ok) return json({ error: (d.error && d.error.message) || 'YouTube API error' }, 502);
    const items = (d.items || []).filter(i => i.id && i.id.videoId).map(i => ({
      id: i.id.videoId, channel: i.snippet.channelTitle,
      title: i.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    }));
    return json({ items }, 200, true);
  } catch (e) { return json({ error: 'Search failed' }, 502); }
}
