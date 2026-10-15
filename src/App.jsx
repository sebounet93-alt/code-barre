import React, { useState, useEffect } from 'react';
import { Terminal, Delete, Check, RotateCcw, Award, AlertTriangle, Share2, Volume2, VolumeX, BarChart3, Infinity as InfinityIcon, Calendar } from 'lucide-react';

const DIFFICULTIES = {
  EASY: { name: 'Facile', length: 4, maxAttempts: 6, uniqueOnly: false },
  NORMAL: { name: 'Normal', length: 6, maxAttempts: 5, uniqueOnly: false },
  EXPERT: { name: 'Expert', length: 6, maxAttempts: 4, uniqueOnly: true }
};

function getDaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getDailyChallengeNumber() {
  const launchDate = new Date(2026, 0, 1).getTime();
  const today = new Date().getTime();
  return Math.max(1, Math.floor((today - launchDate) / (1000 * 60 * 60 * 24)));
}

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateCode(length, uniqueOnly = false, rng = Math.random) {
  if (!uniqueOnly) {
    return Array.from({ length }, () => Math.floor(rng() * 10).toString()).join('');
  }
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits.slice(0, length).join('');
}

function buildClues(secret) {
  const d = secret.split('').map(Number);
  const len = d.length;
  const clues = [];

  const sum = d.reduce((acc, v) => acc + v, 0);
  clues.push(`La somme des ${len} chiffres est égale à ${sum}`);

  const evens = d.filter(n => n % 2 === 0).length;
  clues.push(`Contient exactement ${evens} chiffre${evens > 1 ? 's' : ''} pair${evens > 1 ? 's' : ''}`);

  const numVal = parseInt(secret, 10);
  if (numVal % 5 === 0) {
    clues.push("Le code entier est un multiple de 5");
  } else if (sum % 3 === 0) {
    clues.push("Le code entier est divisible par 3");
  }

  const prod = d[0] * d[1];
  clues.push(`Le produit des 2 premiers chiffres (C1 × C2) est ${prod}`);

  const avg = (sum / len).toFixed(1);
  clues.push(`La moyenne des chiffres est de ${avg}`);

  let hasConsecutive = false;
  for (let i = 0; i < len - 1; i++) {
    if (d[i + 1] === d[i] + 1 || d[i + 1] === d[i] - 1) {
      hasConsecutive = true;
      break;
    }
  }
  if (hasConsecutive) {
    clues.push("Contient au moins deux chiffres consécutifs côte à côte");
  } else {
    clues.push("Aucun chiffre consécutif n'est placé côte à côte");
  }

  const max = Math.max(...d);
  const min = Math.min(...d);
  clues.push(`Écart entre le plus grand (${max}) et le plus petit (${min}) : ${max - min}`);

  return clues;
}

function evaluateGuess(guess, secret) {
  const len = secret.length;
  const status = Array(len).fill('absent');
  const secretDigits = secret.split('');
  const guessDigits = guess.split('');

  for (let i = 0; i < len; i++) {
    if (guessDigits[i] === secretDigits[i]) {
      status[i] = 'correct';
      secretDigits[i] = null;
      guessDigits[i] = null;
    }
  }

  for (let i = 0; i < len; i++) {
    if (guessDigits[i] !== null) {
      const idx = secretDigits.indexOf(guessDigits[i]);
      if (idx !== -1) {
        status[i] = 'present';
        secretDigits[idx] = null;
      }
    }
  }

  return status;
}

