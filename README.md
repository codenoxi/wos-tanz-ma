# Wos tanz ma? – Tanzstil-Quiz

Hör 30 Sekunden eines Songs und errate den Tanzstil. Tänze, die dir schwerfallen,
kommen öfter dran. Falsch beantwortete Songs kommen ein paar Runden später noch einmal.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `style.css`, `app.js` | die Webseite |
| `data/tracks.js` | Songliste (automatisch erzeugt) |
| `tools/update_tracks.py` | liest die Spotify-Playlists neu ein |

## Songs aktualisieren

Playlists und Tanzstile stehen oben in `tools/update_tracks.py`. Nach einer Änderung:

```bash
python3 tools/update_tracks.py
```

## Lokal ansehen

```bash
python3 -m http.server 8123
```

Dann im Browser `http://localhost:8123` öffnen.

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues **öffentliches** Repository anlegen, z. B. `wos-tanz-ma`.
2. Den Inhalt dieses Ordners hochladen (über „Add file → Upload files“ oder per `git push`).
3. Im Repository: **Settings → Pages → Branch: `main`, Ordner `/ (root)` → Save**.
4. Nach ca. 1 Minute ist die Seite unter `https://<benutzername>.github.io/wos-tanz-ma/` erreichbar.

## Später

- Login und Fortschritt pro Benutzer: Supabase (Gratis-Tarif). Bis dahin speichert
  jeder Browser seinen Fortschritt selbst (localStorage).
