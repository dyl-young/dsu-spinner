# DSU Spinner

A Chrome extension that picks who speaks next at the Productivity Engineering stand-up.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `dsu-spinner` folder.
3. Pin the extension (puzzle-piece icon → pin) so the wheel icon sits in the toolbar.

To share it, zip this folder and have people do the same steps.

## Use

- Click the toolbar icon, or press Alt+Shift+S, to show or hide the spinner over the current page.
- The minimise button shrinks it to just the header bar. Click it again to bring the wheel back.
- Drag the header to move it anywhere. Double-click the header to dock it back on the right.
  The expand button makes it large for screensharing.
- On pages where extensions can't run (new tab, `chrome://`), it opens in its own tab instead.
- You can also grab the wheel. Flick it and it spins at that speed, slowing down on its own.
  Drag it slowly and let go to pick whoever is under the pointer.
- Space spins. When the wheel stops, the popup shows who's up:
  - "Start" (or Enter) closes the popup and they start talking. "Done" under the wheel, Enter, or
    Space marks them done. Space also spins for the next person.
  - "Skip" (or S) takes them off for today and spins again straight away.
- The switch next to a squad name (GenAI Productivity, iTools) turns the whole squad off or on for today.
- The switch next to each name marks them away for today. The number next to a name is their
  speaking order. Click it to put them back on the wheel.
- T shows or hides the team list, M mutes.
- When everyone has had a turn, a "That's all for today" sign hangs off the pointer.
- Progress resets the next day, or with the reset button.

## Change the team

Click the settings button in the header (the sliders icon). Type a name under a squad and press Enter
to add them, or click the × next to someone to remove them. Changes are saved in the extension
and show up in every open spinner.

Squads are managed there too. Click a squad's name to rename it, use "Add a team" at the bottom for
a new one, or the bin icon to remove one. Removing a squad removes its people as well, so it asks first.

`team.js` holds the starting team and squads, used until the first change in settings.
