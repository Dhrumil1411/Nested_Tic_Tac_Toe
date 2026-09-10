const socket = io();

let currentUserId = null;
let currentGameId = null;
let currentPlayerSymbol = null;

const lobbySection = document.getElementById('lobby-section');
const gameSection = document.getElementById('game-section');
const userIdDisplay = document.getElementById('user-id');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameInput = document.getElementById('game-id-input');
const joinGameBtn = document.getElementById('join-game-btn');
const playerTurnDisplay = document.getElementById('player-turn-display');
const myPlayerSymbolDisplay = document.getElementById('my-player-symbol');
const xWinsDisplay = document.getElementById('X-wins');
const oWinsDisplay = document.getElementById('O-wins');
const outerBoardElement = document.querySelector('.outer-board');
const resetGameBtn = document.getElementById('reset-game-btn');
const leaveGameBtn = document.getElementById('leave-game-btn');
const currentGameIdValueDisplay = document.getElementById('current-game-id-value'); 

const modal = document.getElementById('my-modal');
const modalMessage = document.getElementById('modal-message');
const closeButton = document.querySelector('.close-button');
const displayedGameId = document.getElementById('displayed-game-id');
const gameCodeDisplay = document.getElementById('game-code-display');
const modalActionButton = document.getElementById('modal-action-button');

let board = Array(9).fill(null).map(() => Array(10).fill(''));
let nextAllowedOuterCell = null;

function showModal(message, actionButtonText = null, actionButtonCallback = null, gameIdToDisplay = null) {
    modalMessage.textContent = message;
    gameCodeDisplay.style.display = 'none';
    modalActionButton.style.display = 'none';

    if (gameIdToDisplay) {
        displayedGameId.textContent = gameIdToDisplay;
        gameCodeDisplay.style.display = 'block';
    }
    if (actionButtonText && actionButtonCallback) {
        modalActionButton.textContent = actionButtonText;
        modalActionButton.onclick = actionButtonCallback;
        modalActionButton.style.display = 'block';
    }
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
}

closeButton.onclick = closeModal;
window.onclick = (event) => {
    if (event.target === modal) {
        closeModal();
    }
};

function copyGameCode() {
    const gameCode = displayedGameId.textContent;
    if (gameCode) {
        const textArea = document.createElement("textarea");
        textArea.value = gameCode;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showModal("Game ID copied to clipboard!");
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showModal("Failed to copy game ID. Please copy it manually: " + gameCode);
        }
        document.body.removeChild(textArea);
    }
}
window.copyGameCode = copyGameCode;

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('yourId', (userId) => {
    currentUserId = userId;
    userIdDisplay.textContent = currentUserId;
});

socket.on('gameCreated', (gameData) => {
    currentGameId = gameData.id;
    currentPlayerSymbol = gameData.players.find(p => p.id === currentUserId).symbol;
    myPlayerSymbolDisplay.textContent = currentPlayerSymbol;
    currentGameIdValueDisplay.textContent = currentGameId; 
    showModal(`Game created! Share this ID:`, null, null, currentGameId);
    showGameSection();
    renderBoard(gameData);
});

socket.on('gameJoined', (data) => {
    const gameData = data.game;
    currentGameId = gameData.id;
    currentPlayerSymbol = data.symbol;
    myPlayerSymbolDisplay.textContent = currentPlayerSymbol;
    currentGameIdValueDisplay.textContent = currentGameId; 
    showModal(`Joined game ${currentGameId} as ${currentPlayerSymbol}.`);
    showGameSection();
    renderBoard(gameData);
});

socket.on('gameUpdate', (gameData) => {
    console.log('Game state updated:', gameData);
    const oldXWins = parseInt(xWinsDisplay.textContent);
    const oldOWins = parseInt(oWinsDisplay.textContent);

    renderBoard(gameData);

    if (gameData.XWins > oldXWins) {
        xWinsDisplay.classList.add('score-bump');
        setTimeout(() => xWinsDisplay.classList.remove('score-bump'), 300);
    }
    if (gameData.OWins > oldOWins) {
        oWinsDisplay.classList.add('score-bump');
        setTimeout(() => oWinsDisplay.classList.remove('score-bump'), 300);
    }
});

socket.on('gameError', (message) => {
    showModal(`Error: ${message}`);
    console.error('Game Error:', message);
});

socket.on('gameLeft', () => {
    currentGameId = null;
    currentPlayerSymbol = null;
    showModal("You have left the game.", "Return to Lobby", showLobbySection);
    resetGameUI();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showModal("Disconnected from game server. Please refresh.", "Reconnect", () => location.reload());
    resetGameUI();
    showLobbySection();
});

