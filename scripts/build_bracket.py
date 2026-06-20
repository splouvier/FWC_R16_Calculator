#!/usr/bin/env python3
"""Parse the openfootball 2026 snapshot into a clean bracket topology.

The snapshot lists 104 matches in canonical order (array index + 1 == FIFA match
number). Group matches are 1-72; the knockout matches reference qualifiers by slot
code (e.g. "1B", "2A", "3E/F/G/I/J") for the Round of 32, and by "W<n>" (winner of
match n) for every later round. We emit data/bracket.json: an ordered list of
knockout matches, each with its feeders resolved into a structured form the
simulation engine can consume directly.

Run:  python3 scripts/build_bracket.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = os.path.join(ROOT, "data", "wc2026_snapshot.json")
OUT = os.path.join(ROOT, "data", "bracket.json")

ROUND_ORDER = {
    "Round of 32": "R32",
    "Round of 16": "R16",
    "Quarter-final": "QF",
    "Semi-final": "SF",
    "Match for third place": "3P",
    "Final": "F",
}


def parse_slot(code):
    """Resolve a knockout slot code into a structured feeder."""
    code = code.strip()
    m = re.fullmatch(r"W(\d+)", code)
    if m:
        return {"type": "winner_of", "match": int(m.group(1))}
    m = re.fullmatch(r"L(\d+)", code)
    if m:
        return {"type": "loser_of", "match": int(m.group(1))}
    m = re.fullmatch(r"1([A-L])", code)
    if m:
        return {"type": "group_1st", "group": m.group(1)}
    m = re.fullmatch(r"2([A-L])", code)
    if m:
        return {"type": "group_2nd", "group": m.group(1)}
    m = re.fullmatch(r"3([A-L/]+)", code)
    if m:
        groups = [g for g in m.group(1).split("/") if g]
        return {"type": "group_3rd", "groups": groups}
    raise ValueError(f"Unrecognized slot code: {code!r}")


def main():
    data = json.load(open(SNAP, encoding="utf-8"))
    matches = data["matches"]

    knockout = []
    for i, x in enumerate(matches):
        rnd = x.get("round")
        if rnd not in ROUND_ORDER:
            continue
        num = i + 1  # FIFA match number == 1-based position in canonical list
        knockout.append(
            {
                "num": num,
                "round": ROUND_ORDER[rnd],
                "round_label": rnd,
                "date": x.get("date"),
                "venue": x.get("ground"),
                "home": parse_slot(x["team1"]),
                "away": parse_slot(x["team2"]),
            }
        )

    # group -> teams, for the engine's group model
    groups = {}
    for x in matches:
        g = x.get("group")
        if g:
            letter = g.replace("Group ", "").strip()
            groups.setdefault(letter, set()).update([x["team1"], x["team2"]])
    groups = {k: sorted(v) for k, v in sorted(groups.items())}

    bracket = {
        "source": "openfootball/worldcup.json (2026), parsed",
        "format": "12 groups; top 2 + 8 best thirds -> R32 -> R16 -> QF -> SF -> Final",
        "groups": groups,
        "knockout": knockout,
    }
    json.dump(bracket, open(OUT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"Wrote {OUT}: {len(knockout)} knockout matches, {len(groups)} groups")
    # quick sanity print
    by_round = {}
    for k in knockout:
        by_round.setdefault(k["round"], 0)
        by_round[k["round"]] += 1
    print("round counts:", by_round)
    van = [k for k in knockout if k["venue"] == "Vancouver"]
    print("Vancouver matches:", [(k["num"], k["round"], k["date"]) for k in van])


if __name__ == "__main__":
    main()
