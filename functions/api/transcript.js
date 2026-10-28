// Cloudflare Pages Function: GET /api/transcript?id=VIDEO_ID
// Asks YouTube for captions, trying several client types. Unofficial: YouTube may block some videos or servers.
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': s === 200 ? 'public, max-age=86400' : 'no-store' }
});
const dec = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const CLIENTS = [
  { c: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34 }, ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip' },
  { c: { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' }, ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)' },
  { c: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' }, ua: 'Mozilla/5.0', third: true }
];
function parse(xml) {
  const items = [];
  for (const m of xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)) { const t = dec(m[2]); if (t) items.push({ start: parseFloat(m[1]), text: t }); }
  if (!items.length) for (const m of xml.matchAll(/<p t="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)) { const t = dec(m[2]); if (t) items.push({ start: +m[1] / 1000, text: t }); }
  return items;
}
export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[\w-]{11}$/.test(id)) return json({ error: 'Bad video id' }, 400);
  let why = 'no captions found';
  for (const k of CLIENTS) {
    try {
      const body = { context: { client: Object.assign({ hl: 'en', gl: 'US' }, k.c) }, videoId: id };
      if (k.third) body.context.thirdParty = { embedUrl: 'https://www.youtube.com/' };
      const d = await (await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': k.ua }, body: JSON.stringify(body)
      })).json();
      const ps = d.playabilityStatus;
      if (ps && ps.status && ps.status !== 'OK') why = ps.status + (ps.reason ? ': ' + ps.reason : '');
      const tracks = (d.captions && d.captions.playerCaptionsTracklistRenderer && d.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
      if (!tracks.length) continue;
      const t = tracks.find(x => x.languageCode === 'en' && x.kind !== 'asr') || tracks.find(x => (x.languageCode || '').startsWith('en')) || tracks[0];
      const items = parse(await (await fetch(t.baseUrl.replace(/&fmt=\w+/, ''), { headers: { 'User-Agent': k.ua } })).text());
      if (items.length) return json({ items });
      why = 'caption file was empty';
    } catch (e) { why = 'request failed'; }
  }
  return json({ error: why }, 404);
}
