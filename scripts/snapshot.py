#!/usr/bin/env python3
"""Capture a daily odds snapshot for momentum tracking + refresh the fallback data.

Run by the daily GitHub Action (and once locally to seed history):

    python3 scripts/snapshot.py            # from live openfootball data, dated today
    python3 scripts/snapshot.py --from-file data/wc2026_snapshot.json --date 2026-06-19

It:
  1. computes per-team odds (title, groupWin, reachR16) from the given standings,
  2. upserts an entry keyed by date into data/history.json,
  3. (live mode) refreshes data/wc2026_snapshot.json so the committed fallback
     stays current.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))
import _engine as E  # noqa: E402

HISTORY = os.path.join(ROOT, "data", "history.json")
SNAPSHOT = os.path.join(ROOT, "data", "wc2026_snapshot.json")
DEFAULT_SIM = os.path.join(ROOT, "data", "default-sim.json")
KEEP_KEYS = ("title", "groupWin", "reachR16")


def build_state_from_doc(doc, idx):
    played, remaining, completed, ko_results, as_of = E._parse_openfootball(doc, idx)
    return {
        "played": played, "remaining": remaining, "completed": completed,
        "ko_results": ko_results, "as_of": as_of, "source": "file",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-file", help="read standings from this JSON instead of live")
    ap.add_argument("--date", help="snapshot date (YYYY-MM-DD); default today UTC")
    ap.add_argument("--sims", type=int, default=24000)
    args = ap.parse_args()

    assets = E.load_assets()
    idx = assets[3]

    if args.from_file:
        doc = json.load(open(args.from_file, encoding="utf-8"))
        state = build_state_from_doc(doc, idx)
        live_doc = None
    else:
        try:
            with urllib.request.urlopen(E.OPENFOOTBALL_URL, timeout=15) as r:
                live_doc = json.loads(r.read().decode("utf-8"))
            state = build_state_from_doc(live_doc, idx)
        except Exception as e:
            print(f"live fetch failed ({e}); falling back to committed snapshot")
            live_doc = None
            state = E.fetch_state(idx)

    date = args.date or dt.datetime.now(dt.timezone.utc).date().isoformat()

    sim = E.simulate(args.sims, None, assets, state)
    agg = E.aggregate(sim, None, None)
    teams = {
        n: {k: round(s[k], 5) for k in KEEP_KEYS}
        for n, s in agg["teams"].items()
    }
    entry = {"date": date, "asOf": state["as_of"], "teams": teams}

    history = {"snapshots": []}
    if os.path.exists(HISTORY):
        history = json.load(open(HISTORY, encoding="utf-8"))
    snaps = [s for s in history.get("snapshots", []) if s["date"] != date]
    snaps.append(entry)
    snaps.sort(key=lambda s: s["date"])
    json.dump({"snapshots": snaps}, open(HISTORY, "w", encoding="utf-8"), indent=2)
    print(f"history: wrote {date} ({len(snaps)} snapshots total)")

    # keep the committed fallback fresh when we have live data
    if live_doc is not None:
        json.dump(live_doc, open(SNAPSHOT, "w", encoding="utf-8"), ensure_ascii=False)
        print("snapshot: refreshed data/wc2026_snapshot.json")

    # precompute the default response so the page can render instantly (no cold
    # serverless call on first paint); the live fetch refreshes it on mount.
    E._STATE = None  # force serve() to use fresh state consistent with this run
    default_out = E.serve({"a": "Canada", "b": "Portugal"})
    json.dump(default_out, open(DEFAULT_SIM, "w", encoding="utf-8"), ensure_ascii=False)
    print("wrote data/default-sim.json")


if __name__ == "__main__":
    main()
