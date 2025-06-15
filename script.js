const board = Array(9).fill().map(() => Array(10).fill(''));
console.log(board);
function playerTurn(board) {
    x = 0
    o = 0

    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (board[i][j] === 'X') {
                x++;
            } else if (board[i][j] === 'O') {
                o++;
            }
        }
    }
    if (x > o) {
        return `O`;
    }
    return `X`;
}

let nextCell = null;

document.getElementById('start-game').addEventListener('click', () => {
    const player1 = document.getElementById('player1').value || 'Player 1';
    const player2 = document.getElementById('player2').value || 'Player 2';

    document.getElementById('player-names').innerHTML = `${player1} (X) <b>VS</b> ${player2} (O)`;
    document.getElementById('player-turn').innerHTML = `${playerTurn(board)}'s Turn`;
    document.querySelector('.game-container').style.display = 'block';
    document.querySelector('.player-form').style.display = 'none';

});

document.querySelectorAll('.inner-cell').forEach(cell => {
    cell.addEventListener('click', (event) => {
        const clickedCell = event.currentTarget; // The inner cell
        const outerCell = clickedCell.closest('.outer-cell'); // Parent square

        const outerIndex = parseInt(outerCell.dataset.outerIndex); // "0"-"8"
        const innerIndex = parseInt(clickedCell.dataset.innerIndex); // "0"-"8"

        // Only proceed if cell is empty
        if (cell.textContent === '') {
            if (nextCell == null || nextCell === outerIndex) {
                outerCell.style.backgroundColor = 'white'; // Highlight the outer square
                if (board[innerIndex][9] !== '') {
                    document.querySelectorAll('.outer-cell').forEach(cell => {
                        cell.style.pointerEvents = "auto";
                    });
                    nextCell = null; // Reset cell if the outer square already has a winner
                }
                else {
                    document.querySelectorAll('.outer-cell').forEach(cell => {
                        if (cell.dataset.outerIndex == innerIndex) {
                            cell.style.backgroundColor = 'lightblue';
                            cell.style.pointerEvents = "auto";// Highlight the next outer square
                        } else {
                            cell.style.pointerEvents = 'none'; // Disable pointer events for other outer squares
                        }
                    });
                    nextCell = innerIndex; // Set the cell to the current outer index
                }
                Turn = playerTurn(board);

                // Update the board state
                board[outerIndex][innerIndex] = Turn;

                // Update the UI
                clickedCell.textContent = Turn;

                // Update turn display
                document.getElementById('player-turn').innerHTML = `${playerTurn(board)}'s Turn`;

                // Check for wins here if needed
                innerWin = checkInnerWin(board, outerIndex);
                console.log(`Inner Win: ${innerWin}`);
                if (innerWin) {
                    console.log(board);
                    if (innerWin === 'X') {
                        outerCell.style.backgroundColor = 'lightcoral';
                    } else {
                        outerCell.style.backgroundColor = 'lightgreen';
                    }
                    outerCell.querySelectorAll('.inner-cell').forEach(cell => {
                        cell.textContent = innerWin;
                    });
                    // Check for outer win
                    outerWin = checkOuterWin(board);
                    if (outerWin) {
                        console.log(`Outer Win: ${outerWin}`);

                        document.getElementById(`${outerWin}`).dataset.win = document.getElementById(`${outerWin}`).textContent = `${outerWin} : ` + parseInt(document.getElementById(`${outerWin}`).dataset.win) + 1;
                        document.querySelectorAll('.inner-cell').forEach(cell => {
                            cell.textContent = outerWin;
                        });
                        if (innerWin === 'X') {
                            document.querySelectorAll('.outer-cell').forEach(cell => {
                                cell.style.backgroundColor = "lightcoral";
                            });
                        } else {
                            document.querySelectorAll('.outer-cell').forEach(cell => {
                                cell.style.backgroundColor = "lightgreen";
                            });
                        }

                    }
                }
            }
        }


        console.log(`Clicked: Big Square ${outerIndex}, Small Square ${innerIndex}`);
    });
});

document.getElementById('reset-game').addEventListener('click', () => {
    // Reset the board state
    board.forEach(row => row.fill(''));

    // Clear the UI
    document.querySelectorAll('.inner-cell').forEach(cell => {
        cell.textContent = '';
    });

    document.querySelectorAll('.outer-cell').forEach(cell => {
        cell.style.backgroundColor = ''; // Reset any color
        cell.style.pointerEvents = 'auto'; // Enable pointer events for all outer squares
    });

    // Reset player names and turn display
    // document.getElementById('player-names').innerHTML = '';
    document.getElementById('player-turn').innerHTML = 'X\'s Turn';
    // // Hide game container and show player form
    // document.querySelector('.game-container').style.display = 'none';
    // document.querySelector('.player-form').style.display = 'block';
});

function checkInnerWin(board, outerIndex) {
    // Check rows, columns, and diagonals for a win
    const winningCombinations = [
        // Rows
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        // Columns
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        // Diagonals
        [0, 4, 8], [2, 4, 6]
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[outerIndex][a] && board[outerIndex][a] === board[outerIndex][b] && board[outerIndex][a] === board[outerIndex][c]) {
            board[outerIndex][9] = board[outerIndex][a]; // Store the winner in the 9th index
            return board[outerIndex][a]; // Return the winner ('X' or 'O')
        }
    }

    return null; // No winner yet
}

function checkOuterWin(board) {
    // Check rows, columns, and diagonals for a win
    const winningCombinations = [
        // Rows
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        // Columns
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        // Diagonals
        [0, 4, 8], [2, 4, 6]
    ];

    for (const combination of winningCombinations) {
        const [a, b, c] = combination;
        if (board[a][9] && board[a][9] === board[b][9] && board[a][9] === board[c][9]) {
            return board[a][9]; // Return the winner ('X' or 'O')
        }
    }

    return null; // No winner yet
}

document.getElementById('player-names').addEventListener('dblclick', () => {
    document.querySelector('.game-container').style.display = 'none';
    document.querySelector('.player-form').style.display = 'block';
});