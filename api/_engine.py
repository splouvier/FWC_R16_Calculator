"""Monte Carlo engine for the FIFA World Cup 2026 knockout explorer.

A single vectorized run (over N simulations) of the whole tournament — remaining
group games, third-place qualification + slotting, then R32 -> R16 -> QF -> SF ->
Final — produces every per-team and every pairwise answer at once. The HTTP handler
(simulate.py) caches the default run and just reads aggregates out of it.

Pure-Python/NumPy; no framework. Importable for tests and runnable as a CLI:
    python3 api/_engine.py            # quick self-check
"""
from __future__ import annotations

import json
import math
import os
import time
import urllib.request

import numpy as np

# --------------------------------------------------------------------------- #
# Asset loading
# --------------------------------------------------------------------------- #
OPENFOOTBALL_URL = (
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
)
_HERE = os.path.dirname(os.path.abspath(__file__))


def _find(rel):
    """Locate a data file whether running from repo root, api/, or a bundle."""
    for base in (_HERE, os.path.dirname(_HERE), os.getcwd()):
        p = os.path.join(base, rel)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(rel)


def load_assets():
    bracket = json.load(open(_find(os.path.join("data", "bracket.json")), encoding="utf-8"))
    teams = json.load(open(_find(os.path.join("data", "teams.json")), encoding="utf-8"))["teams"]
    names = sorted(teams.keys())
    idx = {n: i for i, n in enumerate(names)}
    ratings = np.array([teams[n]["rating"] for n in names], dtype=np.float64)
    return bracket, teams, names, idx, ratings


# --------------------------------------------------------------------------- #
# Live data: current standings + remaining group fixtures
# --------------------------------------------------------------------------- #
def _parse_openfootball(doc, idx):
    """Return (played_stats, remaining_fixtures, as_of).

    played_stats[name] = [pts, gf, ga]; remaining = list of (group, home, away).
    """
    played = {n: [0, 0, 0] for n in idx}
    remaining = []
    as_of = None
    for m in doc["matches"]:
        g = m.get("group")
        if not g:
            continue
        group = g.replace("Group ", "").strip()
        h, a = m["team1"], m["team2"]
        if h not in idx or a not in idx:
            continue
        ft = (m.get("score") or {}).get("ft")
        if ft and len(ft) == 2:
            hg, ag = int(ft[0]), int(ft[1])
            played[h][1] += hg; played[h][2] += ag
            played[a][1] += ag; played[a][2] += hg
            if hg > ag:
                played[h][0] += 3
            elif ag > hg:
                played[a][0] += 3
            else:
                played[h][0] += 1; played[a][0] += 1
            if m.get("date"):
                as_of = m["date"] if not as_of else max(as_of, m["date"])
        else:
            remaining.append((group, h, a))
    return played, remaining, as_of


def fetch_state(idx, timeout=6):
    """Fetch live standings; fall back to the committed snapshot. Never raises."""
    source = "live"
    try:
        with urllib.request.urlopen(OPENFOOTBALL_URL, timeout=timeout) as r:
            doc = json.loads(r.read().decode("utf-8"))
    except Exception:
        source = "snapshot"
        doc = json.load(open(_find(os.path.join("data", "wc2026_snapshot.json")), encoding="utf-8"))
    played, remaining, as_of = _parse_openfootball(doc, idx)
    return {"played": played, "remaining": remaining, "as_of": as_of, "source": source}


# --------------------------------------------------------------------------- #
# Match model (ported & generalized from the legacy app)
# --------------------------------------------------------------------------- #
def _xg(diff):
    """Expected goals for a team rated `diff` above its opponent."""
    return np.maximum(0.18, 1.30 * np.exp(0.85 * diff))


def _sim_goals(rng, rate_a, rate_b):
    return rng.poisson(rate_a), rng.poisson(rate_b)


def _winner(rng, idx_a, idx_b, rat_a, rat_b):
    """Vectorized knockout result: returns winner index array (ties -> rating-weighted coin flip)."""
    ga, gb = _sim_goals(rng, _xg(rat_a - rat_b), _xg(rat_b - rat_a))
    a_wins = ga > gb
    b_wins = gb > ga
    tie = ~(a_wins | b_wins)
    p_a = np.clip(0.5 + 0.18 * (rat_a - rat_b), 0.15, 0.85)
    coin = rng.random(idx_a.shape) < p_a
    a_takes = a_wins | (tie & coin)
    return np.where(a_takes, idx_a, idx_b)


