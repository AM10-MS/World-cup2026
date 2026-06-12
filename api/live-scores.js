const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

function json(response, statusCode, payload) {
  response.status(statusCode).json({
    ...payload,
    updatedAt: new Date().toISOString(),
  });
}

function parseScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function dateKey(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function uniqueById(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = match.id ?? `${match.utcDate}-${match.homeTeam}-${match.awayTeam}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text.slice(0, 240) };
  }
  if (!response.ok) {
    throw new Error(payload.message ?? `${response.status} ${response.statusText}`);
  }
  return payload;
}

function normalizeEspnStatus(status) {
  const type = status?.type ?? {};
  if (type.completed || type.state === "post") return "FINISHED";
  if (type.state === "in") {
    return type.name === "STATUS_HALFTIME" ? "PAUSED" : "IN_PLAY";
  }
  if (type.state === "pre") return "SCHEDULED";
  if (type.name?.includes("POSTPONED")) return "POSTPONED";
  if (type.name?.includes("CANCELED") || type.name?.includes("CANCELLED")) return "CANCELLED";
  return type.name ?? "SCHEDULED";
}

function normalizeEspnMatch(event) {
  const competition = event.competitions?.[0] ?? {};
  const competitors = competition.competitors ?? [];
  const home = competitors.find((team) => team.homeAway === "home") ?? competitors[0] ?? {};
  const away = competitors.find((team) => team.homeAway === "away") ?? competitors[1] ?? {};
  const status = competition.status ?? event.status ?? {};

  return {
    id: event.id,
    utcDate: competition.date ?? event.date,
    status: normalizeEspnStatus(status),
    statusDetail: status.type?.shortDetail ?? status.type?.detail ?? status.type?.description ?? null,
    displayClock: status.displayClock ?? null,
    stage: event.season?.slug ?? null,
    group: competition.group?.name ?? null,
    matchday: null,
    homeTeam: home.team?.displayName ?? home.team?.name ?? "TBD",
    awayTeam: away.team?.displayName ?? away.team?.name ?? "TBD",
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
    winner: home.winner ? home.team?.displayName : away.winner ? away.team?.displayName : null,
    provider: "ESPN",
    lastUpdated: competition.lastUpdated ?? null,
  };
}

async function fetchEspnMatches() {
  const urls = [
    ESPN_BASE,
    `${ESPN_BASE}?dates=${dateKey(-1)}`,
    `${ESPN_BASE}?dates=${dateKey(0)}`,
    `${ESPN_BASE}?dates=${dateKey(1)}`,
  ];

  const payloads = await Promise.allSettled(urls.map((url) => fetchJson(url)));
  const matches = uniqueById(payloads
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value.events ?? [])
    .map(normalizeEspnMatch));

  const rejected = payloads.find((result) => result.status === "rejected");
  if (!matches.length && rejected) throw rejected.reason;

  return {
    ok: matches.length > 0,
    configured: true,
    provider: "ESPN",
    count: matches.length,
    message: matches.length ? "Live scores loaded from ESPN." : "ESPN did not return World Cup matches yet.",
    matches,
  };
}

function normalizeFootballDataMatch(match) {
  const score = match.score ?? {};
  const fullTime = score.fullTime ?? {};
  const regularTime = score.regularTime ?? {};
  const currentHome = fullTime.home ?? regularTime.home ?? null;
  const currentAway = fullTime.away ?? regularTime.away ?? null;

  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    stage: match.stage ?? null,
    group: match.group ?? null,
    matchday: match.matchday ?? null,
    homeTeam: match.homeTeam?.name ?? "TBD",
    awayTeam: match.awayTeam?.name ?? "TBD",
    homeScore: currentHome,
    awayScore: currentAway,
    winner: score.winner ?? null,
    provider: "football-data.org",
    lastUpdated: match.lastUpdated ?? null,
  };
}

async function fetchFootballDataMatches() {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    return {
      ok: false,
      configured: false,
      provider: "football-data.org",
      message: "Missing FOOTBALL_DATA_API_KEY environment variable in Vercel.",
      matches: [],
    };
  }

  const url = new URL(`${FOOTBALL_DATA_BASE}/competitions/WC/matches`);
  url.searchParams.set("season", "2026");

  const payload = await fetchJson(url, {
    headers: {
      "X-Auth-Token": token,
    },
  });

  const matches = (payload.matches ?? []).map(normalizeFootballDataMatch);
  return {
    ok: matches.length > 0,
    configured: true,
    provider: "football-data.org",
    count: payload.resultSet?.count ?? matches.length,
    message: matches.length ? "Live scores loaded from football-data.org." : "football-data.org did not return World Cup matches yet.",
    matches,
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=45");

  try {
    const espn = await fetchEspnMatches();
    if (espn.matches.length) return json(response, 200, espn);
  } catch (error) {
    try {
      const footballData = await fetchFootballDataMatches();
      if (footballData.matches.length) return json(response, 200, footballData);
      return json(response, 200, {
        ok: false,
        configured: true,
        provider: "ESPN + football-data.org",
        message: `ESPN feed unavailable. ${footballData.message}`,
        matches: [],
      });
    } catch (fallbackError) {
      return json(response, 200, {
        ok: false,
        configured: true,
        provider: "ESPN + football-data.org",
        message: `Live score feeds are unavailable: ${error.message}; ${fallbackError.message}`,
        matches: [],
      });
    }
  }

  const footballData = await fetchFootballDataMatches();
  return json(response, 200, footballData.matches.length ? footballData : {
    ok: false,
    configured: true,
    provider: "ESPN + football-data.org",
    message: `No live score results returned yet. ${footballData.message}`,
    matches: [],
  });
}
