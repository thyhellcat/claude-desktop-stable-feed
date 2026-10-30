# stable-feed: stop screen reader jumps in Claude Desktop

A small script that keeps the whole conversation loaded in Claude Desktop, so your screen reader stops jumping around.

Latest version: [releases/latest](https://github.com/thyhellcat/claude-desktop-stable-feed/releases/latest)

## The problem this fixes

Claude Desktop only keeps the messages near the visible part of the window in the page. The rest is removed and added back as you scroll. Sighted users never notice. With a screen reader, the message you are reading disappears under your cursor: reading jumps to the top of the conversation or into an old reply, constantly, and even more while a reply is being generated.

The script makes the app keep every message in the page. Nothing changes visually, and buttons, expandable blocks and tasks keep working. Press **Ctrl+L** at any time to put focus on the last message, so you can start reading at the latest reply.

Full technical details and the fix proposed to Anthropic: https://github.com/anthropics/claude-code/issues/99332

## Disclaimer

- This is not an official Anthropic tool. It relies on how the app works internally, so an app update can break it at any time. If that happens, check the latest release: hopefully I will have found a fix by then. Or suggest one!
- It works for me, every day, on Windows 11 with JAWS and NVDA. At the time of writing, I am the only one who has tested it. It should also work on macOS, but I have no Mac to check that. Feedback is welcome.
- No warranty of any kind. Use it at your own risk.
- You will paste code into the app's developer tools. Code pasted there can do anything the app can do. This script only changes how the conversation list measures itself, and you can read it, but as a rule, never paste code you do not trust.
- I use it on a fairly powerful machine. It might be laggy on a slower one: please let me know if it is.

## Setup (once)

1. Download `stable-feed.js` from the [latest release](https://github.com/thyhellcat/claude-desktop-stable-feed/releases/latest).
2. Allow the developer tools in Claude. Open this folder: the fastest way is to press **Win+R**, paste the path below and press **Enter**.

   ```
   %APPDATA%\Claude
   ```

   Create a file named `developer_settings.json` there (or open it if it exists), with exactly this content:

   ```json
   {"allowDevTools": true}
   ```

3. Quit Claude completely and start it again.

## Run it (each time you start Claude)

The script does not survive a restart of the app. Run it again each time you open Claude.

1. In the Claude window, press **Ctrl+Alt+I**. DevTools opens.
2. Go to the console: press **Ctrl+Shift+P**, type `Show Console`, press **Enter**.
3. Open `stable-feed.js` in a text editor (Notepad works), select all, copy, then paste in the console and press **Enter**.
   The first time, the console may refuse to paste and ask you to type `allow pasting`. Type it, press **Enter**, then paste again.
4. The console prints a line starting with `[stable-feed] v6`. That's it: you can close DevTools.

Updating from an older version: just paste the new script. It replaces the running one, no need to stop it first.

### Faster: save it as a snippet (optional)

Instead of pasting each time, you can store the script in DevTools once:

1. In DevTools, press **Ctrl+Shift+P**, type `Create new snippet`, press **Enter**.
2. Paste the script in the editor that opens, then press **Ctrl+S**. The snippet gets a name like `Script snippet #1`. Rename it if you want.

From then on, each time you start Claude: **Ctrl+Alt+I**, then **Ctrl+P**, type `!` followed by the start of the snippet name (for example `!Script`), and press **Enter**.

You can also select the snippet in the Snippets list, open its context menu and choose **Run**.

## Useful commands

Type these in the console:

- `__stableFeed.status()`: shows, for each conversation, whether every message is loaded (`complete`) and how many there are (for example `"messages":"8/8"`).
- `__stableFeed.focusKey = null`: turns the Ctrl+L shortcut off. To use another key, for example Alt+Shift+L: `__stableFeed.focusKey = { code: 'KeyL', alt: true, shift: true, ctrl: false }`.
- `__stableFeed.stop()`: turns the script off until the next time you run it.

## Changes

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).
