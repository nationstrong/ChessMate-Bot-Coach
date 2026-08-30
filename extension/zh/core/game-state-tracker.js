(function(root, factory) {
  const Rules = typeof module === 'object' && module.exports ? require('./chess-rules.js') : root.ChessMateRules;
  const api = factory(Rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessMateTracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Rules) {
  'use strict';
  class GameStateTracker {
    constructor(opts={}){this.state=null;this.rootState=null;this.history=[];this.syncError=null;this.onMove=opts.onMove||(()=>{});this.onError=opts.onError||(()=>{});}
    reset(){this.state=null;this.rootState=null;this.history=[];this.syncError=null;}
    setInitialState(s){this.state=s;this.rootState=s;this.history=[];this.syncError=null;}
    initFromFen(fen){
      try{const s=Rules.parseFen(fen);this.setInitialState(s);return{ok:true,state:s};}
      catch(e){return this.fail('无效的起始 FEN：'+e.message);}
    }
    initFromObserved(board,hints={}){
      const valid=Rules.validateBoard(board);if(!valid.ok)return this.fail(valid.reason);
      if(hints.fen){
        let s;try{s=Rules.parseFen(hints.fen);}catch{return this.fail('页面提供的 FEN 无效。');}
        if(hints.moves&&Array.isArray(hints.moves)){
          for(const uci of hints.moves){const m=Rules.uciToMove(s,uci);if(!m)return this.fail('无法重放页面提供的走棋记录。');s=Rules.applyMove(s,m);}
        }
        if(Rules.placementKey(s.board)!==Rules.placementKey(board))return this.fail('页面 FEN/走棋记录与当前可见棋盘不一致。');
        this.setInitialState(s);return{ok:true,state:s,source:'page-history'};
      }
      const start=Rules.inferStateFromStartPlacement(board);if(start){this.setInitialState(start);return{ok:true,state:start,source:'start-position'};}
      return this.fail('ChessMate 在对局已经开始后才打开，并且没有可信的走棋记录或 FEN 可用于重建局面。请重新开始机器人对局，然后点击“重置 / 重新同步”。');
    }
    historicalMatch(observed){
      if(!this.rootState||!this.history.length)return null;
      const candidates=[{state:this.rootState,len:0}];
      for(let i=0;i<this.history.length;i++)candidates.push({state:this.history[i].after,len:i+1});
      for(let i=candidates.length-2;i>=0;i--){if(Rules.placementKey(candidates[i].state.board)===observed)return candidates[i];}
      return null;
    }
    rewind(match){
      const oldLen=this.history.length,removed=this.history.slice(match.len);this.history=this.history.slice(0,match.len);this.state=match.state;this.syncError=null;
      return{ok:true,changed:true,rewound:true,rewindCount:oldLen-match.len,removed,state:this.state,records:[]};
    }
    observe(board){
      if(!this.state)return this.fail('局面追踪器尚未同步。');
      const valid=Rules.validateBoard(board);if(!valid.ok)return this.fail(valid.reason);
      const observed=Rules.placementKey(board),current=Rules.placementKey(this.state.board);
      if(observed===current){this.syncError=null;return{ok:true,changed:false,records:[]};}
      // Takebacks are common in Chess.com bot practice. Rewind only to an exact position
      // that ChessMate itself previously verified, never to a guessed arbitrary state.
      const old=this.historicalMatch(observed);if(old)return this.rewind(old);
      const paths=[];
      for(const move of Rules.legalMoves(this.state)){
        const next=Rules.applyMove(this.state,move);if(Rules.placementKey(next.board)===observed)paths.push([{move,next}]);
      }
      // Bots can answer before the debounced observer catches the user's move. Recover only
      // a unique two-ply path. We intentionally refuse three-ply guessing.
      if(paths.length===0){
        for(const move1 of Rules.legalMoves(this.state)){
          const state1=Rules.applyMove(this.state,move1);
          for(const move2 of Rules.legalMoves(state1)){
            const state2=Rules.applyMove(state1,move2);
            if(Rules.placementKey(state2.board)===observed)paths.push([{move:move1,next:state1},{move:move2,next:state2}]);
            if(paths.length>1)break;
          }
          if(paths.length>1)break;
        }
      }
      if(paths.length!==1)return this.fail(paths.length===0?'可见棋盘变化无法由已同步局面的悔棋记录或最多两步合法走棋产生。':'可见棋盘变化存在多个合法解释，无法安全确定走棋。');
      const records=[];
      for(const step of paths[0]){
        const before=this.state,move=step.move,next=step.next,san=Rules.moveToSan(before,move),uci=Rules.moveToUci(move);this.state=next;this.syncError=null;
        const record={before,after:next,move,san,uci,ply:this.history.length+1};this.history.push(record);records.push(record);this.onMove(record);
      }
      return{ok:true,changed:true,record:records[records.length-1],records};
    }
    fail(reason){this.syncError=reason;const r={ok:false,error:reason};this.onError(r);return r;}
  }
  return{GameStateTracker};
});
