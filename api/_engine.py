"""Monte Carlo engine for the FIFA World Cup 2026 knockout explorer.

A single vectorized run (over N simulations) of the whole tournament — remaining
group games, third-place qualification + slotting, then R32 -> R16 -> QF -> SF ->
Final — produces every per-team and every pairwise answer at once. The HTTP handler
(simulate.py) caches the default run and just reads aggregates out of it.

Pure-Python/NumPy; no framework. Importable for tests and runnable as a CLI:
    python3 api/_engine.py            # quick self-check
"""
from __future__ import annotations

import datetime as _dt
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


# Co-hosts play the bulk of their games at home; give them a modest, well-documented
# rating bump to reflect real host overperformance (see the Method tab).
HOST_NATIONS = {"Canada", "Mexico", "USA"}
HOST_BONUS = 0.07


def load_assets():
    bracket = json.load(open(_find(os.path.join("data", "bracket.json")), encoding="utf-8"))
    teams = json.load(open(_find(os.path.join("data", "teams.json")), encoding="utf-8"))["teams"]
    names = sorted(teams.keys())
    idx = {n: i for i, n in enumerate(names)}
    ratings = np.array(
        [teams[n]["rating"] + (HOST_BONUS if n in HOST_NATIONS else 0.0) for n in names],
        dtype=np.float64,
    )
    return bracket, teams, names, idx, ratings


# --------------------------------------------------------------------------- #
# Live data: current standings + remaining group fixtures
# --------------------------------------------------------------------------- #
def _ko_winner(h, a, score):
    """Winner of a decided knockout game: penalties → extra time → full time."""
    for key in ("pen", "p", "ps"):  # penalty shootout decides
        v = score.get(key)
        if v and len(v) == 2 and v[0] != v[1]:
            return h if v[0] > v[1] else a
    et = score.get("et")  # after extra time
    if et and len(et) == 2 and et[0] != et[1]:
        return h if et[0] > et[1] else a
    ft = score.get("ft")  # decided in 90'
    if ft and len(ft) == 2 and ft[0] != ft[1]:
        return h if ft[0] > ft[1] else a
    return None


def _parse_openfootball(doc, idx):
    """Return (played_stats, remaining_fixtures, completed_results, ko_results, as_of).

    played_stats[name] = [pts, gf, ga]; remaining = list of (group, home, away);
    completed = finished group games (home, away, hg, ag) for calibration;
    ko_results = finished knockout games (match_num, winner_idx, loser_idx) — these
    get pinned in the sim so it stops re-playing games that already happened.
    """
    played = {n: [0, 0, 0] for n in idx}
    remaining = []
    completed = []
    ko_results = []
    as_of = None
    for i, m in enumerate(doc["matches"]):
        h, a = m["team1"], m["team2"]
        score = m.get("score") or {}
        g = m.get("group")
        if not g:
            # knockout match — pin it only once it's been played with real teams
            if h in idx and a in idx:
                win = _ko_winner(h, a, score)
                if win:
                    lose = a if win == h else h
                    ko_results.append((i + 1, idx[win], idx[lose]))  # num == array pos + 1
                    if m.get("date"):
                        as_of = m["date"] if not as_of else max(as_of, m["date"])
            continue
        group = g.replace("Group ", "").strip()
        if h not in idx or a not in idx:
            continue
        ft = score.get("ft")
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
            completed.append((h, a, hg, ag))
            if m.get("date"):
                as_of = m["date"] if not as_of else max(as_of, m["date"])
        else:
            remaining.append((group, h, a))
    return played, remaining, completed, ko_results, as_of


def fetch_state(idx, timeout=6):
    """Fetch live standings; fall back to the committed snapshot. Never raises."""
    source = "live"
    try:
        with urllib.request.urlopen(OPENFOOTBALL_URL, timeout=timeout) as r:
            doc = json.loads(r.read().decode("utf-8"))
    except Exception:
        source = "snapshot"
        doc = json.load(open(_find(os.path.join("data", "wc2026_snapshot.json")), encoding="utf-8"))
    played, remaining, completed, ko_results, as_of = _parse_openfootball(doc, idx)
    return {
        "played": played, "remaining": remaining, "completed": completed,
        "ko_results": ko_results, "as_of": as_of, "source": source,
    }


