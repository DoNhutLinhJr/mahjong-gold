import { useState, useEffect } from 'react';
import './App.css';

const BET_LEVELS = [20, 50, 100, 200, 500, 1000, 5000, 10000];

function App() {
  // --- STATE QUẢN LÝ MÀN HÌNH (LOBBY) ---
  const [isGameStarted, setIsGameStarted] = useState(false); 

  // --- GAME STATES ---
  const [grid, setGrid] = useState(Array(4).fill(Array(5).fill({ name: "?" })));
  const [balance, setBalance] = useState(100000);
  const [betIndex, setBetIndex] = useState(0);
  const betAmount = BET_LEVELS[betIndex];
  
  const [displayScore, setDisplayScore] = useState(0); 
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningTiles, setWinningTiles] = useState([]);
  const [isDropping, setIsDropping] = useState(false);
  const [currentMultiplierLevel, setCurrentMultiplierLevel] = useState(1);

  // --- STATE HIỆU ỨNG SCATTER ---
  const [isScatterWinAnimation, setIsScatterWinAnimation] = useState(false);

  // --- FREE SPIN STATES ---
  const [showFreeSpinModal, setShowFreeSpinModal] = useState(false); 
  const [showResultModal, setShowResultModal] = useState(false);     
  const [pendingFreeSpins, setPendingFreeSpins] = useState(0);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [isAuto, setIsAuto] = useState(false); 
  
  const [sessionWin, setSessionWin] = useState(0); 

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleIncreaseBet = () => { if (betIndex < BET_LEVELS.length - 1) setBetIndex(prev => prev + 1); };
  const handleDecreaseBet = () => { if (betIndex > 0) setBetIndex(prev => prev - 1); };

  // --- HÀM QUAY (KÍCH HOẠT GOD MODE TỪ CLIENT) ---
  const executeSpin = async (useGodMode = false) => {
    const isFreeRound = isAuto || freeSpinsLeft > 0;
    if (!isFreeRound) {
      setDisplayScore(0);
    }

    setWinningTiles([]);
    setIsSpinning(true);
    setIsDropping(false);
    setCurrentMultiplierLevel(1);
    setIsScatterWinAnimation(false);

    try {
      // Gửi cờ god=true lên Server
      const response = await fetch(`http://localhost:5000/api/spin?bet=${betAmount}&isFree=${isFreeRound}&god=${useGodMode}`);
      const data = await response.json();

      if (response.status === 400) {
        alert(data.error); setIsSpinning(false); setIsAuto(false); return;
      }
      setBalance(data.balance); 

      await delay(800);
      setIsSpinning(false);
      
      await processRounds(data.rounds);

      // --- XỬ LÝ TRÚNG FREE SPIN ---
      if (data.freeSpinsAdded > 0) {
        // 1. Hiệu ứng nhấp nháy
        setIsScatterWinAnimation(true);
        new Audio('/assets/freespin.mp3').play().catch(()=>{}); 

        // 2. Chờ 2s để ngắm
        await delay(2000);

        // 3. Tắt hiệu ứng
        setIsScatterWinAnimation(false);

        if (isAuto || freeSpinsLeft > 0) {
          setFreeSpinsLeft(prev => prev + data.freeSpinsAdded);
        } else {
          setPendingFreeSpins(data.freeSpinsAdded);
          await delay(500);
          setShowFreeSpinModal(true);
        }
      }
      
      await delay(500);
      setCurrentMultiplierLevel(1);

    } catch (error) {
      console.error(error); setIsSpinning(false);
    }
  };

  const processRounds = async (rounds) => {
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      setGrid(round.grid);
      setCurrentMultiplierLevel(round.multiplier);
      
      if (i > 0) {
        setIsDropping(true); await delay(1000); setIsDropping(false);
      }
      
      if (round.winningTiles.length > 0) {
        new Audio('/assets/win.mp3').play().catch(()=>{}); 
        setWinningTiles(round.winningTiles);
        
        setDisplayScore(prev => prev + round.score);
        
        if (isAuto || freeSpinsLeft > 0) {
            setSessionWin(prev => prev + round.score);
        }

        await delay(1000); 
        setWinningTiles([]);
      }
    }
  };

  const handleStartFreeSpins = () => {
    setShowFreeSpinModal(false);
    setSessionWin(0); 
    setDisplayScore(0); 
    setFreeSpinsLeft(prev => prev + pendingFreeSpins);
    setIsAuto(true);
  };

  const handleCloseResult = () => {
    setShowResultModal(false);
    setDisplayScore(0); 
    setSessionWin(0);
  };

  useEffect(() => {
    const runAutoLoop = async () => {
      // Chỉ chạy Auto khi không có animation thắng Scatter đang diễn ra
      if (isAuto && freeSpinsLeft > 0 && !isSpinning && winningTiles.length === 0 && !isDropping && !isScatterWinAnimation) {
        await delay(1000); 
        setFreeSpinsLeft(prev => prev - 1); 
        await executeSpin(); 
      } 
      else if (isAuto && freeSpinsLeft === 0 && !isSpinning && winningTiles.length === 0 && !isDropping && !isScatterWinAnimation) {
        setIsAuto(false);
        await delay(500);
        setShowResultModal(true); 
        new Audio('/assets/freespin.mp3').play().catch(()=>{});
      }
    };
    runAutoLoop();
  }, [isAuto, freeSpinsLeft, isSpinning, winningTiles, isDropping, isScatterWinAnimation]);

  const handleManualSpin = () => { if (!isAuto) executeSpin(); };
  const isBusy = isSpinning || winningTiles.length > 0 || isDropping || isScatterWinAnimation;
  const formatMoney = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // ----------------------------------------------------
  // MÀN HÌNH CHỜ (LOBBY)
  // ----------------------------------------------------
  if (!isGameStarted) {
    return (
      <div className="game-container">
        <div className="home-screen">
          <div className="home-logo">MAHJONG<br/>GOLD</div>
          <div className="home-subtitle">ĐƯỜNG ĐẾN MAHJONG</div>
          <button className="start-btn-large" onClick={() => setIsGameStarted(true)}>
            CHƠI NGAY
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MÀN HÌNH GAME CHÍNH
  // ----------------------------------------------------
  return (
    <div className="game-container">
      
      {showFreeSpinModal && (
        <div className="freespin-modal">
          <div className="freespin-text">CHÚC MỪNG!</div>
          <div style={{color: 'gold', fontSize: '24px', textAlign:'center'}}>
            BẠN TRÚNG <span style={{fontSize:'40px', color:'red'}}>{pendingFreeSpins}</span> VÒNG QUAY MIỄN PHÍ
          </div>
          <button className="spin-btn-orb" style={{marginTop: '30px', width: '100px', height: '100px'}} onClick={handleStartFreeSpins}>
             <span style={{fontWeight:'bold', fontSize:'20px'}}>NHẬN</span>
          </button>
        </div>
      )}

      {showResultModal && (
        <div className="freespin-modal">
          <div className="freespin-text" style={{color: 'gold'}}>TỔNG KẾT</div>
          <div style={{color: 'white', fontSize: '20px', textAlign:'center', marginBottom: '10px'}}>
            TỔNG TIỀN THẮNG MIỄN PHÍ
          </div>
          <div style={{fontSize:'50px', color:'#00ff00', fontWeight:'bold', textShadow: '0 0 20px green'}}>
            {formatMoney(sessionWin)}
          </div>
          <button className="spin-btn-orb" style={{marginTop: '30px', width: '100px', height: '100px'}} onClick={handleCloseResult}>
             <span style={{fontWeight:'bold', fontSize:'20px'}}>ĐÓNG</span>
          </button>
        </div>
      )}

      <div className="header">
          {/* Nút Back về Lobby */}
          <div 
            style={{position:'absolute', left:'10px', color:'#d6a664', fontSize:'24px', cursor:'pointer', zIndex: 50}}
            onClick={() => setIsGameStarted(false)}
          >
            ⬅
          </div>

          <h1 
            className="ways-text" 
            /* Bấm vào đây để KÍCH HOẠT HACK */
            onClick={() => {
                if(!isBusy && !isAuto) {
                    executeSpin(true); 
                }
            }}
            style={{cursor: 'pointer', userSelect: 'none'}}
            title="Đừng bấm vào đây nha hehe"
          >
            MAHJONG GOLD
          </h1>
      </div>
      
      <div className="multiplier-bar">
         <div className={`mul-item ${currentMultiplierLevel === 1 ? 'active' : ''}`}>x1</div>
         <div className={`mul-item ${currentMultiplierLevel === 2 ? 'active' : ''}`}>x2</div>
         <div className={`mul-item ${currentMultiplierLevel === 3 ? 'active' : ''}`}>x3</div>
         <div className={`mul-item ${currentMultiplierLevel === 5 ? 'active' : ''}`}>x5</div>
      </div>

      <div className="main-content">
        <div className="slot-frame">
          <div className="slot-machine">
            {grid.map((row, rowIndex) => (
              row.map((tile, colIndex) => {
                const isWinner = winningTiles.some(t => t.r === rowIndex && t.c === colIndex);
                let tileClass = "tile";
                let style = {};
                
                if (tile && tile.isGold) tileClass += " is-gold"; 
                if (tile && tile.id === 'wild') tileClass += " is-wild";
                if (tile && tile.id === 'scatter') tileClass += " is-scatter"; 

                // Class hiệu ứng thắng Scatter
                if (isScatterWinAnimation && tile && tile.id === 'scatter') {
                    tileClass += " is-scatter-win";
                }

                if (isSpinning) { tileClass += " is-spinning"; style.animationDelay = `${colIndex * 0.1}s`; } 
                else if (isWinner) { tileClass += " is-winner"; } 
                else if (isDropping) { tileClass += " is-falling"; style.animationDelay = `${(3 - rowIndex) * 0.3}s`; }

                return (
                  <div key={`${rowIndex}-${colIndex}`} className={tileClass} style={style}>
                    {tile && tile.id ? (
                      <img src={`/assets/${tile.id}.jpg`} alt={tile.name} style={{ width: '90%', height: '90%', objectFit: 'contain' }} onError={(e) => {e.target.style.display = 'none';}} />
                    ) : <div className="tile-placeholder"></div>}
                  </div>
                );
              })
            ))}
          </div>
        </div>
        
        <div className="win-banner-container">
          {displayScore > 0 && <div className="win-banner"><h2 className="win-amount">{formatMoney(displayScore)}</h2></div>}
        </div>
      </div>

      <div className="footer">
         <div className="info-strip">
           <div className="info-box"><div className="info-label">BALANCE</div><div className="info-value">{formatMoney(balance)}</div></div>
           <div className="info-box"><div className="info-label">BET</div><div className="info-value">{formatMoney(betAmount)}</div></div>
           <div className="info-box"><div className="info-label">WIN</div><div className="info-value">{formatMoney(displayScore)}</div></div>
         </div>
         <div className="control-deck">
             <button className="btn-func"><span>⚡</span> TURBO</button>
             <button className="btn-circle-small" onClick={handleDecreaseBet} disabled={isBusy || isAuto}>−</button>
             <button className="spin-btn-orb" onClick={handleManualSpin} disabled={isBusy || isAuto}>
                 {freeSpinsLeft > 0 ? (<div style={{display:'flex', flexDirection:'column', alignItems:'center'}}><span style={{fontSize:'24px', fontWeight:'bold', color:'white'}}>{freeSpinsLeft}</span><span style={{fontSize:'10px', color:'gold'}}>LEFT</span></div>) : (<div className="spin-icon"></div>)}
             </button>
             <button className="btn-circle-small" onClick={handleIncreaseBet} disabled={isBusy || isAuto}>+</button>
             <button className="btn-func"><span>▶</span> AUTO</button>
         </div>
      </div>
    </div>
  );
}

export default App;