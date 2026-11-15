# Night Stadium Super Over

A 3D two-innings cricket game set in a floodlit night stadium, built with **Three.js**, **React**, **TypeScript**, **Tailwind CSS**, **Express**, and the **Gemini API**.

## Features

- **Toss-First Match Flow & 2-Stage Walk-In**: Open with an interactive Heads/Tails coin toss (`1 Over` or `2 Overs` format), followed by a two-stage stadium entrance as the fielding unit takes its positions and both opening batters walk out from the pavilion.
- **Full Two-Innings Target Chase**: Set a 1st-innings total, view the TV-broadcast **Innings Break** scorecard (`Target = Score + 1`), and swap roles (`Batting <-> Bowling`) for a live 2nd-innings chase or defense.
- **3D Rigged Athletes & Full 11-Player Fielding Unit**: Skeletal `Xbot` athletes with team kits, custom back nameplates/jersey numbers, cricket helmet, willow bat, leg pads, wicketkeeper crouch, and 9 active fielders who sprint, dive, catch on the full, or pick up and throw back.
- **Strict Cricket Catching & Bat-Ball Physics**: Tracks `hasBouncedAfterBat` so only clean catches before touching the grass count as **CAUGHT OUT!**, while bounced pickups award runs.
- **Interactive Bowling Aim & AI Batter**: Aim deliveries directly on the pitch using mouse/touch raycasting or `WASD` / Arrow keys, choose delivery types (`Fast Yorker`, `Outswinger`, `Bouncer`, `Slower Cutter`), and time the release bar.
- **3D Hawk-Eye DRS Reviews**: Challenge close LBW or caught-behind decisions with animated 3D ball-tracking projections (`Pitching`, `Impact`, `Wickets`) and UltraEdge feedback.
- **Dynamic Camera, Synthesized Stadium Audio & Fireworks**: Switch between `Batter View`, `Bowler View`, and `Broadcast Side View` (`C`), follow boundaries smoothly across the ground, hear Web Audio API bat cracks, stump rattles, and crowd roars, and trigger 3D victory fireworks.
- **Live AI Commentary & Leaderboard**: Supports `"TV Broadcast English"` and `"Funny Roman Urdu / Desi Street Cricket"` styles with automatic Gemini fallback, plus a `localStorage` Top Scorers Leaderboard.

## Controls

- **Batting**: `Left` / `Up` / `Right` (or `A` / `W` / `D`) to pick shot direction; `Space` to start delivery and swing.
- **Bowling**: Move mouse over the pitch or use `WASD` / Arrow keys to aim the pitch reticle; `Space` to release the ball.
- **Camera**: Press `C` or click the top-right camera button to cycle views.

## Local Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and add your Gemini API key:

   ```bash
   cp .env.example .env
   ```

   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```

3. **Run in development**

   ```bash
   npm run dev
   ```

   The app runs on `http://localhost:3000`.

4. **Build & run for production**

   ```bash
   npm run build
   npm start
   ```
