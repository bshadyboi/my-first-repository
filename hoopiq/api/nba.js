/**
 * HoopIQ public NBA data proxy.
 * Sources are unofficial ESPN endpoints; availability and license conditions
 * should be evaluated before broad commercial use.
 */
module.exports = async function handler(req, res) {
  try {
    const u = new URL(req.url, "https://hoopiq.invalid");
    const resource = u.searchParams.get("resource") || "leaders";
    const now = new Date();
    const defaultSeason = now.getUTCFullYear() + (now.getUTCMonth() >= 9 ? 1 : 0);
    const season = Number(u.searchParams.get("season") || defaultSeason);
    if (!Number.isInteger(season) || season < 2020 || season > 2035) {
      return res.status(400).json({ ok: false, error: "Invalid season" });
    }
    let url, ttl;
    if (resource === "leaders") {
      url = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?season=" +
        season + "&seasontype=2&limit=100&sort=offensive.avgPoints:desc";
      ttl = 900;
    } else if (resource === "scoreboard") {
      const date = u.searchParams.get("date") || now.toISOString().slice(0,10).replace(/-/g,"");
      if (!/^\d{8}$/.test(date)) return res.status(400).json({ ok:false, error:"Invalid date" });
      url = "https://cdn.espn.com/core/nba/scoreboard?xhr=1&date=" + date;
      ttl = 60;
    } else {
      return res.status(400).json({ ok:false, error:"Unknown resource" });
    }
    const request = async (endpoint) => fetch(endpoint, {
      headers: { Accept:"application/json" },
      signal: AbortSignal.timeout(10000)
    });
    const response = await request(url);
    if (!response.ok) return res.status(502).json({ ok:false, error:"NBA provider HTTP " + response.status });
    const data = await response.json();
    if (resource === "leaders" && Array.isArray(data.athletes) && data.pagination?.pages > 1) {
      for (let page = 2; page <= Math.min(8, data.pagination.pages); page++) {
        try {
          const next = await request(url + "&page=" + page);
          if (!next.ok) break;
          const part = await next.json();
          if (!Array.isArray(part.athletes) || !part.athletes.length) break;
          data.athletes.push(...part.athletes);
        } catch (_) { break; }
      }
    }
    res.setHeader("Cache-Control", "public, s-maxage=" + ttl + ", stale-while-revalidate=" + ttl*2);
    return res.status(200).json({ ok:true, resource, source:"ESPN unofficial", retrievedAt:now.toISOString(), data });
  } catch (_) {
    return res.status(503).json({ ok:false, error:"NBA provider temporarily unavailable" });
  }
};
