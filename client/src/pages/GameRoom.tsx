import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import type { Card as CardType, Color } from '../store/gameStore';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

function UnoCard({ card, onClick, isPlayable, customInitial, isInDiscardPile }: { card: CardType, onClick?: () => void, isPlayable?: boolean, customInitial?: any, isInDiscardPile?: boolean }) {
  const bgColorClass = card.color === 'Red' ? 'bg-red-500' :
                       card.color === 'Blue' ? 'bg-blue-500' :
                       card.color === 'Green' ? 'bg-green-500' :
                       card.color === 'Yellow' ? 'bg-yellow-400' :
                       'bg-gray-800'; // Wild cards

  return (
    <motion.div
      layoutId={card.id}
      initial={customInitial || { scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1, 
        y: 0, 
        x: 0, 
        rotate: isInDiscardPile ? (parseInt(card.id, 36) % 20 - 10) : 0 
      }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={isPlayable ? { y: -20, scale: 1.1, zIndex: 50 } : {}}
      onClick={isPlayable && onClick ? onClick : undefined}
      className={`w-24 h-36 rounded-lg shadow-md border-4 border-white flex flex-col justify-between p-2 ${isPlayable ? 'cursor-pointer' : 'cursor-default'} ${bgColorClass} relative overflow-hidden shrink-0`}
      style={{ zIndex: isInDiscardPile ? 0 : 1 }}
    >
      <div className="text-white font-bold text-lg leading-none">{card.value}</div>
      <div className="absolute inset-2 border-2 border-white rounded-full flex items-center justify-center opacity-30 transform -rotate-12">
         <span className="text-white font-bold text-4xl transform rotate-12">UNO</span>
      </div>
      <div className="text-white font-bold text-lg leading-none self-end transform rotate-180">{card.value}</div>
      {!isPlayable && !isInDiscardPile && onClick && (
        <div className="absolute inset-0 bg-black/20" />
      )}
    </motion.div>
  );
}

function HiddenCard({ customInitial, layoutId }: { customInitial?: any, layoutId?: string }) {
  return (
    <motion.div 
      layoutId={layoutId}
      initial={customInitial || { scale: 1, opacity: 1 }}
      animate={{ scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="w-16 h-24 rounded-lg shadow-md border-2 border-white bg-red-600 flex items-center justify-center relative overflow-hidden shrink-0"
    >
      <div className="absolute inset-1 border border-yellow-400 rounded-full flex items-center justify-center transform -rotate-12">
         <span className="text-yellow-400 font-bold text-xl transform rotate-12">UNO</span>
      </div>
    </motion.div>
  );
}

export default function GameRoom() {
  const navigate = useNavigate();
  const { gameState, playCard, drawCard, callUno, leaveLobby, lastUnoCall } = useGameStore();
  const { user } = useAuthStore();
  const [showColorPicker, setShowColorPicker] = useState<CardType | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animation anchor: The Draw Pile center
  const drawPileInitial = { x: -150, y: 0, scale: 0.5, opacity: 0 };

  useEffect(() => {
    if (!gameState) {
      navigate('/');
    }
  }, [gameState, navigate]);

  useEffect(() => {
    if (lastUnoCall) {
      setToastMessage(`${lastUnoCall.playerName} called UNO!`);
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [lastUnoCall]);

  if (!gameState || !user) return null;

  const me = gameState.players.find(p => p.id === user.id);
  const opponents = gameState.players.filter(p => p.id !== user.id);
  
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === user.id && (me?.hand.length ?? 0) > 0;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  const handlePlayCard = (card: CardType) => {
    if (!isMyTurn) return;
    
    if (card.value === 'Wild' || card.value === 'Wild Draw Four') {
      setShowColorPicker(card);
    } else {
      playCard(gameState.id, card.id);
    }
  };

  const handleColorPick = (color: Color) => {
    if (showColorPicker) {
      playCard(gameState.id, showColorPicker.id, color);
      setShowColorPicker(null);
    }
  };

  const isValidMove = (card: CardType) => {
    if (!isMyTurn) return false;
    if (gameState.stackCount > 0) {
      if (topCard.value === 'Draw Two' && card.value === 'Draw Two') return true;
      if (topCard.value === 'Wild Draw Four' && card.value === 'Wild Draw Four') return true;
      return false;
    }
    if (card.value === 'Wild' || card.value === 'Wild Draw Four') return true;
    if (card.color === gameState.activeColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  return (
    <LayoutGroup>
      <div className="min-h-screen bg-green-800 p-8 flex flex-col relative overflow-hidden">
        {/* Leave Button */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to leave the game? You will forfeit.")) {
                leaveLobby(gameState.id);
                navigate('/');
              }
            }}
            className="flex items-center gap-2 bg-black/30 hover:bg-red-600 text-white px-4 py-2 rounded-full transition font-bold"
          >
            <ArrowLeft size={18} /> Leave Game
          </button>
        </div>

        {/* Opponents Top */}
        <div className="flex justify-around items-start h-40">
          {opponents.map(op => {
            const finishedIndex = gameState.winners.indexOf(op.id);
            const isFinished = finishedIndex !== -1;
            return (
            <div key={op.id} className="flex flex-col items-center">
              <div className={`px-4 py-2 rounded-full mb-2 ${gameState.players[gameState.turnIndex]?.id === op.id ? 'bg-yellow-400 font-bold text-black' : 'bg-white/20 text-white'}`}>
                {op.name} {op.isUno && <span className="text-red-500 ml-2 font-bold animate-pulse">UNO!</span>}
                {isFinished && <span className="text-yellow-300 ml-2 font-black">#{finishedIndex + 1}</span>}
              </div>
              {!isFinished && (
                <>
                  <div className="flex -space-x-8">
                    <AnimatePresence mode='popLayout'>
                      {op.hand.map((c) => (
                        <HiddenCard 
                          key={c.id}
                          layoutId={c.id} 
                          customInitial={{ ...drawPileInitial, y: 200 }} 
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="text-white mt-2 font-bold">{op.hand.length} cards</div>
                </>
              )}
              {isFinished && (
                 <div className="text-white mt-4 font-bold italic opacity-70">Finished</div>
              )}
            </div>
          )})}
        </div>

        {/* Table Center */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="flex gap-12 items-center bg-black/20 p-12 rounded-full z-0">
            {/* Draw Pile */}
            <div className="relative cursor-pointer hover:scale-105 transition" onClick={() => isMyTurn && drawCard(gameState.id)}>
               {gameState.drawPile.length > 0 ? (
                  <>
                    <div className="absolute top-1 left-1 pointer-events-none"><HiddenCard /></div>
                    <div className="absolute top-0.5 left-0.5 pointer-events-none"><HiddenCard /></div>
                    <HiddenCard />
                  </>
               ) : (
                  <div className="w-16 h-24 border-2 border-dashed border-white/50 rounded-lg flex items-center justify-center text-white/50 text-sm">Empty</div>
               )}
            </div>

            {/* Active Color Indicator */}
            <div className="absolute top-4 w-12 h-12 rounded-full border-4 border-white" style={{
              backgroundColor: gameState.activeColor === 'Red' ? '#ef4444' : 
                               gameState.activeColor === 'Blue' ? '#3b82f6' : 
                               gameState.activeColor === 'Green' ? '#22c55e' : '#facc15'
            }} />

            {/* Discard Pile */}
            <div className="relative w-24 h-36 flex items-center justify-center">
               <AnimatePresence mode='popLayout'>
                 {topCard && (
                   <UnoCard 
                     key={topCard.id} 
                     card={topCard} 
                     isInDiscardPile={true}
                   />
                 )}
               </AnimatePresence>
            </div>
          </div>

          {/* Direction Indicator */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
            <div className={`w-96 h-96 border-[12px] border-white rounded-full border-t-transparent animate-spin`} style={{ animationDirection: gameState.direction === 1 ? 'normal' : 'reverse', animationDuration: '4s' }} />
          </div>
        </div>

        {/* Current Player Bottom */}
        <div className="flex flex-col items-center z-10">
           <div className="flex justify-between w-full max-w-4xl mb-4 items-end">
              <div className={`px-6 py-3 rounded-full text-xl ${isMyTurn ? 'bg-yellow-400 text-black font-bold shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'bg-black/50 text-white'}`}>
                {me && gameState.winners.includes(me.id) ? `Finished #${gameState.winners.indexOf(me.id) + 1}!` : isMyTurn ? "Your Turn!" : "Waiting..."}
              </div>
              
              <button 
                onClick={() => callUno(gameState.id)}
                disabled={!me || me.hand.length > 2 || me.isUno || gameState.winners.includes(me.id)}
                className="bg-red-600 text-white font-black text-2xl px-8 py-4 rounded-full border-4 border-white hover:bg-red-700 hover:scale-105 transition disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(220,38,38,0.6)]"
              >
                UNO!
              </button>
           </div>

           <div className="flex gap-2 justify-center flex-wrap max-w-5xl px-12">
              <AnimatePresence mode='popLayout'>
                {me?.hand.map(card => (
                  <UnoCard 
                    key={card.id} 
                    card={card} 
                    isPlayable={isValidMove(card)} 
                    onClick={() => handlePlayCard(card)} 
                    customInitial={{ ...drawPileInitial, y: -300 }}
                  />
                ))}
              </AnimatePresence>
           </div>
        </div>

        {/* Color Picker Modal */}
        {showColorPicker && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl flex flex-col items-center gap-6">
              <h2 className="text-2xl font-bold">Choose a Color</h2>
              <div className="grid grid-cols-2 gap-4">
                 {(['Red', 'Blue', 'Green', 'Yellow'] as Color[]).map(color => (
                   <button
                     key={color}
                     onClick={() => handleColorPick(color)}
                     className={`w-24 h-24 rounded-lg shadow-inner flex items-center justify-center text-white font-bold text-xl hover:scale-110 transition ${
                       color === 'Red' ? 'bg-red-500' : color === 'Blue' ? 'bg-blue-500' : color === 'Green' ? 'bg-green-500' : 'bg-yellow-400'
                     }`}
                   >
                     {color}
                   </button>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Finished Overlay */}
        {gameState.status === 'finished' && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="bg-white p-12 rounded-2xl flex flex-col items-center gap-6 max-w-lg w-full">
              <h2 className="text-4xl font-black text-gray-800 mb-4">Game Over!</h2>
              <div className="w-full space-y-3">
                {gameState.winners.map((winnerId, index) => {
                  const p = gameState.players.find(p => p.id === winnerId);
                  return (
                    <div key={winnerId} className={`flex items-center justify-between p-4 rounded-lg font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400' : 'bg-gray-100 text-gray-700'}`}>
                      <span className="text-xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''} {p?.name}
                      </span>
                      <span className="opacity-50">Place {index + 1}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  leaveLobby(gameState.id);
                  navigate('/');
                }}
                className="mt-6 bg-red-600 text-white font-bold text-xl px-8 py-4 rounded-full w-full hover:bg-red-700 transition"
              >
                Back to Lobby Browser
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 flex items-center gap-3"
            >
              <span className="text-yellow-400 text-2xl">⚠️</span> {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