# --------------------------------------------------------------------------- #
# Core simulation
# --------------------------------------------------------------------------- #
ROUND_SEQ = ["R32", "R16", "QF", "SF", "F"]  # furthest-round ladder (3P handled separately)


def _forced_lookup(scenario, idx):
    """Map frozenset({teamA,teamB}) -> winner name (or 'draw') for forced games."""
    out = {}
    for f in (scenario or {}).get("forced", []) or []:
        h, a, w = f.get("home"), f.get("away"), f.get("winner")
        if h not in idx or a not in idx:
            continue
        if w == "draw" or w == h or w == a:
            out[frozenset((h, a))] = w
    return out


def simulate(N, scenario, assets, state, seed=778899):
    bracket, teams, names, idx, ratings = assets
    rng = np.random.default_rng(seed)
    T = len(names)

    # ---- group stage: start from current points/goals, sim the remainder --- #
    pts = np.zeros((N, T)); gf = np.zeros((N, T)); ga = np.zeros((N, T))
    for n, (p, f, a) in state["played"].items():
        i = idx[n]; pts[:, i] = p; gf[:, i] = f; ga[:, i] = a

    forced = _forced_lookup(scenario, idx)
    for group, h, a in state["remaining"]:
        ih, ia = idx[h], idx[a]
        fk = frozenset((h, a))
        if fk in forced:  # deterministic forced result with a representative scoreline
            w = forced[fk]
            if w == "draw":
                hg = np.ones(N); ag = np.ones(N)
            elif w == h:
                hg = np.full(N, 2.0); ag = np.full(N, 1.0)
            else:
                hg = np.full(N, 1.0); ag = np.full(N, 2.0)
        else:
            hg = rng.poisson(_xg(ratings[ih] - ratings[ia]), N).astype(float)
            ag = rng.poisson(_xg(ratings[ia] - ratings[ih]), N).astype(float)
        gf[:, ih] += hg; ga[:, ih] += ag; gf[:, ia] += ag; ga[:, ia] += hg
        hw = hg > ag; aw = ag > hg; dr = ~(hw | aw)
        pts[:, ih] += 3 * hw + dr; pts[:, ia] += 3 * aw + dr

    gd = gf - ga
    # ranking key per team: big weight on pts, then GD, then GF, then tiny jitter
    jitter = rng.random((N, T)) * 1e-3
    score = pts * 1e6 + gd * 1e3 + gf + jitter

    # ---- per-group ordering -> 1st/2nd/3rd; collect thirds --------------- #
    group_letters = sorted(bracket["groups"].keys())
    group_idx = {g: np.array([idx[t] for t in bracket["groups"][g]]) for g in group_letters}
    pos1 = {}; pos2 = {}; pos3 = {}
    third_team = np.empty((N, len(group_letters)), dtype=np.int64)
    third_score = np.empty((N, len(group_letters)), dtype=np.float64)
    for gi, g in enumerate(group_letters):
        members = group_idx[g]
        sub = score[:, members]                       # (N,4)
        order = np.argsort(-sub, axis=1)              # best first
        ranked = members[order]                       # (N,4) team indices
        pos1[g] = ranked[:, 0]; pos2[g] = ranked[:, 1]; pos3[g] = ranked[:, 2]
        third_team[:, gi] = ranked[:, 2]
        third_score[:, gi] = np.take_along_axis(sub, order[:, 2:3], axis=1)[:, 0]

    # ---- best 8 of 12 thirds, then slot them per R32 allowed-group sets --- #
    third_slots = _assign_thirds(bracket, group_letters, third_team, third_score, idx, names)

    # ---- knockout bracket ------------------------------------------------ #
    ko = sorted(bracket["knockout"], key=lambda k: k["num"])
    winner_of = {}                                   # match num -> (N,) winner idx
    loser_of = {}
    furthest = np.zeros((N, T), dtype=np.int8)        # 0=group .. 5=champion
    champion = None
    # meeting log: list of (round, venue, idxA(N), idxB(N)) for pair extraction
    meetings = []

    def resolve(slot):
        t = slot["type"]
        if t == "group_1st":
            return pos1[slot["group"]]
        if t == "group_2nd":
            return pos2[slot["group"]]
        if t == "group_3rd":
            return third_slots[slot["__slotid"]]
        if t == "winner_of":
            return winner_of[slot["match"]]
        if t == "loser_of":
            return loser_of[slot["match"]]
        raise ValueError(t)

    round_rank = {"R32": 1, "R16": 2, "QF": 3, "SF": 4, "F": 5}
    final_home = final_away = None
    for k in ko:
        home = resolve(k["home"]); away = resolve(k["away"])
        w = _winner(rng, home, away, ratings[home], ratings[away])
        l = np.where(w == home, away, home)
        winner_of[k["num"]] = w; loser_of[k["num"]] = l
        if k["round"] != "3P":
            # meeting log carries the winner so we can answer "if they meet, who wins?"
            meetings.append((k["round"], k.get("venue"), home, away, w))
            entry = round_rank[k["round"]]
            for arr in (home, away):
                np.maximum.at(furthest, (np.arange(N), arr), entry)
        if k["round"] == "F":
            final_home, final_away = home, away
            champion = w
            np.maximum.at(furthest, (np.arange(N), w), 6)  # champion tier

    return {
        "N": N, "names": names, "idx": idx,
        "pos1": pos1, "pos2": pos2, "champion": champion, "furthest": furthest,
        "meetings": meetings, "final": (final_home, final_away),
        "source": state["source"], "as_of": state["as_of"],
    }


