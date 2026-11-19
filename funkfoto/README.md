# Funkfoto – Fotos per Ton & Vibration

Eine Webseite, die ein Foto **ohne Internet zwischen den Geräten** von einem Handy zum anderen überträgt:

| Weg | Wie | Tempo | Bild |
|---|---|---|---|
| **Ton** | Lautsprecher des Senders → Mikrofon des Empfängers. 64 Töne zwischen 1,5 und 4,7 kHz, 16 gleichzeitig (MFSK), Reed-Solomon-Fehlerkorrektur | ca. 45 Byte/s → Foto in 20–60 s | Farbfoto, 64–128 px (WebP/JPEG) |
| **Vibration** | Vibrationsmotor des Senders an/aus (wie Morsen) → das Summen wird vom Mikrofon (oder experimentell vom Bewegungssensor) des Empfängers gemessen | ca. 1 Byte/s | Schwarz-Weiß, 16–32 px |

Der Sender wiederholt alle Pakete in Schleife. Verpasste oder gestörte Pakete kommen in der nächsten Runde. Bei
Vibration werden gestörte Wiederholungen desselben Pakets zusätzlich kombiniert („soft combining“).

## Benutzung
1. Seite auf **beiden** Handys öffnen (muss über **https** laufen, sonst gibt der Browser kein Mikrofon frei).
2. Oben **Ton** oder **Vibration** wählen.
3. Handy A: **Foto senden** → Foto aufnehmen → *Senden starten*.
4. Handy B: **Foto empfangen** → *Empfang starten* → Mikrofon erlauben.
   - Ton: Handys 10–50 cm auseinander, Sender laut. iPhone: Lautlos-Schalter aus.
   - Vibration: Sender-Handy direkt **auf** das Empfänger-Handy legen, ruhig liegen lassen.
5. Das Foto erscheint, sobald alle Pakete da sind → *Foto speichern*.

### Was geht auf welchem Handy
| | Ton senden | Ton empfangen | Vibration senden | Vibration empfangen |
|---|---|---|---|---|
| Android (Chrome) | ✓ | ✓ | ✓ | ✓ |
| iPhone (Safari) | ✓ | ✓ | ✗ – Apple erlaubt Webseiten keine Vibration | ✓ |

## Hosting (kostenlos)
- **GitHub Pages:** Repo → *Settings → Pages → Source: GitHub Actions*. Der Workflow
  `.github/workflows/funkfoto-pages.yml` veröffentlicht diesen Ordner, die Adresse ist dann
  `https://<user>.github.io/<repo>/`.
- Alternativ: den Ordner `funkfoto/` bei https://app.netlify.com/drop hineinziehen.
- Lokal testen: `npx serve funkfoto` (localhost zählt als sicher; für Handys im WLAN braucht es https).

Keine Abhängigkeiten, kein Build-Schritt: reines HTML + JavaScript-Module.

## Tests
```bash
cd funkfoto
npm test                          # Reed-Solomon, Ton-Modem (Echos, Rauschen, 44,1↔48 kHz, Aussetzer), Vibrations-Modem (Motor-Trägheit, 60-Hz-Sensor, Timer-Jitter)
python3 -m http.server 8765 &     # dann:
node test/e2e-browser.mjs sound   # echter Browser: Foto → Ton → "Mikrofon" eines zweiten Browsers → Foto byte-genau verglichen
node test/e2e-browser.mjs vibe    # dasselbe für Vibration (simuliertes Motorsummen)
```
Die Tests laufen mit simulierten Kanälen. Wie gut es mit zwei echten Handys klappt, hängt von Lautsprecher,
Mikrofon, Vibrationsmotor und Umgebung ab – bitte selbst ausprobieren.