function renderBoard(gameData) {
    board = gameData.boardState;
    const currentPlayer = gameData.currentPlayer;
    nextAllowedOuterCell = gameData.nextAllowedOuterCell;
    const gameStatus = gameData.status;
    const gameWinner = gameData.winner;
    const xWins = gameData.XWins || 0;
    const oWins = gameData.OWins || 0;

    playerTurnDisplay.textContent = gameStatus === 'playing' ? `${currentPlayer}'s Turn` : (gameStatus === 'waiting' ? 'Waiting for opponent...' : (gameWinner ? (gameWinner === 'D' ? 'Draw!' : `${gameWinner} Wins!`) : 'Game Over!'));

    if (gameStatus === 'playing' && currentPlayer === currentPlayerSymbol) {
        playerTurnDisplay.classList.add('current-turn');
    } else {
        playerTurnDisplay.classList.remove('current-turn');
    }

    xWinsDisplay.textContent = xWins;
    oWinsDisplay.textContent = oWins;
    currentGameIdValueDisplay.textContent = currentGameId || 'N/A'; 

    outerBoardElement.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const outerCellElement = document.createElement('div');
        outerCellElement.classList.add('outer-cell');
        outerCellElement.dataset.outerIndex = i;

        const outerWinner = board[i][9];
        if (outerWinner) {
            if (outerWinner === 'X') outerCellElement.classList.add('winner-X');
            else if (outerWinner === 'O') outerCellElement.classList.add('winner-O');
            else if (outerWinner === 'D') outerCellElement.classList.add('winner-draw');
        }

        const isCurrentPlayersTurn = (currentPlayer === currentPlayerSymbol);
        const isAllowedBoard = (nextAllowedOuterCell === null || nextAllowedOuterCell === i || board[nextAllowedOuterCell][9] !== '');

        if (gameStatus === 'playing' && isCurrentPlayersTurn && isAllowedBoard && !outerWinner && gameWinner === null) {
            outerCellElement.classList.add('active-board');
        }

        const innerBoardElement = document.createElement('div');
        innerBoardElement.classList.add('inner-board');

        for (let j = 0; j < 9; j++) {
            const innerCellElement = document.createElement('div');
            innerCellElement.classList.add('inner-cell');
            innerCellElement.dataset.innerIndex = j;
            innerCellElement.dataset.outerIndex = i;
            innerCellElement.textContent = board[i][j];

            if (board[i][j] === 'X') {
                innerCellElement.classList.add('player-X');
            } else if (board[i][j] === 'O') {
                innerCellElement.classList.add('player-O');
            }

            const isCellDisabled = board[i][j] !== '' || gameStatus !== 'playing' || !isCurrentPlayersTurn ||
                                   (!isAllowedBoard && board[nextAllowedOuterCell][9] === '') ||
                                   outerWinner !== '';

            if (isCellDisabled) {
                innerCellElement.classList.add('disabled');
                innerCellElement.style.cursor = 'not-allowed';
            } else {
                innerCellElement.classList.remove('disabled');
                innerCellElement.style.cursor = 'pointer';
                innerCellElement.onclick = handleCellClick;
            }
            innerBoardElement.appendChild(innerCellElement);
        }
        outerCellElement.appendChild(innerBoardElement);
        outerBoardElement.appendChild(outerCellElement);
    }

    if (gameStatus === 'finished' && gameWinner) {
        resetGameBtn.style.display = 'block';
        showModal(gameWinner === 'D' ? "It's a Draw!" : `${gameWinner} Wins the Game!`, "Play Again", () => { socket.emit('resetGame'); closeModal(); });
    } else {
        resetGameBtn.style.display = 'none';
    }
}

function fWG(winnerSymbol) {
    if (!currentGameId) {
        showModal("You need to be in a game to use this command.");
        return;
    }
    if (winnerSymbol !== 'X' && winnerSymbol !== 'O') {
        showModal("Invalid symbol. Use 'X' or 'O' (case-sensitive).");
        return;
    }
    socket.emit('fW', { gameId: currentGameId, winner: winnerSymbol });
}

window.fWG = fWG;

function handleCellClick(event) {
    const clickedCell = event.currentTarget;
    const outerIndex = parseInt(clickedCell.dataset.outerIndex);
    const innerIndex = parseInt(clickedCell.dataset.innerIndex);

    socket.emit('makeMove', { outerIndex, innerIndex });
}

function showLobbySection() {
    lobbySection.style.display = 'flex';
    gameSection.style.display = 'none';
}

function showGameSection() {
    lobbySection.style.display = 'none';
    gameSection.style.display = 'flex';
}

function resetGameUI() {
    outerBoardElement.innerHTML = '';
    currentGameIdValueDisplay.textContent = 'N/A'; 

    for (let i = 0; i < 9; i++) {
        const outerCellElement = document.createElement('div');
        outerCellElement.classList.add('outer-cell');
        const innerBoardElement = document.createElement('div');
        innerBoardElement.classList.add('inner-board');
        for (let j = 0; j < 9; j++) {
            const innerCellElement = document.createElement('div');
            innerCellElement.classList.add('inner-cell');
            innerBoardElement.appendChild(innerCellElement);
        }
        outerCellElement.appendChild(innerBoardElement);
        outerBoardElement.appendChild(outerCellElement);
    }

    playerTurnDisplay.textContent = 'Waiting for players...';
    myPlayerSymbolDisplay.textContent = '';
    xWinsDisplay.textContent = '0';
    oWinsDisplay.textContent = '0';
    resetGameBtn.style.display = 'none';
    board = Array(9).fill(null).map(() => Array(10).fill(''));
    nextAllowedOuterCell = null;
}

createGameBtn.addEventListener('click', () => {
    socket.emit('createGame');
});

joinGameBtn.addEventListener('click', () => {
    const gameId = joinGameInput.value.trim();
    if (gameId) {
        socket.emit('joinGame', gameId);
    } else {
        showModal("Please enter a Game ID.");
    }
});

resetGameBtn.addEventListener('click', () => {
    socket.emit('resetGame');
});

leaveGameBtn.addEventListener('click', () => {
    socket.emit('leaveGame');
});

resetGameUI();
showLobbySection();