def _assign_thirds(bracket, group_letters, third_team, third_score, idx, names):
    """Pick the 8 best thirds and assign them to R32 third-place slots.

    Returns dict slot_id -> (N,) team index. Each R32 'group_3rd' slot is tagged
    with a stable __slotid (mutating the bracket dict in place is fine; it is the
    in-memory copy). Assignment respects each slot's allowed-group set via a small
    per-sim bipartite matching; falls back to best-effort if no perfect matching.
    """
    N = third_team.shape[0]
    # enumerate the R32 third-place slots in match order
    slots = []
    for k in sorted(bracket["knockout"], key=lambda k: k["num"]):
        for side in ("home", "away"):
            s = k[side]
            if s["type"] == "group_3rd":
                sid = f"{k['num']}{side[0]}"
                s["__slotid"] = sid
                slots.append((sid, [group_letters.index(g) for g in s["groups"]]))
    S = len(slots)  # expected 8
    gi_of = {sid: i for i, (sid, _) in enumerate(slots)}
    allowed = [set(groups) for _, groups in slots]
    out = {sid: np.full(N, -1, dtype=np.int64) for sid, _ in slots}

    # rank thirds within each sim; the top S group-columns qualify
    order = np.argsort(-third_score, axis=1)          # (N,12) best group-column first
    qualgroups = order[:, :S].tolist()                 # per-sim list of qualifying columns

    for n in range(N):
        # bipartite match: slot -> a qualifying group-column it's allowed to take
        match_slot_to_group = _match(qualgroups[n], allowed)
        for si, gcol in match_slot_to_group.items():
            sid = slots[si][0]
            out[sid][n] = third_team[n, gcol]
    return out


def _match(qual_group_cols, allowed_sets):
    """Hungarian-free augmenting-path matching of S slots to S qualifying groups.

    qual_group_cols: list of group-column indices that qualified (length S).
    allowed_sets: list (len S) of sets of group-column indices each slot accepts.
    Returns {slot_index: group_column}. Best-effort if no perfect matching.
    """
    S = len(allowed_sets)
    slot_to_group = {}
    group_to_slot = {}

    def try_assign(si, seen):
        for gcol in qual_group_cols:
            if gcol in allowed_sets[si] and gcol not in seen:
                seen.add(gcol)
                if gcol not in group_to_slot or try_assign(group_to_slot[gcol], seen):
                    slot_to_group[si] = gcol
                    group_to_slot[gcol] = si
                    return True
        return False

    for si in range(S):
        try_assign(si, set())
    # best-effort fill for any unmatched slot (rare; keeps sim from crashing)
    if len(slot_to_group) < S:
        used = set(slot_to_group.values())
        leftover = [g for g in qual_group_cols if g not in used]
        for si in range(S):
            if si not in slot_to_group and leftover:
                slot_to_group[si] = leftover.pop()
    return slot_to_group


