// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development, restrict in production
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve your static client files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client'))); // Adjust path if client is in a different folder

// Game state for all active games
const games = {}; // Stores gameId -> game_state_object

// Utility functions (copied from your script.js, adapted for server-side)
function calculatePlayerTurn(currentBoard) {
    let xCount = 0;
    let oCount = 0;
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (currentBoard[i][j] === 'X') {
                xCount++;
            } else if (currentBoard[i][j] === 'O') {
                oCount++;
            }
        }
    }
    return xCount > oCount ? 'O' : 'X';
}

function checkInnerWin(currentBoard, outerIndex) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        const cells = [currentBoard[outerIndex][a], currentBoard[outerIndex][b], currentBoard[outerIndex][c]];
        if (cells[0] && cells[0] === cells[1] && cells[0] === cells[2]) {
            currentBoard[outerIndex][9] = cells[0];
            return cells[0];
        }
    }
    const isInnerBoardFull = currentBoard[outerIndex].slice(0, 9).every(cell => cell !== '');
    if (isInnerBoardFull && currentBoard[outerIndex][9] === '') {
        currentBoard[outerIndex][9] = 'D';
        return 'D';
    }
    return null;
}

function checkOuterWin(currentBoard) {
    const winningCombinations = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        const outerCells = [currentBoard[a][9], currentBoard[b][9], currentBoard[c][9]];
        if (outerCells[0] && outerCells[0] !== 'D' && outerCells[0] === outerCells[1] && outerCells[0] === outerCells[2]) {
            return outerCells[0];
        }
    }
    const isOuterBoardFull = currentBoard.every(outerSquare => outerSquare[9] !== '');
    if (isOuterBoardFull) {
        return 'D';
    }
    return null;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Generate a unique ID for the user (can be more robust in production)
    socket.userId = socket.id.substring(0, 8); // Simple user ID for demonstration

    socket.emit('yourId', socket.userId);

    // Handle game creation
    socket.on('createGame', () => {
        const gameId = Math.random().toString(36).substring(2, 9).toUpperCase();
        const initialBoard = Array(9).fill(null).map(() => Array(10).fill('')); // Use null instead of '' for empty

        games[gameId] = {
            id: gameId,
            players: [{ id: socket.userId, symbol: 'X', socketId: socket.id }],
            boardState: initialBoard,
            currentPlayer: 'X',
            nextAllowedOuterCell: null,
            status: 'waiting', // waiting, playing, finished
            winner: null,
            XWins: 0,
            OWins: 0,
            createdAt: new Date().toISOString(),
        };

        socket.join(gameId);
        socket.gameId = gameId; // Store gameId on socket
        socket.symbol = 'X'; // Store symbol on socket
        socket.emit('gameCreated', games[gameId]);
        console.log(`Game created by ${socket.userId}: ${gameId}`);
    });

    // Handle joining a game
    socket.on('joinGame', (gameId) => {
        const game = games[gameId];

        if (!game) {
            socket.emit('gameError', 'Game not found.');
            return;
        }

        if (game.players.length === 2 && !game.players.find(p => p.id === socket.userId)) {
            socket.emit('gameError', 'Game is already full.');
            return;
        }

        const existingPlayer = game.players.find(p => p.id === socket.userId);

        if (existingPlayer) {
            // Rejoining as existing player
            existingPlayer.socketId = socket.id; // Update socketId in case it changed
            socket.join(gameId);
            socket.gameId = gameId;
            socket.symbol = existingPlayer.symbol;
            socket.emit('gameJoined', { game: game, symbol: existingPlayer.symbol });
            io.to(gameId).emit('gameUpdate', game); // Broadcast current state
            console.log(`User ${socket.userId} rejoined game ${gameId} as ${existingPlayer.symbol}`);
        } else if (game.players.length === 1) {
            // Joining as second player
            const newPlayerSymbol = game.players[0].symbol === 'X' ? 'O' : 'X';
            game.players.push({ id: socket.userId, symbol: newPlayerSymbol, socketId: socket.id });
            game.status = 'playing'; // Game starts now

            socket.join(gameId);
            socket.gameId = gameId;
            socket.symbol = newPlayerSymbol;
            socket.emit('gameJoined', { game: game, symbol: newPlayerSymbol });
            io.to(gameId).emit('gameUpdate', game); // Broadcast initial state to both players
            console.log(`User ${socket.userId} joined game ${gameId} as ${newPlayerSymbol}`);
        } else {
            socket.emit('gameError', 'Game is full or invalid.');
        }
    });

    // Handle player moves
    socket.on('makeMove', ({ outerIndex, innerIndex }) => {
        const gameId = socket.gameId;
        const game = games[gameId];

        if (!game) {
            socket.emit('gameError', 'Invalid game session.');
            return;
        }

        if (game.status !== 'playing') {
            socket.emit('gameError', 'Game is not active.');
            return;
        }

        if (game.currentPlayer !== socket.symbol) {
            socket.emit('gameError', `It's ${game.currentPlayer}'s turn.`);
            return;
        }

        // Validate move based on nextAllowedOuterCell
        if (game.nextAllowedOuterCell !== null && game.nextAllowedOuterCell !== outerIndex && game.boardState[game.nextAllowedOuterCell][9] === '') {
            socket.emit('gameError', `You must play in the highlighted big square (${game.nextAllowedOuterCell}).`);
            return;
        }

        // Validate if cell is empty
        if (game.boardState[outerIndex][innerIndex] !== '') {
            socket.emit('gameError', 'This cell is already taken!');
            return;
        }

        // Apply move
        game.boardState[outerIndex][innerIndex] = socket.symbol;

        // Check for inner board win
        checkInnerWin(game.boardState, outerIndex);

        // Determine next allowed outer cell
        let newNextAllowedOuterCell = innerIndex;
        if (game.boardState[newNextAllowedOuterCell][9] !== '') {
            // If the next target board is already won/drawn, any board is allowed
            newNextAllowedOuterCell = null;
        }

        game.nextAllowedOuterCell = newNextAllowedOuterCell;

        // Check for overall game win/draw
        const overallWinner = checkOuterWin(game.boardState);

        if (overallWinner) {
            game.status = 'finished';
            game.winner = overallWinner;
            if (overallWinner === 'X') game.XWins++;
            else if (overallWinner === 'O') game.OWins++;
        } else {
            game.currentPlayer = calculatePlayerTurn(game.boardState); // Switch turn
        }

        io.to(gameId).emit('gameUpdate', game); // Broadcast updated game state to all players in the room
        console.log(`Move made in game ${gameId} by ${socket.symbol}: outer=${outerIndex}, inner=${innerIndex}`);
    });

    // Handle game reset
    socket.on('resetGame', () => {
        const gameId = socket.gameId;
        const game = games[gameId];

        if (!game) {
            socket.emit('gameError', 'Invalid game session for reset.');
            return;
        }

        game.boardState = Array(9).fill(null).map(() => Array(10).fill(''));
        game.currentPlayer = 'X';
        game.nextAllowedOuterCell = null;
        game.status = game.players.length === 2 ? 'playing' : 'waiting';
        game.winner = null;

        io.to(gameId).emit('gameUpdate', game);
        console.log(`Game ${gameId} reset.`);
    });

    // Handle leaving game
    socket.on('leaveGame', () => {
        const gameId = socket.gameId;
        if (gameId && games[gameId]) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.userId);

            if (game.players.length === 0) {
                // If no players left, delete the game
                delete games[gameId];
                console.log(`Game ${gameId} deleted as last player left.`);
            } else {
                // Inform the other player that someone left
                game.status = 'waiting'; // Game goes back to waiting
                game.winner = null; // Clear winner if left mid-game
                io.to(gameId).emit('gameUpdate', game);
                console.log(`User ${socket.userId} left game ${gameId}. Game status set to waiting.`);
            }
            socket.leave(gameId);
            delete socket.gameId;
            delete socket.symbol;
            socket.emit('gameLeft');
            console.log(`User ${socket.userId} left game ${gameId}.`);
        } else {
            socket.emit('gameError', 'Not currently in a game.');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Consider how to handle disconnections gracefully.
        // For example, if a player disconnects, the game could pause
        // or the other player wins. For this example, we'll simply remove
        // them from the game's player list.
        const gameId = socket.gameId;
        if (gameId && games[gameId]) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.socketId !== socket.id); // Filter by socketId

            if (game.players.length === 0) {
                delete games[gameId];
                console.log(`Game ${gameId} deleted due to last player disconnect.`);
            } else {
                game.status = 'waiting'; // Game goes back to waiting
                game.winner = null;
                io.to(gameId).emit('gameUpdate', game);
                console.log(`Player ${socket.symbol} (${socket.userId}) disconnected from game ${gameId}. Game status set to waiting.`);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});