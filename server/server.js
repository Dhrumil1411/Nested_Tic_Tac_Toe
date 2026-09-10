const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'client'))); 

const games = {};

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

    socket.userId = socket.id.substring(0, 8); 

    socket.emit('yourId', socket.userId);

    socket.on('createGame', () => {
        const gameId = Math.random().toString(36).substring(2, 9).toUpperCase();
        const initialBoard = Array(9).fill(null).map(() => Array(10).fill('')); 

        games[gameId] = {
            id: gameId,
            players: [{ id: socket.userId, symbol: 'X', socketId: socket.id }],
            boardState: initialBoard,
            currentPlayer: 'X',
            nextAllowedOuterCell: null,
            status: 'waiting', 
            winner: null,
            XWins: 0,
            OWins: 0,
            createdAt: new Date().toISOString(),
        };

        socket.join(gameId);
        socket.gameId = gameId; 
        socket.symbol = 'X'; 
        socket.emit('gameCreated', games[gameId]);
        console.log(`Game created by ${socket.userId}: ${gameId}`);
    });

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

            existingPlayer.socketId = socket.id; 
            socket.join(gameId);
            socket.gameId = gameId;
            socket.symbol = existingPlayer.symbol;
            socket.emit('gameJoined', { game: game, symbol: existingPlayer.symbol });
            io.to(gameId).emit('gameUpdate', game); 
            console.log(`User ${socket.userId} rejoined game ${gameId} as ${existingPlayer.symbol}`);
        } else if (game.players.length === 1) {

            const newPlayerSymbol = game.players[0].symbol === 'X' ? 'O' : 'X';
            game.players.push({ id: socket.userId, symbol: newPlayerSymbol, socketId: socket.id });
            game.status = 'playing'; 

            socket.join(gameId);
            socket.gameId = gameId;
            socket.symbol = newPlayerSymbol;
            socket.emit('gameJoined', { game: game, symbol: newPlayerSymbol });
            io.to(gameId).emit('gameUpdate', game); 
            console.log(`User ${socket.userId} joined game ${gameId} as ${newPlayerSymbol}`);
        } else {
            socket.emit('gameError', 'Game is full or invalid.');
        }
    });

    socket.on('fW', ({ gameId, winner }) => {
        const game = games[gameId];

        if (!game) {
            socket.emit('gameError', 'Game not found for  fW.');
            return;
        }

        const isPlayerInGame = game.players.some(p => p.id === socket.userId);
        if (!isPlayerInGame) {
            socket.emit('gameError', 'You are not a player in this game to fW');
            return;
        }

        if (winner !== 'X' && winner !== 'O') {
            socket.emit('gameError', 'Invalid winner symbol provided for fW. Use "X" or "O".');
            return;
        }

        game.status = 'finished';
        game.winner = winner;
        if (winner === 'X') {
            game.XWins++;
        } else if (winner === 'O') {
            game.OWins++;
        }

        io.to(gameId).emit('gameUpdate', game);
    });

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

        if (game.nextAllowedOuterCell !== null && game.nextAllowedOuterCell !== outerIndex && game.boardState[game.nextAllowedOuterCell][9] === '') {
            socket.emit('gameError', `You must play in the highlighted big square (${game.nextAllowedOuterCell}).`);
            return;
        }

        if (game.boardState[outerIndex][innerIndex] !== '') {
            socket.emit('gameError', 'This cell is already taken!');
            return;
        }

        game.boardState[outerIndex][innerIndex] = socket.symbol;

        checkInnerWin(game.boardState, outerIndex);

        let newNextAllowedOuterCell = innerIndex;
        if (game.boardState[newNextAllowedOuterCell][9] !== '') {

            newNextAllowedOuterCell = null;
        }

        game.nextAllowedOuterCell = newNextAllowedOuterCell;

        const overallWinner = checkOuterWin(game.boardState);

        if (overallWinner) {
            game.status = 'finished';
            game.winner = overallWinner;
            if (overallWinner === 'X') game.XWins++;
            else if (overallWinner === 'O') game.OWins++;
        } else {
            game.currentPlayer = calculatePlayerTurn(game.boardState); 
        }

        io.to(gameId).emit('gameUpdate', game); 
        console.log(`Move made in game ${gameId} by ${socket.symbol}: outer=${outerIndex}, inner=${innerIndex}`);
    });

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

    socket.on('leaveGame', () => {
        const gameId = socket.gameId;
        if (gameId && games[gameId]) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.id !== socket.userId);

            if (game.players.length === 0) {

                delete games[gameId];
                console.log(`Game ${gameId} deleted as last player left.`);
            } else {

                game.status = 'waiting'; 
                game.winner = null; 
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

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        const gameId = socket.gameId;
        if (gameId && games[gameId]) {
            const game = games[gameId];
            game.players = game.players.filter(p => p.socketId !== socket.id); 

            if (game.players.length === 0) {
                delete games[gameId];
                console.log(`Game ${gameId} deleted due to last player disconnect.`);
            } else {
                game.status = 'waiting'; 
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