# --------------------------------------------------------------------------- #
# Aggregation -> JSON-able result for the API
# --------------------------------------------------------------------------- #
ROUND_LABEL = {1: "R32", 2: "R16", 3: "QF", 4: "SF", 5: "Final", 6: "Champion"}


def aggregate(sim, team_a=None, team_b=None):
    N = sim["N"]; names = sim["names"]; idx = sim["idx"]; furthest = sim["furthest"]
    champ = sim["champion"]

    # per-team: title odds, reach-by-round, expected furthest round, finish-position odds
    T = len(names)
    title = np.bincount(champ, minlength=T) / N
    reach = {  # cumulative P(reach at least round r)
        "R32": (furthest >= 1).mean(axis=0),
        "R16": (furthest >= 2).mean(axis=0),
        "QF": (furthest >= 3).mean(axis=0),
        "SF": (furthest >= 4).mean(axis=0),
        "F": (furthest >= 5).mean(axis=0),
    }
    exp_round = furthest.mean(axis=0)
    group_win = np.zeros(T)
    for arr in sim["pos1"].values():
        group_win += np.bincount(arr, minlength=T) / N
    runner_up = np.zeros(T)
    for arr in sim["pos2"].values():
        runner_up += np.bincount(arr, minlength=T) / N

    teams_out = {}
    for n, i in idx.items():
        teams_out[n] = {
            "title": round(float(title[i]), 5),
            "reachR16": round(float(reach["R16"][i]), 5),
            "reachR32": round(float(reach["R32"][i]), 5),
            "groupWin": round(float(group_win[i]), 5),
            "runnerUp": round(float(runner_up[i]), 5),
            "expRound": round(float(exp_round[i]), 4),
            "reachByRound": {
                "R32": round(float(reach["R32"][i]), 5),
                "R16": round(float(reach["R16"][i]), 5),
                "QF": round(float(reach["QF"][i]), 5),
                "SF": round(float(reach["SF"][i]), 5),
                "F": round(float(reach["F"][i]), 5),
                "champion": round(float(title[i]), 5),
            },
        }

    result = {
        "meta": {
            "nSims": N,
            "source": sim["source"],
            "asOf": sim["as_of"],
        },
        "teams": teams_out,
    }

    if team_a and team_b and team_a in idx and team_b in idx:
        ia, ib = idx[team_a], idx[team_b]
        by_round = {}
        total = np.zeros(N, dtype=bool)
        a_wins = 0  # times A wins the meeting (across all rounds)
        for rnd, venue, home, away, w in sim["meetings"]:
            hit = ((home == ia) & (away == ib)) | ((home == ib) & (away == ia))
            if not hit.any():
                continue
            total |= hit
            a_wins += int(((w == ia) & hit).sum())
            slot = by_round.setdefault(rnd, {"prob": 0.0, "venues": {}})
            slot["prob"] += float(hit.mean())
            if venue:
                slot["venues"][venue] = slot["venues"].get(venue, 0.0) + float(hit.mean())
        for slot in by_round.values():
            slot["prob"] = round(slot["prob"], 5)
            slot["venues"] = {v: round(p, 5) for v, p in slot["venues"].items()}
        meet_count = int(total.sum())
        result["pair"] = {
            "a": team_a, "b": team_b,
            "meet": round(float(total.mean()), 5),
            "byRound": by_round,
            # conditional: given they meet, how often does A advance?
            "aWinIfMeet": round(a_wins / meet_count, 5) if meet_count else None,
        }

    # global leaderboards (independent of the selected pair)
    result["boards"] = _leaderboards(sim, T)
    return result


def _pair_counts(home, away, T):
    """Vectorized count of unordered (home,away) pairs encoded as lo*T+hi."""
    lo = np.minimum(home, away)
    hi = np.maximum(home, away)
    return np.bincount(lo * T + hi, minlength=T * T)


def _top_pairs(counts, names, N, k):
    out = []
    for code in np.argsort(-counts)[:k]:
        c = counts[code]
        if c <= 0:
            break
        lo, hi = divmod(int(code), len(names))
        out.append({"a": names[lo], "b": names[hi], "prob": round(float(c) / N, 5)})
    return out


