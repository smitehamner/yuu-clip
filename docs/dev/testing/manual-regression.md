# Manual Regression Checklist

Run this before any release or after a significant change. Each item should pass or fail - no partial credit.

**Prerequisites:** Server running at `http://127.0.0.1:8080`. At least one already-analyzed recording in the project directory. Ollama running locally.

---

## Startup

| # | Step | Expected |
|---|------|----------|
| 1 | Open `http://127.0.0.1:8080` | Page loads; no console errors |
| 2 | Check footer bar | Version string visible bottom-left |
| 3 | Click `≡` hamburger | Dropdown shows: Getting Started, Controls, World Contexts, Terminology Glossary, Settings, Download Log, About (plus Re-run Setup Wizard in the packaged desktop app) |

---

## Analyze

| # | Step | Expected |
|---|------|----------|
| 4 | Click `+ Analyze` | New Recording panel opens in main area (sidebar stays live); file picker button visible |
| 5 | Select a video file | Inspection results appear: duration, track list, time estimate |
| 6 | Change the Whisper model | Estimate updates |
| 7 | Change the track layout | Estimate updates; track selection reflects new layout |
| 8 | Click Start Analysis | Modal closes; header shows step progress chips (Extract → Transcribe → Generate Clips → Energy → Scenes → Score) |
| 9 | Wait for completion | Video appears in sidebar; step chips clear |
| 10 | Click `+ Analyze` while analysis is running | Progress is still shown; second analysis is blocked |

---

## Video list

| # | Step | Expected |
|---|------|----------|
| 11 | Click a video in the sidebar | Clip list loads below; video detail panel opens on the right |
| 12 | Check video metadata | Duration, clip count, approved count visible |
| 13 | Click the video title inline | Becomes editable; type a new name; click away | Title saves and updates |

---

## Clip list and sorting

| # | Step | Expected |
|---|------|----------|
| 14 | Clip list shows clips | Score icons (⭐ 😂 🎭 ⚔️) and status dots visible per card |
| 15 | Change sort to `😂 Funny ↓` | List reorders; colored left border tracks the selection |
| 16 | Switch to a different video and back | Sort preference is remembered (localStorage) |

---

## Filter tabs

| # | Step | Expected |
|---|------|----------|
| 17 | Click `Approved` tab | Only approved clips shown |
| 18 | Click `Rejected` tab | Only rejected clips shown |
| 19 | Click `Unreviewed` tab | Only unreviewed clips shown |
| 20 | Switch to a different video | Filter resets to `All` |

---

## Clip detail

| # | Step | Expected |
|---|------|----------|
| 21 | Click a clip | Detail panel shows: one-liner, long description, score bars, tags, transcript |
| 22 | Check score bars | Funny, Dramatic, Action bars visible with values |
| 23 | Click the one-liner description | Becomes an editable field |
| 24 | Edit the text and click away | Saved value persists after scrolling away and back |
| 25 | Check tags | Tag pills visible; `llm_scored` or similar present on scored clips |

---

## Keyboard navigation and review

| # | Step | Expected |
|---|------|----------|
| 26 | Press `→` | Next clip selected and detail panel updates |
| 27 | Press `←` | Previous clip selected |
| 28 | Press `A` | Current clip approved; status dot turns green |
| 29 | Press `R` | Current clip rejected; status dot turns red |
| 30 | Press `Ctrl+Z` within 5 s of rejecting | Status reverts; toast message appears |
| 31 | Wait 6 s after rejecting then press `Ctrl+Z` | No undo; status stays rejected |
| 32 | Press `?` | Controls modal opens showing keyboard shortcut list |

---

## Export

| # | Step | Expected |
|---|------|----------|
| 33 | Press `E` on an approved clip | SSE progress stream appears in header |
| 34 | Wait for export to finish | Video player appears in clip detail panel |
| 35 | Press Space | Video plays/pauses |

---

## Re-score and retranscribe

| # | Step | Expected |
|---|------|----------|
| 36 | Click "Re-score" in clip detail | SSE fires; scores update when stream ends |
| 37 | Click "Retranscribe" in clip detail | Model picker appears; select a model; SSE fires; transcript updates |

---

## Video summary

| # | Step | Expected |
|---|------|----------|
| 38 | Open a video that has not been summarized | "Generate Summary" button visible |
| 39 | Click "Generate Summary" | SSE fires; summary text appears when done |
| 40 | Click the summary text | Becomes editable inline |
| 41 | Edit and click away | Saved; reloading the page preserves the edit |

---

## Session timeline

| # | Step | Expected |
|---|------|----------|
| 42 | Click "Generate Timeline" in video detail | Timeline appears as a visual bar with clip markers |
| 43 | Click a marker on the timeline | Corresponding clip is selected in the clip list |

---

## Highlight reel

| # | Step | Expected |
|---|------|----------|
| 44 | Click `Highlight Reel` in the header | Modal opens; transition picker and duration controls visible |
| 45 | Configure and click compile | SSE progress in header; reel file path shown on completion |

---

## Track layout manager

| # | Step | Expected |
|---|------|----------|
| 46 | Open via the analyze modal | Track layout list shows existing layouts |
| 47 | Create a new track layout | Appears in list; selectable in analyze modal |
| 48 | Edit a track layout name | Saves |
| 49 | Delete a track layout | Confirmation modal appears; layout removed after confirm |

---

## World context manager

| # | Step | Expected |
|---|------|----------|
| 50 | Open `≡` → World Contexts | Context list shows; create a new context with a name and body |
| 51 | Assign context to a video | Context name appears on video detail |
| 52 | Delete a context | Confirmation modal appears; removed after confirm |

---

## Confirmation dialogs

| # | Step | Expected |
|---|------|----------|
| 53 | Attempt to delete a video | App modal appears (not browser `confirm()`) |
| 54 | Attempt to delete a clip | App modal appears |
| 55 | Click Cancel analysis while analysis is running | App modal appears; cancelling stops the stream |

---

## Log download

| # | Step | Expected |
|---|------|----------|
| 56 | Open `≡` → Download Log | File download starts immediately; file is non-empty |

---

## Status API

| # | Step | Expected |
|---|------|----------|
| 57 | `GET /api/status` while idle | `{"any_running": false, "analyze_running": false, "active_jobs": 0}` |
| 58 | `GET /api/status` during an SSE job | `any_running` is `true`; `active_jobs` ≥ 1 |
