# Local Multiplayer UNO

A fully local, self-hosted multiplayer UNO game built as a monorepo. It features real-time multiplayer using WebSockets, an authentication system with a persistent SQLite database, a robust lobby system, and 4 specialized bot difficulties.

## Features
- **Real-time Multiplayer:** Event-sourced game engine built on Node.js, Express, and Socket.IO.
- **Polished UI:** React, Tailwind CSS, and Framer Motion for smooth card animations.
- **Local Persistence:** SQLite via `better-sqlite3` means no external DB server is required.
- **Bot Difficulties:** Play against Easy, Medium, Hard, and Cheater bots.
- **House Rules:** Toggleable stacking rules for +2 and +4 cards.

## Setup Instructions

1. **Install Dependencies:**
   From the root folder, run:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

2. **Start the Application:**
   From the root folder, simply run:
   ```bash
   npm run dev
   ```
   This uses `concurrently` to start both the Vite development server (frontend) and the Node.js backend simultaneously.

3. **Access the Game:**
   Open your browser and navigate to:
   [http://localhost:5173](http://localhost:5173)

   The server API runs on [http://localhost:3001](http://localhost:3001).
   The SQLite database (`database.sqlite`) will be created automatically in the `server` directory upon first login or registration.

## How to Play
1. Register a new account on the login page.
2. Go to the Lobby Browser and create a new game room (you can also set a password and max player count).
3. In the Waiting Room, you can add bots or wait for friends on your local network to join via the Lobby Browser.
4. Click "Start Game" and enjoy UNO!
