# Nested Tic-Tac-Toe

A multiplayer web-based strategic game—also known as Ultimate Tic-Tac-Toe—where two players battle across a 3x3 meta-grid composed of nine individual mini tic-tac-toe boards.

## Features
- Full implementation of Ultimate/Nested Tic-Tac-Toe rules where local moves dictate the active outer board for the opponent
- Real-time online multiplayer matchmaking with game room codes using WebSockets
- Turn tracking, win/draw condition evaluations for both local sub-boards and the overall macro-board
- Interactive game lobby with options to create custom rooms or join existing sessions
- Real-time scoreboards tracking win counts for Player X and Player O

## Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Socket.IO Client (CDN)

## How to Run
1. Navigate to the server folder:
   ```bash
   cd "Nested_Tic_Tac_Toe/server"
   ```
2. Install the required Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the game server:
   ```bash
   node server.js
   ```
4. Open your web browser and navigate to `http://localhost:3000`.
5. To play multiplayer, open another browser tab or share the URL and room code with another player on the same network.

## Status
Complete