function playTone(freq, duration, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

export default function App() {
  const [mode, setMode] = useState('daily');
  const [difficultyKey, setDifficultyKey] = useState('NORMAL');
  const diffConfig = DIFFICULTIES[difficultyKey];

  const todaySeed = getDaySeed();
  const challengeNo = getDailyChallengeNumber();

  const [secretCode, setSecretCode] = useState('');
  const [allClues, setAllClues] = useState([]);
  const [revealedClues, setRevealedClues] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ played: 0, won: 0, streak: 0 });

  // Nouveaux états pour l'effet Cyberpunk
  const [isDecoding, setIsDecoding] = useState(false);
  const [scrambleKey, setScrambleKey] = useState([]);
  const [laserStatus, setLaserStatus] = useState('idle'); // 'idle' | 'decoding' | 'error' | 'success'

  const initGame = (targetMode = mode, targetDiff = difficultyKey) => {
    const cfg = DIFFICULTIES[targetDiff];
    let code = '';

    if (targetMode === 'daily') {
      const rng = seededRandom(todaySeed);
      code = generateCode(cfg.length, cfg.uniqueOnly, rng);
    } else {
      code = generateCode(cfg.length, cfg.uniqueOnly, Math.random);
    }

    const clues = buildClues(code);
    setSecretCode(code);
    setAllClues(clues);
    setAttempts([]);
    setCurrentGuess('');
    setGameStatus('playing');
    setLaserStatus('idle');
    setCopied(false);

    if (targetMode === 'daily') {
      const savedDaily = localStorage.getItem(`cb_daily_${todaySeed}_${targetDiff}`);
      if (savedDaily) {
        const parsed = JSON.parse(savedDaily);
        setAttempts(parsed.attempts);
        setGameStatus(parsed.gameStatus);
        setRevealedClues(clues.slice(0, 2 + parsed.attempts.length));
        if (parsed.gameStatus === 'won') setLaserStatus('success');
        if (parsed.gameStatus === 'lost') setLaserStatus('error');
        return;
      }
    }
    setRevealedClues([clues[0], clues[1]]);
  };

  useEffect(() => {
    const saved = localStorage.getItem('cb_stats');
    if (saved) setStats(JSON.parse(saved));
    initGame(mode, difficultyKey);
  }, [mode, difficultyKey]);

  const updateStats = (isWin) => {
    const newStats = {
      played: stats.played + 1,
      won: stats.won + (isWin ? 1 : 0),
      streak: isWin ? stats.streak + 1 : 0
    };
    setStats(newStats);
    localStorage.setItem('cb_stats', JSON.stringify(newStats));
  };

  const handleKeyPress = (digit) => {
    if (gameStatus !== 'playing' || isDecoding) return;
    if (currentGuess.length < diffConfig.length) {
      if (soundEnabled) playTone(650 + currentGuess.length * 70, 0.05, 'triangle');
      if (navigator.vibrate) navigator.vibrate(15);
      setCurrentGuess(prev => prev + digit);
    }
  };

  const handleDelete = () => {
    if (gameStatus !== 'playing' || isDecoding) return;
    if (soundEnabled) playTone(320, 0.05, 'sawtooth');
    if (navigator.vibrate) navigator.vibrate(15);
    setCurrentGuess(prev => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (gameStatus !== 'playing' || currentGuess.length !== diffConfig.length || isDecoding) return;

    // Début de l'animation de décodage (Matrix)
    setIsDecoding(true);
    setLaserStatus('decoding');
    if (navigator.vibrate) navigator.vibrate([15, 30, 15, 30]);

    let frames = 0;
    const maxFrames = 15; // Environ 500ms d'animation
    
    const decodingInterval = setInterval(() => {
      frames++;
      setScrambleKey(Array.from({ length: diffConfig.length }, () => Math.floor(Math.random() * 10).toString()));
      if (soundEnabled && frames % 2 === 0) playTone(800 + Math.random() * 400, 0.02, 'square');

      if (frames >= maxFrames) {
        clearInterval(decodingInterval);
        setIsDecoding(false);
        setScrambleKey([]);
        processSubmit();
      }
    }, 35);
  };

  const processSubmit = () => {
    const evaluation = evaluateGuess(currentGuess, secretCode);
    const newAttempt = { guess: currentGuess, evaluation };
    const nextAttempts = [...attempts, newAttempt];
    setAttempts(nextAttempts);

    if (currentGuess === secretCode) {
      setLaserStatus('success');
      if (soundEnabled) {
        playTone(523, 0.1, 'sine');
        setTimeout(() => playTone(659, 0.1, 'sine'), 90);
        setTimeout(() => playTone(784, 0.25, 'sine'), 180);
      }
      setGameStatus('won');
      if (mode === 'daily') {
        localStorage.setItem(`cb_daily_${todaySeed}_${difficultyKey}`, JSON.stringify({ attempts: nextAttempts, gameStatus: 'won' }));
        updateStats(true);
      }
      return;
    }

    if (nextAttempts.length >= diffConfig.maxAttempts) {
      setLaserStatus('error');
      if (soundEnabled) playTone(180, 0.35, 'sawtooth');
      setGameStatus('lost');
      if (mode === 'daily') {
        localStorage.setItem(`cb_daily_${todaySeed}_${difficultyKey}`, JSON.stringify({ attempts: nextAttempts, gameStatus: 'lost' }));
        updateStats(false);
      }
      return;
    }

    // Flash d'erreur puis retour à l'état idle
    setLaserStatus('error');
    setTimeout(() => { if(gameStatus === 'playing') setLaserStatus('idle') }, 600);
    
    if (soundEnabled) playTone(220, 0.1, 'square');
    if (navigator.vibrate) navigator.vibrate(25);

    const nextIdx = revealedClues.length;
    if (allClues[nextIdx]) {
      setRevealedClues(prev => [...prev, allClues[nextIdx]]);
    }

    if (mode === 'daily') {
      localStorage.setItem(`cb_daily_${todaySeed}_${difficultyKey}`, JSON.stringify({ attempts: nextAttempts, gameStatus: 'playing' }));
    }

    setCurrentGuess('');
  };

  const handleShare = () => {
    const emojis = { correct: '🟩', present: '🟨', absent: '⬛' };
    const grid = attempts.map(att => att.evaluation.map(e => emojis[e]).join('')).join('\n');
    const score = gameStatus === 'won' ? `${attempts.length}/${diffConfig.maxAttempts}` : `X/${diffConfig.maxAttempts}`;
    const text = `« CODE:BARRE » ${mode === 'daily' ? `#${challengeNo}` : '(Entraînement)'} [${diffConfig.name}]\nRésultat : ${score}\n${grid}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Attribution dynamique des classes du laser en fonction du statut
  let laserClasses = "absolute left-0 right-0 pointer-events-none ";
  if (laserStatus === 'idle') laserClasses += "h-[2px] bg-red-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.95)] animate-scanner-idle";
  else if (laserStatus === 'decoding') laserClasses += "h-[3px] bg-cyan-400 shadow-[0_0_15px_4px_rgba(34,211,238,1)] animate-scanner-decoding";
  else if (laserStatus === 'error') laserClasses += "h-[3px] bg-red-600 shadow-[0_0_20px_5px_rgba(220,38,38,1)] animate-scanner-error";
  else if (laserStatus === 'success') laserClasses += "h-[4px] bg-neon-green shadow-[0_0_25px_8px_rgba(0,255,0,1)] animate-scanner-success";

  return (
    <>
      {/* Brouillage écran CRT */}
      <div className="crt-overlay"></div>

      <div className="min-h-screen flex items-center justify-center p-2 sm:p-4 font-mono text-white select-none z-10 relative">
        <div className="w-full max-w-sm bg-[#121316] rounded-[2.5rem] p-5 shadow-[0_0_50px_rgba(0,0,0,0.95)] border border-gray-800/80 relative overflow-hidden">
          
          {/* Barre du haut : Modes & Outils */}
          <div className="flex justify-between items-center mb-3 relative z-10">
            <div className="flex gap-1 bg-[#1a1b20] p-1 rounded-lg border border-gray-800">
              <button
                onClick={() => setMode('daily')}
                className={`px-2 py-1 text-[11px] rounded flex items-center gap-1 font-semibold transition-all ${
                  mode === 'daily' ? 'bg-neon-green text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Calendar size={12} /> Défi
              </button>
              <button
                onClick={() => setMode('practice')}
                className={`px-2 py-1 text-[11px] rounded flex items-center gap-1 font-semibold transition-all ${
                  mode === 'practice' ? 'bg-neon-green text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <InfinityIcon size={12} /> Libre
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setSoundEnabled(!soundEnabled)} className="text-gray-400 hover:text-white transition-colors">
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button onClick={() => setShowStats(!showStats)} className="text-gray-400 hover:text-white transition-colors">
                <BarChart3 size={16} />
              </button>
            </div>
          </div>

          {/* Sélecteur de Difficulté */}
          <div className="grid grid-cols-3 gap-1 mb-3 bg-[#18191e] p-1 rounded-xl border border-gray-800/80 text-[11px] relative z-10">
            {Object.keys(DIFFICULTIES).map((k) => (
              <button
                key={k}
                onClick={() => setDifficultyKey(k)}
                className={`py-1 rounded-lg font-bold transition-all ${
                  difficultyKey === k ? 'bg-white/10 text-neon-green border border-neon-green/40' : 'text-gray-400 hover:text-white'
                }`}
              >
                {DIFFICULTIES[k].name}
              </button>
            ))}
          </div>

          {/* Modal Stats */}
          {showStats && (
            <div className="mb-4 p-3 bg-black/90 border border-gray-800 rounded-2xl text-center space-y-2 relative z-20">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Statistiques</h3>
              <div className="flex justify-around">
                <div>
                  <p className="text-lg font-bold text-neon-green">{stats.played}</p>
                  <p className="text-[9px] text-gray-500 uppercase">Parties</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0}%</p>
                  <p className="text-[9px] text-gray-500 uppercase">Victoires</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-neon-green">{stats.streak}</p>
                  <p className="text-[9px] text-gray-500 uppercase">Série</p>
                </div>
              </div>
              <button onClick={() => setShowStats(false)} className="text-[10px] text-gray-400 hover:text-white pt-1 w-full">Fermer</button>
            </div>
          )}

          {/* Scanner Barcode Cyberpunk */}
          <div className="mb-4 relative flex justify-center py-2 px-3 bg-black/70 rounded-2xl border border-gray-800/80 overflow-hidden h-16 items-center">
            <div className="flex gap-1 items-center opacity-85 h-12">
              {[2,1,3,1,1,2,4,1,2,1,3,2,1,1,4,2,1,3,1,2,1,4,1,2,3,1,2,1,1,3].map((w, i) => (
                <div key={i} className="bg-white/90" style={{ width: `${w * 2}px`, height: i % 4 === 0 ? '100%' : '75%' }} />
              ))}
            </div>
            <div className={laserClasses} />
          </div>

          {/* Grille des essais */}
          <div className="space-y-1.5 mb-3 relative z-10">
            {Array.from({ length: diffConfig.maxAttempts }).map((_, rowIdx) => {
              const isCurrentRow = rowIdx === attempts.length;
              const pastAttempt = attempts[rowIdx];

              return (
                <div key={rowIdx} className="flex justify-between gap-1.5">
                  {Array.from({ length: diffConfig.length }).map((_, colIdx) => {
                    let char = '';
                    let cellStyle = 'border-gray-800/60 bg-[#16171a] text-gray-600';

                    if (pastAttempt) {
                      char = pastAttempt.guess[colIdx];
                      const evalStatus = pastAttempt.evaluation[colIdx];
                      if (evalStatus === 'correct') {
                        cellStyle = 'border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_8px_rgba(0,255,0,0.3)] font-black';
                      } else if (evalStatus === 'present') {
                        cellStyle = 'border-amber-400 bg-amber-400/20 text-amber-400 font-bold';
                      } else {
                        cellStyle = 'border-gray-700 bg-gray-900/60 text-gray-500';
                      }
                    } else if (isCurrentRow) {
                      if (isDecoding) {
                        // Effet Hacker Matrix
                        char = scrambleKey[colIdx] || Math.floor(Math.random()*10);
                        cellStyle = 'border-cyan-400 text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.4)] font-black scale-[1.02]';
                      } else {
                        char = currentGuess[colIdx] || '';
                        if (char) {
                          cellStyle = 'border-neon-green text-neon-green bg-neon-green/10 shadow-[0_0_10px_rgba(0,255,0,0.25)]';
                        } else {
                          cellStyle = 'border-gray-700 bg-[#17181c] text-gray-500';
                        }
                      }
                    }

                    return (
                      <div
                        key={colIdx}
                        className={`flex-1 h-10 flex items-center justify-center text-lg font-bold rounded-lg border transition-all ${cellStyle}`}
                      >
                        {char || '·'}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Section Indices Mathématiques */}
          <div className="bg-[#17181c] p-3 rounded-2xl mb-3 border border-gray-800/80 shadow-inner relative z-10">
            <h2 className="text-[10px] font-bold text-gray-400 mb-1.5 flex items-center gap-1 tracking-wider uppercase">
              <Terminal size={12} className={laserStatus === 'decoding' ? 'text-cyan-400' : 'text-neon-green'} /> 
              INDICES ({revealedClues.length}/{allClues.length})
            </h2>
            <ul className="space-y-1 text-xs text-gray-300">
              {revealedClues.map((clue, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-neon-green text-[10px] mt-0.5">●</span>
                  <span className="leading-tight text-gray-200">{clue}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Clavier ou Panneau de Victoire / Défaite */}
          {gameStatus !== 'playing' ? (
            <div className="p-3 rounded-2xl border mb-1 text-center bg-[#17181c] border-gray-800 relative z-10">
              {gameStatus === 'won' ? (
                <div className="text-neon-green flex flex-col items-center gap-0.5">
                  <Award size={28} />
                  <p className="font-bold tracking-wide text-sm">ACCÈS CONFIRMÉ !</p>
                  <p className="text-[11px] text-gray-300">Résolu en {attempts.length} coup(s).</p>
                </div>
              ) : (
                <div className="text-red-400 flex flex-col items-center gap-0.5">
                  <AlertTriangle size={28} />
                  <p className="font-bold tracking-wide text-sm">ÉCHEC DÉCODAGE</p>
                  <p className="text-[11px] text-gray-300">
                    Le code était : <span className="text-neon-green font-bold tracking-widest">{secretCode}</span>
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={handleShare}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs uppercase"
                >
                  <Share2 size={13} /> {copied ? 'Copié !' : 'Partager'}
                </button>
                <button
                  onClick={() => initGame(mode, difficultyKey)}
                  className="flex-1 py-2 bg-neon-green text-black font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-neon-green/90 active:scale-95 transition-all text-xs uppercase"
                >
                  <RotateCcw size={13} /> {mode === 'daily' ? 'Recommencer' : 'Nouveau'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 relative z-10">
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num.toString())}
                    disabled={isDecoding}
                    className="bg-[#1b1c22] hover:bg-[#252730] active:scale-95 text-white py-2.5 rounded-xl text-lg font-semibold border border-gray-800/80 transition-all shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleDelete}
                  disabled={isDecoding}
                  className="bg-[#1b1c22] hover:bg-red-950/40 active:scale-95 text-red-400 flex items-center justify-center rounded-xl border border-gray-800/80 transition-all"
                >
                  <Delete size={18} />
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  disabled={isDecoding}
                  className="bg-[#1b1c22] hover:bg-[#252730] active:scale-95 text-white py-2.5 rounded-xl text-lg font-semibold border border-gray-800/80 transition-all"
                >
                  0
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isDecoding}
                  className="bg-cyan-500/10 hover:bg-cyan-500/20 active:scale-95 text-cyan-400 border border-cyan-500/40 flex items-center justify-center rounded-xl font-bold gap-1 text-xs uppercase transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                >
                  <Check size={18} />
                </button>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isDecoding}
                className="w-full py-2.5 bg-neon-green/20 hover:bg-neon-green/30 active:scale-98 text-neon-green border border-neon-green/60 rounded-xl font-bold flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase transition-all shadow-[0_0_14px_rgba(0,255,0,0.2)] disabled:opacity-50"
              >
                {isDecoding ? 'Décodage...' : 'Déchiffrer le code'}
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}