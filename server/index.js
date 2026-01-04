// server/index.js
const express = require('express');
const cors = require('cors');
const app = express();
const port = 5000;

app.use(cors());

// --- CẤU HÌNH ---
const ROWS = 4;
const COLS = 5;
const MULTIPLIERS = [1, 2, 3, 5]; 

let GLOBAL_BALANCE = 100000;

const TILES = [
    { id: "a1", name: "Quân A1", weight: 80, value: 0.5 },
    { id: "a2", name: "Quân A2", weight: 80, value: 0.8 },
    { id: "a3", name: "Quân A3", weight: 80, value: 1.2 },
    { id: "a4", name: "Quân A4", weight: 60, value: 2.0 },
    { id: "a5", name: "Quân A5", weight: 40, value: 5.0 },
    { id: "scatter", name: "SCATTER", weight: 15, value: 0 },
    { id: "wild", name: "WILD", weight: 10, value: 0 }
];

const TOTAL_WEIGHT = TILES.reduce((sum, t) => sum + t.weight, 0);

function getRandomTile(colIndex) {
    let randomNum = Math.floor(Math.random() * TOTAL_WEIGHT);
    let selectedTile = TILES[0];
    for (let tile of TILES) {
        randomNum -= tile.weight;
        if (randomNum < 0) {
            selectedTile = tile;
            break;
        }
    }
    let isGold = false;
    if (colIndex >= 1 && colIndex <= 3 && selectedTile.id !== 'wild' && selectedTile.id !== 'scatter') {
        isGold = Math.random() < 0.3; 
    }
    return { ...selectedTile, uid: Math.random(), isGold: isGold };
}

function createGrid() {
    let grid = [];
    for (let r = 0; r < ROWS; r++) {
        let row = [];
        for (let c = 0; c < COLS; c++) {
            row.push(getRandomTile(c));
        }
        grid.push(row);
    }
    return grid;
}

// --- HACK GRID (SUPER GOD MODE - NỔ SIÊU TO) ---
function createGodGrid() {
    const grid = [];
    
    // Hàng 0: FULL WILD (Quân Vạn Năng - Màu đỏ) -> Kết hợp với mọi thứ bên dưới
    grid.push([
        { id: "wild", name: "WILD", value: 0, uid: Math.random(), isGold: false },
        { id: "wild", name: "WILD", value: 0, uid: Math.random(), isGold: false },
        { id: "wild", name: "WILD", value: 0, uid: Math.random(), isGold: false },
        { id: "wild", name: "WILD", value: 0, uid: Math.random(), isGold: false },
        { id: "wild", name: "WILD", value: 0, uid: Math.random(), isGold: false }
    ]);

    // Hàng 1: FULL A5 (Quân Vua - Màu vàng) -> Ăn điểm cực to
    grid.push([
        { id: "a5", name: "Quân A5", value: 5.0, uid: Math.random(), isGold: true },
        { id: "a5", name: "Quân A5", value: 5.0, uid: Math.random(), isGold: true },
        { id: "a5", name: "Quân A5", value: 5.0, uid: Math.random(), isGold: true },
        { id: "a5", name: "Quân A5", value: 5.0, uid: Math.random(), isGold: true },
        { id: "a5", name: "Quân A5", value: 5.0, uid: Math.random(), isGold: true }
    ]);

    // Hàng 2: FULL SCATTER (5 con -> 20 vòng Free Spin)
    grid.push([
        { id: "scatter", name: "SCATTER", value: 0, uid: Math.random() },
        { id: "scatter", name: "SCATTER", value: 0, uid: Math.random() },
        { id: "scatter", name: "SCATTER", value: 0, uid: Math.random() },
        { id: "scatter", name: "SCATTER", value: 0, uid: Math.random() },
        { id: "scatter", name: "SCATTER", value: 0, uid: Math.random() },
    ]);

    // Hàng 3: Random (lấp chỗ trống)
    grid.push([getRandomTile(0), getRandomTile(1), getRandomTile(2), getRandomTile(3), getRandomTile(4)]);

    return grid;
}

