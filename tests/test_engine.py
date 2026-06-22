"""Regression tests for the Monte Carlo engine.

These codify the invariants that were previously hand-checked. They run off the
committed snapshot (no network) and at a small sim count, since the probability
invariants are exact regardless of N.
"""
import collections
import json
import os

import pytest

import _engine as E

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 6000


@pytest.fixture(scope="module")
def assets():
    return E.load_assets()


@pytest.fixture(scope="module")
def state(assets):
    doc = json.load(
        open(os.path.join(ROOT, "data", "wc2026_snapshot.json"), encoding="utf-8")
    )
    played, remaining, completed, ko_results, as_of = E._parse_openfootball(doc, assets[3])
    return {
        "played": played,
        "remaining": remaining,
        "completed": completed,
        "ko_results": ko_results,
        "as_of": as_of,
        "source": "snapshot",
    }


@pytest.fixture(scope="module")
def agg(assets, state):
    sim = E.simulate(N, None, assets, state)
    return E.aggregate(sim, "Canada", "Portugal")


# ----------------------------------------------------------------------------- #
# match-model winner logic
# ----------------------------------------------------------------------------- #
def test_ko_winner_full_time():
    assert E._ko_winner("A", "B", {"ft": [2, 1]}) == "A"
    assert E._ko_winner("A", "B", {"ft": [0, 3]}) == "B"


def test_ko_winner_extra_time_and_penalties():
    assert E._ko_winner("A", "B", {"ft": [1, 1], "et": [2, 1]}) == "A"
    assert E._ko_winner("A", "B", {"ft": [1, 1], "et": [1, 1], "pen": [3, 4]}) == "B"


def test_ko_winner_undecided_returns_none():
    assert E._ko_winner("A", "B", {"ft": [1, 1]}) is None
    assert E._ko_winner("A", "B", {}) is None


# ----------------------------------------------------------------------------- #
# probability invariants
# ----------------------------------------------------------------------------- #
def test_title_odds_sum_to_one(agg):
    total = sum(t["title"] for t in agg["teams"].values())
    assert abs(total - 1.0) < 1e-3


def test_group_win_sums_to_one_per_group(assets, agg):
    teams_meta = assets[1]
    by_group = collections.defaultdict(float)
    for name, t in agg["teams"].items():
        by_group[teams_meta[name]["group"]] += t["groupWin"]
    assert len(by_group) == 12
    for g, v in by_group.items():
        assert abs(v - 1.0) < 1e-3, f"group {g} sums to {v}"


def test_reach_is_monotonically_decreasing(agg):
    for name, t in agg["teams"].items():
        r = t["reachByRound"]
        ladder = [r["R32"], r["R16"], r["QF"], r["SF"], r["F"], r["champion"]]
        for i in range(len(ladder) - 1):
            assert ladder[i] >= ladder[i + 1] - 1e-9, f"{name} not monotonic: {ladder}"


def test_pair_meet_not_above_min_reach(agg):
    p = agg["pair"]["meet"]
    a = agg["teams"]["Canada"]["reachR16"]
    b = agg["teams"]["Portugal"]["reachR16"]
    assert p <= min(a, b) + 1e-9


def test_group_win_plus_runner_up_within_reachR32(agg):
    # finishing 1st or 2nd is a subset of reaching the knockouts
    for name, t in agg["teams"].items():
        assert t["groupWin"] + t["runnerUp"] <= t["reachR32"] + 1e-6


# ----------------------------------------------------------------------------- #
# determinism + pinning
# ----------------------------------------------------------------------------- #
def test_determinism(assets, state):
    a1 = E.aggregate(E.simulate(N, None, assets, state), "Canada", "Portugal")
    a2 = E.aggregate(E.simulate(N, None, assets, state), "Canada", "Portugal")
    assert a1["teams"]["Argentina"]["title"] == a2["teams"]["Argentina"]["title"]
    assert a1["pair"]["meet"] == a2["pair"]["meet"]


def test_pinned_knockout_result_cascades(assets, state):
    idx = assets[3]
    pinned = dict(state)
    # pin M85 (Vancouver R32): Canada beats Qatar
    pinned["ko_results"] = [(85, idx["Canada"], idx["Qatar"])]
    agg = E.aggregate(E.simulate(N, None, assets, pinned), "Canada", "Portugal")
    assert agg["teams"]["Canada"]["reachR16"] > 0.999  # they won their R32 in every sim
    total = sum(t["title"] for t in agg["teams"].values())
    assert abs(total - 1.0) < 1e-3  # still a valid distribution
