# ChessMate Bot Coach

**A private, local chess coach for confirmed Chess.com Bot/Computer games.**

[简体中文](README.zh-CN.md) · Version 0.5.2

> ChessMate intentionally enables itself only on supported Chess.com Bot/Computer pages. It is not designed for games against people.

## Download

- [English package (v0.5.2)](releases/ChessMate-Bot-Coach-EN-v0.5.2-installable.zip)
- [中文安装包（v0.5.2）](releases/ChessMate-Bot-Coach-ZH-v0.5.2-installable.zip)

## Install in Chrome

1. Download the ZIP for your language and unzip it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the unzipped extension folder—the folder containing `manifest.json`.
6. Open [Chess.com Computer](https://www.chess.com/play/computer) and start a Bot game.

![Load the unpacked extension](docs/images/01-install-extension.png)

If Chrome reports an error, make sure you selected the folder containing `manifest.json`, not the ZIP itself or its parent folder.

## Features

### Opening recognition and live outcome estimate

Recognizes common opening families from a bundled local book, explains the position, and continuously converts the local evaluation into approximate win/draw/loss chances.

![Opening recognition and live outcome estimate](docs/images/02-opening-and-live-outcome.png)

### Three candidate plans with board arrows

Shows up to three candidate moves, numbered consistently in the coach panel and on the board, with a short explanation for each plan.

![Candidate plans and arrows](docs/images/03-candidates-and-arrows.png)

### Move-safety visualization

Colors destination squares to show their immediate attack-and-defense relationship after the move: green is not attacked, yellow is attacked but defended, and red is attacked and undefended.

![Move-safety visualization](docs/images/04-move-safety.png)

### Loose-piece and tactical-target detection

Finds opponent pieces that are currently undefended, distinguishes a safe capture from a capture that still needs calculation, and marks useful targets in the panel and on the board.

![Loose-piece targets](docs/images/05-loose-targets.png)

### Bot tendency profile and adjustable controls

Uses recent Bot moves to estimate whether the opponent is leaning toward attack, defense/counterplay, or a balanced plan. You can select playing color and analysis strength and toggle threat arrows, move safety, and loose targets.

![Bot tendency profile and controls](docs/images/06-opponent-tendency-and-controls.png)

## Privacy and fair-play design

- Analysis runs locally in the browser extension.
- No account credentials, moves, or personal data are sent to an external ChessMate server.
- A page guard restricts coaching to confirmed Bot/Computer routes and signals.
- The extension pauses or disables analysis when it cannot safely confirm an allowed game.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Repository layout

- `extension/en/` — unpacked English extension
- `extension/zh/` — unpacked Simplified Chinese extension
- `releases/` — installable ZIP packages
- `docs/images/` — real screenshots used in this README

## License

The project code is provided under the [MIT License](LICENSE). Stockfish, when supplied separately, is covered by GPLv3; see the notices included with each package. The bundled v0.5.2 package falls back to its lightweight local evaluator when Stockfish WASM files are not installed.