function checkWinBasic(grid, betAmount) {
    let baseRoundScore = 0;
    let winningTiles = []; 

    for (let r = 0; r < ROWS; r++) {
        let row = grid[r];
        let t1 = row[0], t2 = row[1], t3 = row[2];
        
        if ((t1.id === t2.id || t1.id === 'wild' || t2.id === 'wild') && 
            (t2.id === t3.id || t2.id === 'wild' || t3.id === 'wild') &&
            t1.id !== 'scatter') {
            
             let baseTile = (t1.id !== 'wild') ? t1 : (t2.id !== 'wild' ? t2 : t3);
             baseRoundScore += baseTile.value * betAmount;
             winningTiles.push({r: r, c: 0}, {r: r, c: 1}, {r: r, c: 2});
        }
    }
    return { baseRoundScore, winningTiles };
}

function cascadeGrid(grid, winningTiles) {
    winningTiles.forEach(pos => {
        let tile = grid[pos.r][pos.c];
        if (tile && tile.isGold) {
            grid[pos.r][pos.c] = { ...tile, id: 'wild', name: 'WILD', isGold: false, uid: Math.random() };
        } else {
            grid[pos.r][pos.c] = null;
        }
    });
    for (let c = 0; c < COLS; c++) {
        let newCol = [];
        for (let r = 0; r < ROWS; r++) {
            if (grid[r][c] !== null) newCol.push(grid[r][c]);
        }
        let missingCount = ROWS - newCol.length;
        for (let i = 0; i < missingCount; i++) {
            newCol.unshift(getRandomTile(c));
        }
        for (let r = 0; r < ROWS; r++) {
            grid[r][c] = newCol[r];
        }
    }
    return grid;
}

app.get('/api/spin', (req, res) => {
    const betAmount = parseInt(req.query.bet) || 20;
    const isFreeSpin = req.query.isFree === 'true'; 
    const isGodMode = req.query.god === 'true'; 

    if (!isFreeSpin && !isGodMode) {
        if (GLOBAL_BALANCE < betAmount) {
            return res.status(400).json({ error: "Không đủ số dư!" });
        }
        GLOBAL_BALANCE -= betAmount;
    }

    // Chọn lưới thường hoặc lưới Hack "Siêu Bão"
    let currentGrid = isGodMode ? createGodGrid() : createGrid();

    let rounds = [];
    let totalScore = 0;
    let loopCount = 0;

    while (loopCount < 10) {
        const result = checkWinBasic(currentGrid, betAmount);
        
        let multiplierIndex = Math.min(loopCount, MULTIPLIERS.length - 1);
        let currentMultiplier = MULTIPLIERS[multiplierIndex];
        let finalRoundScore = Math.floor(result.baseRoundScore * currentMultiplier);

        rounds.push({
            grid: JSON.parse(JSON.stringify(currentGrid)),
            score: finalRoundScore,
            winningTiles: result.winningTiles,
            multiplier: currentMultiplier
        });

        totalScore += finalRoundScore;

        if (result.winningTiles.length === 0) break;
        currentGrid = cascadeGrid(currentGrid, result.winningTiles);
        loopCount++;
    }

    let uniqueScatters = new Set();
    rounds.forEach(round => {
        round.grid.forEach(row => {
            row.forEach(tile => {
                if (tile && tile.id === 'scatter') {
                    uniqueScatters.add(tile.uid);
                }
            });
        });
    });

    let scatterCount = uniqueScatters.size;
    let freeSpinsAdded = 0;

    // Logic thưởng mốc cố định
    if (scatterCount === 3) freeSpinsAdded = 10;
    else if (scatterCount === 4) freeSpinsAdded = 15;
    else if (scatterCount >= 5) freeSpinsAdded = 20;

    GLOBAL_BALANCE += totalScore;

    res.json({
        totalScore,
        rounds,
        freeSpinsAdded,
        balance: GLOBAL_BALANCE
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});