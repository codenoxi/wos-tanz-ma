#!/usr/bin/env python3
"""Liest die Spotify-Playlists aus und schreibt data/tracks.js.

Aufruf (im Projektordner):  python3 tools/update_tracks.py

Nutzt die öffentliche Spotify-Embed-Seite, braucht also kein Spotify-Konto.
Hinweis: Die Embed-Seite liefert höchstens 100 Songs pro Playlist.
"""
import json
import re
import time
import urllib.request
from pathlib import Path

# Reihenfolge = Reihenfolge der Antwort-Buttons im Quiz
STYLES = [
    ("langsamer-walzer", "Langsamer Walzer", "3VcSzoEcKUfdvrvctbqqFN"),
    ("wiener-walzer", "Wiener Walzer", "7phmnG1p61cSeYncS7Z1ls"),
    ("tango", "Tango", "5k9HMP7Eej6SBCTByI8mBY"),
    ("quickstep", "Quickstep", "5oNvsJPoEmN5JoUyzH1cwE"),
    ("discofox", "Discofox", "37i9dQZF1EId2WE7AtnScx"),
    ("cha-cha-cha", "Cha-Cha-Cha", "0EZLyJeuv5j4nQ54bJz58J"),
    ("rumba", "Rumba", "036Ife352RMBfHptu6Htcd"),
    ("samba", "Samba", "2IDfUFAobdlMLz8Uw5AdAP"),
    ("mambo", "Mambo", "3vvsU64KNx1cRPFY6YjLsh"),
    ("jive", "Jive", "3xpgxEeZCpmRdbmkMDnabD"),
    ("boogie", "Boogie", "75r1DrNIbRqcM8FmU5aSTK"),
    ("paso-doble", "Paso Doble", "2iyz3cyXkLcEs7urY9yMS7"),
    ("polka", "Polka", "7HgPsC6wOGSPVxU7NC8bKh"),
    ("boarischer", "Boarischer", "4n9y3xN2xZY9h6eHflLOq1"),
]

NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def fetch_playlist(playlist_id):
    req = urllib.request.Request(
        f"https://open.spotify.com/embed/playlist/{playlist_id}",
        headers={"User-Agent": "Mozilla/5.0 (Tanzquiz-Updater)"},
    )
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    data = json.loads(NEXT_DATA.search(html).group(1))
    return data["props"]["pageProps"]["state"]["data"]["entity"]["trackList"]


def main():
    tracks = {}  # track-id -> eintrag; ein Song kann in mehreren Playlists sein
    for idx, (style_id, name, playlist_id) in enumerate(STYLES):
        items = fetch_playlist(playlist_id)
        usable = 0
        for t in items:
            preview = (t.get("audioPreview") or {}).get("url")
            if not preview or not t.get("isPlayable", True):
                continue
            tid = t["uri"].split(":")[-1]
            entry = tracks.setdefault(
                tid, {"i": tid, "t": t["title"], "a": t["subtitle"], "p": preview, "s": []}
            )
            if idx not in entry["s"]:
                entry["s"].append(idx)
            usable += 1
        print(f"{name:18} {usable:4} Songs")
        time.sleep(0.5)

    out = {
        "updated": time.strftime("%Y-%m-%d"),
        "styles": [{"id": s, "name": n, "playlist": p} for s, n, p in STYLES],
        "tracks": list(tracks.values()),
    }
    target = Path(__file__).resolve().parent.parent / "data" / "tracks.js"
    target.parent.mkdir(exist_ok=True)
    target.write_text(
        "// Automatisch erzeugt von tools/update_tracks.py – nicht von Hand bearbeiten.\n"
        "window.TANZ_DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    multi = sum(1 for t in tracks.values() if len(t["s"]) > 1)
    print(f"\n{len(tracks)} Songs gespeichert ({multi} in mehreren Playlists) -> {target}")


if __name__ == "__main__":
    main()
