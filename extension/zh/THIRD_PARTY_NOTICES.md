# Third-party notices

## Stockfish / Stockfish.js

ChessMate is designed to use the **Stockfish 18 lite single-threaded WebAssembly build** from `nmrugg/stockfish.js` when the two vendor files are present in `vendor/`:

- `stockfish-18-lite-single.js`
- `stockfish-18-lite-single.wasm`

Stockfish.js 18 is distributed under the **GNU General Public License v3 (GPL-3.0)** and is based on Stockfish, whose contributors include T. Romstad, M. Costalba, J. Kiiski, G. Linscott, and many others. The Stockfish.js loader identifies Chess.com, LLC as a 2026 copyright holder for that port. A copy of GPL-3.0 is included at `licenses/Stockfish-GPL-3.0.txt`.

Upstream source: `https://github.com/nmrugg/stockfish.js` and `https://github.com/official-stockfish/Stockfish`.

The provided `scripts/fetch-stockfish.mjs` fetches the published `stockfish` npm package assets at version 18.0.8 from UNPKG for local vendoring. Production extension code never fetches Stockfish remotely.

## chess.js

The product requirement allowed **chess.js or an equivalent local rules library**. This MVP uses an original local rules module at `src/core/chess-rules.js` instead of redistributing chess.js. The notice is included because chess.js was evaluated as the reference rules-library option.

chess.js 1.4.0 is licensed under the **BSD-2-Clause** license. Copyright (c) 2025, Jeff Hlywa. Upstream source and license: `https://github.com/jhlywa/chess.js`.

No chess.js source code is included in this build.
