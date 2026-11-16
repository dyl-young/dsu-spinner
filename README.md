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
- Space spins. Once someone is up, Space again marks them done and spins for the next person.
- "Not here" takes that person off for today and spins again straight away. "Done" doesn't spin.
- Click a name, or "Open board", to filter the board behind the panel to that person. The extension
  clicks their avatar in the board's assignee filter, so on the same board nothing reloads. On a
  different board it loads that board first. If someone has nothing on the board, the panel says so.
  Chris and Casey have a small second link for their other board. Cmd-click opens a new tab.
- The switch next to a squad name (GenAI Productivity, iTools) turns the whole squad off or on for today.
- The switch next to each name marks them away for today. The number next to a name is their
  speaking order. Click it to put them back on the wheel.
- T shows or hides the team list, M mutes, J opens the current person's board, S skips them.
- When everyone has had a turn, a "That's all for today" sign hangs off the pointer.
- Progress resets the next day, or with the reset button.

## Change the team

Edit `team.js`, then press the reload icon on the extension's card in `chrome://extensions`.
Jira account IDs can be found with the assignee filter on either board (the `assignee=` value in the URL).
