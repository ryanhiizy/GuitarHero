# Guitar Hero

A browser-based rhythm game inspired by Guitar Hero, implemented with TypeScript and RxJS using functional reactive programming (FRP).
The game manages state, input, animation, and audio playback through Observables.

## Features

- Playable **four-lane rhythm gameplay** with scoring, combos, and multipliers
- **Hold notes** and background notes integrated with audio playback
- **Pause/resume** and **restart** functionality for smooth game flow
- **Star notes** that trigger a temporary high-score phase with faster tempo
- **Variable game speeds** (0.5×, 1.5×) for difficulty adjustment
- Clean **FRP architecture** with Observables driving state and rendering

## Technologies Used

- **Language**: TypeScript
- **Libraries**: RxJS, Tone.js (audio)
- **Architecture**: FRP + MVC state separation
- **Build Tools**: Vite, npm

## Controls

- Green: `A`
- Red: `S`
- Blue: `K`
- Yellow: `L`
- Pause: `P`
- Resume: `O`
- Restart: `R`

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/ryanhiizy/GuitarHero.git
   cd GuitarHero
   ```

2. Install dependencies (requires Node.js):

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

   Open the printed URL in your browser.

## Authors

Developed by [@ryanhiizy](https://github.com/ryanhiizy). \
Scaffold provided by [@adriankristanto](https://github.com/adriankristanto).