def _leaderboards(sim, T):
    names = sim["names"]
    # most likely final matchups
    fh, fa = sim["final"]
    finals = _top_pairs(_pair_counts(fh, fa, T), names, sim["N"], 8) if fh is not None else []
    # most likely meetings anywhere (each pair meets at most once per sim)
    anywhere = np.zeros(T * T)
    for _rnd, _venue, home, away, _w in sim["meetings"]:
        anywhere += _pair_counts(home, away, T)
    meetings = _top_pairs(anywhere, names, sim["N"], 12)
    return {"finals": finals, "meetAnywhere": meetings}


# --------------------------------------------------------------------------- #
# Request handling + caching (shared by the Vercel handler and the dev server)
# --------------------------------------------------------------------------- #
DEFAULT_SIMS = 24000
_ASSETS = None
_STATE = None
_STATE_AT = 0.0
_SIM_CACHE = {}          # key -> sim dict (raw arrays)
STATE_TTL = 600          # re-fetch live standings at most every 10 min per warm instance


def _assets_cached():
    global _ASSETS
    if _ASSETS is None:
        _ASSETS = load_assets()
    return _ASSETS


def _state_cached():
    global _STATE, _STATE_AT
    if _STATE is None or (time.time() - _STATE_AT) > STATE_TTL:
        _STATE = fetch_state(_assets_cached()[3])
        _STATE_AT = time.time()
    return _STATE


def serve(params):
    """params: {a, b, scenario, nSims}. Returns a JSON-able aggregate dict."""
    assets = _assets_cached()
    state = _state_cached()
    a = params.get("a") or "Canada"
    b = params.get("b") or "Portugal"
    scenario = params.get("scenario") or None
    n = int(params.get("nSims") or DEFAULT_SIMS)
    n = max(2000, min(n, 60000))

    key = json.dumps({"s": scenario, "n": n, "src": state["source"], "as": state["as_of"]},
                     sort_keys=True)
    sim = _SIM_CACHE.get(key)
    if sim is None:
        sim = simulate(n, scenario, assets, state)
        if len(_SIM_CACHE) > 24:           # bound memory on a warm instance
            _SIM_CACHE.clear()
        _SIM_CACHE[key] = sim
    out = aggregate(sim, a, b)
    out["meta"]["cached"] = sim is _SIM_CACHE.get(key)
    # current standings (played) + remaining group fixtures, for the UI
    out["standings"] = {
        n: {"pts": p, "gf": f, "ga": g, "gd": f - g}
        for n, (p, f, g) in state["played"].items()
    }
    out["upcoming"] = [
        {"group": grp, "home": h, "away": aw}
        for (grp, h, aw) in state["remaining"]
    ]
    return out


# --------------------------------------------------------------------------- #
# CLI self-check
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    assets = load_assets()
    state = fetch_state(assets[3])
    t0 = time.time()
    sim = simulate(20000, None, assets, state)
    agg = aggregate(sim, "Canada", "Portugal")
    dt = time.time() - t0
    print(f"source={agg['meta']['source']} asOf={agg['meta']['asOf']} sims={agg['meta']['nSims']} in {dt:.2f}s")
    print(f"Canada–Portugal meet anywhere: {agg['pair']['meet']*100:.2f}%")
    for rnd in ROUND_SEQ:
        if rnd in agg["pair"]["byRound"]:
            br = agg["pair"]["byRound"][rnd]
            top_v = max(br["venues"].items(), key=lambda x: x[1]) if br["venues"] else ("?", 0)
            print(f"  {rnd:4} {br['prob']*100:5.2f}%   top venue: {top_v[0]} ({top_v[1]*100:.2f}%)")
    # sanity: group-win + a few title odds
    print("Canada win Group B:", round(agg["teams"]["Canada"]["groupWin"], 3),
          "| Portugal win Group K:", round(agg["teams"]["Portugal"]["groupWin"], 3))
    top5 = sorted(agg["teams"].items(), key=lambda x: -x[1]["title"])[:5]
    print("Top title odds:", [(n, round(d["title"], 3)) for n, d in top5])
