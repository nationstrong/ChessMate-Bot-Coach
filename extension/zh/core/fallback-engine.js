(function(root,factory){
 const Rules=typeof module==='object'&&module.exports?require('./chess-rules.js'):root.ChessMateRules;
 const api=factory(Rules);if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessMateFallbackEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(R){
 'use strict';
 const V={p:100,n:320,b:330,r:500,q:900,k:0};
 const CENTER=['d4','e4','d5','e5'].map(R.sqToIndex);
 function evaluate(s,perspective){
   let score=0;
   for(let i=0;i<64;i++){const p=s.board[i];if(!p)continue;const sign=R.colorOf(p)===perspective?1:-1;score+=sign*V[R.typeOf(p)];if(CENTER.includes(i))score+=sign*12;}
   if(R.inCheck(s,R.opposite(perspective)))score+=25;if(R.inCheck(s,perspective))score-=25;
   return score;
 }
 function terminal(s,perspective,ply){const moves=R.legalMoves(s);if(moves.length)return null;if(R.inCheck(s,s.turn))return s.turn===perspective?-100000+ply:100000-ply;return 0;}
 function negamax(s,depth,alpha,beta,perspective,ply=0){
   const term=terminal(s,perspective,ply);if(term!==null)return term;if(depth<=0)return evaluate(s,perspective);
   const maximizing=s.turn===perspective;let best=maximizing?-Infinity:Infinity;
   let moves=R.legalMoves(s);moves.sort((a,b)=>(b.captured?V[R.typeOf(b.captured)]:0)-(a.captured?V[R.typeOf(a.captured)]:0));
   if(moves.length>28&&depth>2)moves=moves.slice(0,28);
   for(const m of moves){const v=negamax(R.applyMove(s,m),depth-1,alpha,beta,perspective,ply+1);if(maximizing){best=Math.max(best,v);alpha=Math.max(alpha,best);}else{best=Math.min(best,v);beta=Math.min(beta,best);}if(beta<=alpha)break;}
   return best;
 }
 function analyzeFen(fen,options={}){
   const s=R.parseFen(fen),perspective=s.turn,depth=Math.max(1,Math.min(4,Math.floor((options.depth||10)/5)+1));
   const start=performance?.now?.()||Date.now(),limit=Math.max(40,Math.min(1500,options.movetime||300));
   const scored=[];for(const m of R.legalMoves(s)){
     if(((performance?.now?.()||Date.now())-start)>limit&&scored.length>=3)break;
     const n=R.applyMove(s,m),score=negamax(n,Math.max(0,depth-1),-Infinity,Infinity,perspective,1);scored.push({move:R.moveToUci(m),score});
   }
   scored.sort((a,b)=>b.score-a.score);return{ok:true,engine:'fallback',lines:scored.slice(0,Math.max(1,Math.min(3,options.multiPv||3))).map((x,i)=>({rank:i+1,depth,score:{type:'cp',value:x.score},pv:[x.move],move:x.move})),warning:'未安装 Stockfish WASM 本地资源，当前使用随扩展打包的轻量级备用评估器。'};
 }
 return{analyzeFen,evaluate};
});
