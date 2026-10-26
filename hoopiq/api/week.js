/** Return seven real NBA calendar dates for fantasy lineup planning. */
module.exports = async function handler(req, res) {
  try {
    const u = new URL(req.url, "https://hoopiq.invalid");
    const start = u.searchParams.get("start");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "")) {
      return res.status(400).json({ ok:false, error:"Use start=YYYY-MM-DD" });
    }
    const begin = new Date(start + "T12:00:00Z");
    if (Number.isNaN(begin.getTime()) || begin.toISOString().slice(0,10) !== start) {
      return res.status(400).json({ ok:false, error:"Invalid start date" });
    }
    if (Math.abs(begin.getTime() - Date.now()) > 370*86400000) {
      return res.status(400).json({ ok:false, error:"Requested week outside supported range" });
    }
    const dates = Array.from({ length:7 }, (_,i) =>
      new Date(begin.getTime() + i*86400000).toISOString().slice(0,10));
    const jobs = await Promise.allSettled(dates.map(async (date) => {
      const r = await fetch("https://cdn.espn.com/core/nba/scoreboard?xhr=1&date=" + date.replace(/-/g,""), {
        headers:{ Accept:"application/json" }, signal:AbortSignal.timeout(10000)
      });
      if (!r.ok) throw Error("NBA provider unavailable");
      const json = await r.json();
      const events = json.content?.sbData?.events || json.events || [];
      return events.map((event) => {
        const teams = event.competitions?.[0]?.competitors || [];
        const home = teams.find(t => t.homeAway === "home");
        const away = teams.find(t => t.homeAway === "away");
        if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;
        return {
          id: String(event.id), date,
          home: home.team.abbreviation, away: away.team.abbreviation,
          status: event.status?.type?.description || "Scheduled",
          startTime: event.date || null
        };
      }).filter(Boolean);
    }));
    const valid = jobs.filter(j => j.status === "fulfilled");
    if (!valid.length) return res.status(502).json({ ok:false, error:"NBA schedule unavailable" });
    const seen = new Set(), games = [];
    for (const entry of valid) for (const game of entry.value) {
      if (!seen.has(game.id)) { seen.add(game.id); games.push(game); }
    }
    games.sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({
      ok:true, dates, games,
      partial:valid.length !== 7, checkedDays:valid.length,
      source:"ESPN unofficial", retrievedAt:new Date().toISOString()
    });
  } catch (_) {
    return res.status(503).json({ ok:false, error:"NBA schedule temporarily unavailable" });
  }
};