# --------------------------------------------------------------------------- #
# Match model (ported & generalized from the legacy app)
# --------------------------------------------------------------------------- #
def _xg(diff):
    """Expected goals for a team rated `diff` above its opponent.

    Base rate 1.30 (≈ average goals-per-team in a balanced game); the exponent
    controls how sharply a rating edge converts into goals. Floored at 0.18 so
    even big underdogs always carry a puncher's chance.
    """
    return np.maximum(0.18, 1.30 * np.exp(0.92 * diff))


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

    # knockout games that have already been played get pinned to their real result
    pinned = {num: (wi, li) for (num, wi, li) in state.get("ko_results", [])}

    round_rank = {"R32": 1, "R16": 2, "QF": 3, "SF": 4, "F": 5}
    final_home = final_away = None
    for k in ko:
        if k["num"] in pinned:
            # real result: fix winner/loser deterministically across every sim
            wi, li = pinned[k["num"]]
            home = np.full(N, wi, dtype=np.int64)
            away = np.full(N, li, dtype=np.int64)
            w = home
            l = away
        else:
            home = resolve(k["home"]); away = resolve(k["away"])
            w = _winner(rng, home, away, ratings[home], ratings[away])
            l = np.where(w == home, away, home)
        winner_of[k["num"]] = w; loser_of[k["num"]] = l
        if k["round"] != "3P":
            # meeting log carries match identity (num/venue/date) + the winner
            meetings.append(
                (k["round"], k["num"], k.get("venue"), k.get("date"), home, away, w)
            )
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
        for rnd, num, venue, date, home, away, w in sim["meetings"]:
            hit = ((home == ia) & (away == ib)) | ((home == ib) & (away == ia))
            if not hit.any():
                continue
            total |= hit
            a_wins += int(((w == ia) & hit).sum())
            p = float(hit.mean())
            slot = by_round.setdefault(rnd, {"prob": 0.0, "matches": {}})
            slot["prob"] += p
            # break the round down by the specific match (num/venue/date)
            m = slot["matches"].setdefault(
                num, {"num": num, "venue": venue, "date": date, "prob": 0.0}
            )
            m["prob"] += p
        for slot in by_round.values():
            slot["prob"] = round(slot["prob"], 5)
            slot["matches"] = sorted(
                (
                    {**m, "prob": round(m["prob"], 5)}
                    for m in slot["matches"].values()
                ),
                key=lambda m: -m["prob"],
            )
        meet_count = int(total.sum())
        p_meet = float(total.mean())
        # 95% Monte Carlo margin for the headline number (binomial standard error)
        meet_se = (p_meet * (1 - p_meet) / N) ** 0.5
        result["pair"] = {
            "a": team_a, "b": team_b,
            "meet": round(p_meet, 5),
            "meetCI": round(1.96 * meet_se, 5),
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
    for _rnd, _num, _venue, _date, home, away, _w in sim["meetings"]:
        anywhere += _pair_counts(home, away, T)
    meetings = _top_pairs(anywhere, names, sim["N"], 12)
    return {"finals": finals, "meetAnywhere": meetings}


# --------------------------------------------------------------------------- #
# Calibration: backtest the match model against completed games
# --------------------------------------------------------------------------- #
def _poisson_pmf(lmbda, kmax=10):
    out = []
    p = math.exp(-lmbda)
    for k in range(kmax + 1):
        out.append(p)
        p *= lmbda / (k + 1)
    return out


def _match_probs(rh, ra):
    """Analytic P(home win), P(draw), P(away win) from two independent Poissons."""
    ph_goals = _poisson_pmf(float(_xg(rh - ra)))
    pa_goals = _poisson_pmf(float(_xg(ra - rh)))
    home = draw = away = 0.0
    for i, pi in enumerate(ph_goals):
        for j, pj in enumerate(pa_goals):
            pij = pi * pj
            if i > j:
                home += pij
            elif i == j:
                draw += pij
            else:
                away += pij
    return home, draw, away


def _calibration(completed, idx, ratings):
    """How the model's pre-match probabilities line up with actual results."""
    n = len(completed)
    if n == 0:
        return {"n": 0}
    correct = 0
    brier = 0.0
    fav_wins = fav_games = 0
    BINS = 5
    bin_pred = [0.0] * BINS
    bin_act = [0.0] * BINS
    bin_cnt = [0] * BINS
    for h, a, hg, ag in completed:
        rh, ra = ratings[idx[h]], ratings[idx[a]]
        ph, pd, pa = _match_probs(rh, ra)
        probs = (ph, pd, pa)
        actual = 0 if hg > ag else (1 if hg == ag else 2)  # H / D / A
        if max(range(3), key=lambda k: probs[k]) == actual:
            correct += 1
        y = [1.0 if actual == k else 0.0 for k in range(3)]
        brier += sum((probs[k] - y[k]) ** 2 for k in range(3))
        if rh != ra:
            fav_games += 1
            fav_is_home = rh > ra
            if (fav_is_home and hg > ag) or (not fav_is_home and ag > hg):
                fav_wins += 1
        # reliability: bucket each outcome's predicted prob vs whether it happened
        for k in range(3):
            b = min(BINS - 1, int(probs[k] * BINS))
            bin_pred[b] += probs[k]
            bin_act[b] += y[k]
            bin_cnt[b] += 1
    buckets = [
        {
            "predicted": round(bin_pred[b] / bin_cnt[b], 4),
            "actual": round(bin_act[b] / bin_cnt[b], 4),
            "n": bin_cnt[b],
        }
        for b in range(BINS)
        if bin_cnt[b] > 0
    ]
    return {
        "n": n,
        "accuracy": round(correct / n, 4),
        "brier": round(brier / n, 4),
        "favWinRate": round(fav_wins / fav_games, 4) if fav_games else None,
        "buckets": buckets,
    }


# --------------------------------------------------------------------------- #
# Request handling + caching (shared by the Vercel handler and the dev server)
# --------------------------------------------------------------------------- #
DEFAULT_SIMS = 24000
_ASSETS = None
_STATE = None
_STATE_AT = 0.0
_SIM_CACHE = {}          # key -> sim dict (raw arrays)
STATE_TTL = 300          # re-fetch live standings at most every 5 min per warm instance


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


_HISTORY = None
TREND_KEYS = ("title", "groupWin", "reachR16")


def _load_history():
    global _HISTORY
    if _HISTORY is None:
        try:
            doc = json.load(open(_find(os.path.join("data", "history.json")), encoding="utf-8"))
            _HISTORY = doc.get("snapshots", [])
        except Exception:
            _HISTORY = []
    return _HISTORY


def _trends(current_teams, today):
    """Per-team change in odds vs the most recent snapshot from before today."""
    prior = [s for s in _load_history() if s["date"] < today]
    if not prior:
        return None, None
    base = prior[-1]
    out = {}
    for n, cur in current_teams.items():
        b = base["teams"].get(n)
        if not b:
            continue
        out[n] = {k: round(cur[k] - b.get(k, 0.0), 5) for k in TREND_KEYS}
    return out, base["date"]


def _pair_meet(sim, a, b):
    """Lightweight P(two teams meet) from a sim, without the full aggregate."""
    ia, ib = sim["idx"][a], sim["idx"][b]
    total = np.zeros(sim["N"], dtype=bool)
    for _rnd, _num, _venue, _date, home, away, _w in sim["meetings"]:
        total |= ((home == ia) & (away == ib)) | ((home == ib) & (away == ia))
    return float(total.mean())


_SENS_CACHE = {}
SENS_SIMS = 8000  # lighter runs — we only need relative swings


def serve_sensitivity(params):
    """Rank upcoming games by how much they swing the dream meeting probability."""
    assets = _assets_cached()
    state = _state_cached()
    bracket, teams, names, idx, ratings = assets
    a = params.get("a") or "Canada"
    b = params.get("b") or "Portugal"
    meta = {"nSims": SENS_SIMS, "source": state["source"], "asOf": state["as_of"]}
    if a not in idx or b not in idx or a == b:
        return {"a": a, "b": b, "base": None, "sensitivity": [], "meta": meta}

    key = json.dumps({"a": a, "b": b, "src": state["source"], "as": state["as_of"]}, sort_keys=True)
    if key in _SENS_CACHE:
        return _SENS_CACHE[key]

    ga, gb = teams[a]["group"], teams[b]["group"]
    # games in either team's group decide who wins the group (the main driver);
    # put the two teams' own games first, then cap to bound the work.
    relevant = [(grp, h, aw) for (grp, h, aw) in state["remaining"] if grp in (ga, gb)]
    relevant.sort(key=lambda g: 0 if (g[1] in (a, b) or g[2] in (a, b)) else 1)
    relevant = relevant[:6]

    base_meet = _pair_meet(simulate(SENS_SIMS, None, assets, state), a, b)
    rows = []
    for grp, h, aw in relevant:
        outs = []
        for winner in (h, "draw", aw):
            sc = {"forced": [{"home": h, "away": aw, "winner": winner}]}
            meet = _pair_meet(simulate(SENS_SIMS, sc, assets, state), a, b)
            outs.append({"winner": winner, "meet": round(meet, 5)})
        vals = [o["meet"] for o in outs]
        rows.append({
            "group": grp, "home": h, "away": aw,
            "outcomes": outs, "swing": round(max(vals) - min(vals), 5),
        })
    rows.sort(key=lambda r: -r["swing"])
    out = {"a": a, "b": b, "base": round(base_meet, 5), "sensitivity": rows, "meta": meta}
    if len(_SENS_CACHE) > 16:
        _SENS_CACHE.clear()
    _SENS_CACHE[key] = out
    return out


def serve(params):
    """params: {a, b, scenario, nSims}. Returns a JSON-able aggregate dict."""
    if params.get("sensitivity"):
        return serve_sensitivity(params)
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
    # day-over-day momentum (only when we have a prior snapshot)
    today = _dt.datetime.now(_dt.timezone.utc).date().isoformat()
    trends, since = _trends(out["teams"], today)
    if trends and not scenario:
        out["trends"] = trends
        out["meta"]["trendSince"] = since
    # how the model has done so far + the daily odds history (pair-independent)
    out["calibration"] = _calibration(state.get("completed", []), assets[3], assets[4])
    out["history"] = _load_history()
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
            top = br["matches"][0] if br["matches"] else {"venue": "?", "date": "", "prob": 0}
            print(f"  {rnd:4} {br['prob']*100:5.2f}%   {top['venue']} {top.get('date','')} (M{top.get('num','?')})")
    # sanity: group-win + a few title odds
    print("Canada win Group B:", round(agg["teams"]["Canada"]["groupWin"], 3),
          "| Portugal win Group K:", round(agg["teams"]["Portugal"]["groupWin"], 3))
    top5 = sorted(agg["teams"].items(), key=lambda x: -x[1]["title"])[:5]
    print("Top title odds:", [(n, round(d["title"], 3)) for n, d in top5])
