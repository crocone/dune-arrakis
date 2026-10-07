# Music prompts for Suno

The game plays audio files from `public/music/`; the file name prefix decides when a track is used
(see the Music section of the README). Below are prompts for each slot. All tracks are **instrumental**:
switch on *Instrumental* in Suno (or paste the structure tags into the Lyrics field, which only steers the arrangement).

Common musical identity for every track, so the score sounds like one soundtrack:

- Key centre D, Phrygian dominant / Hijaz flavour (D–Eb–F#–G–A–Bb–C).
- Desert colour: duduk or ney flute lead, frame drums, low male drone/choir.
- A nod to early-90s PC strategy music: a pulsing analog / FM-style synth arpeggio under the orchestra.
- No vocals with words, no artist names (Suno rejects them), no trademarked titles.

Export as MP3 (or keep Suno's MP3) and save with the file names listed below.

---

## 1. Main background track: `ambient1.mp3` (the most important one)

Plays during missions whenever nothing is attacking you, so it is heard the most. It must sit under voice
announcements and gunfire without getting tiring.

**Title:** Spice Fields

**Style of music:**
```
Instrumental dark ambient desert sci-fi score, 85 BPM, D phrygian dominant, slow evolving analog synth pads, pulsing retro FM synth arpeggio, deep sub bass drone, soft frame drums and distant taiko, breathy ney flute and duduk phrases, low male throat-singing drone, wind textures, hypnotic, spacious, mysterious, steady energy, loopable, no vocals, cinematic strategy game soundtrack
```

**Exclude styles:** `vocals, lyrics, pop, EDM drop, happy, major key, guitar solo`

**Lyrics field (structure only):**
```
[Intro: wind and low drone]
[Verse: synth arpeggio enters, frame drums]
[Interlude: duduk melody]
[Verse: arpeggio and pads, steady pulse]
[Bridge: sparse, ney flute over drone]
[Outro: fades back into wind]
```

Generate 2–3 versions and keep the best two as `ambient1.mp3` and `ambient2.mp3`; the game alternates them.

---

## 2. Main menu theme: `menu.mp3`

Main menu, briefings, the planet map and story screens. Mentat voice-over plays on top (the music is ducked
automatically), so a clear melody with room for speech works best.

**Title:** Arrakis

**Style of music:**
```
Instrumental epic cinematic main theme, 75 BPM, D phrygian dominant, slow majestic build, solemn low male choir pads, duduk lead melody, warm string ensemble, deep taiko hits, shimmering analog synth arpeggio underneath, desert planet atmosphere, noble and ominous, wide stereo, film trailer quality, no vocals with words
```

**Exclude styles:** `pop, rock band, EDM, happy, lyrics`

**Lyrics field:**
```
[Intro: wind, distant drums]
[Theme: duduk melody over strings]
[Build: choir and taiko swell]
[Climax: full orchestra, main theme]
[Outro: quiet drone and wind]
```

---

## 3. Battle track: `battle1.mp3`

Switches in after an attack alert ("Our base is under attack!") and stays about 30 seconds after the last one.

**Title:** Sands of War

**Style of music:**
```
Instrumental aggressive cinematic war drums, 120 BPM, D phrygian dominant, driving taiko and frame drum ostinato, distorted analog bass, fast pulsing synth arpeggio, staccato low strings, brass stabs, middle eastern percussion, tension and urgency, relentless, dark industrial edge, strategy game battle music, no vocals
```

**Exclude styles:** `vocals, lyrics, dubstep, happy, major key, metal screaming`

**Lyrics field:**
```
[Intro: war drums]
[Main: arpeggio, bass and drums drive]
[Break: low strings tension]
[Main: brass stabs, full drums]
[Outro: drums cut out sharply]
```

A second version as `battle2.mp3` adds variety.

---

## 4. Victory: `victory.mp3` (optional)

Plays once at the end of a won mission and over the results screen. Trim it to 30–60 seconds.

**Style of music:**
```
Instrumental triumphant cinematic fanfare, 90 BPM, D major with phrygian colour, brass and choir, big taiko hits, rising strings, desert sci-fi, victorious and proud, short, no vocals
```

## 5. Defeat: `defeat.mp3` (optional)

Plays once at the end of a lost mission. Trim it to 30–60 seconds.

**Style of music:**
```
Instrumental somber cinematic lament, 60 BPM, D phrygian, solo duduk over low string drone, distant wind, slow heavy drum hits, melancholic and defeated, short, no vocals
```

---

### Per-House variants (optional)

If you want more flavour, generate extra ambient/battle versions with one line added to the style prompt:

- Atreides: `noble, hopeful, french horns and warm strings`
- Harkonnen: `brutal industrial percussion, metallic hits, distorted low brass`
- Ordos: `cold glassy synths, ticking clockwork percussion, secretive`

Name them `ambient3.mp3`, `battle3.mp3` and so on; every file with the right prefix joins the rotation.
