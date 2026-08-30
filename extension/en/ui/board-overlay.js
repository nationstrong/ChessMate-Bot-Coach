(function(root,factory){
  const Rules=typeof module==='object'&&module.exports?require('../core/chess-rules.js'):root.ChessMateRules;
  const Coach=typeof module==='object'&&module.exports?require('../core/coach.js'):root.ChessMateCoach;
  const api=factory(Rules,Coach);if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessMateBoardOverlay=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules,Coach){
  'use strict';
  const VALUE={p:1,n:3,b:3,r:5,q:9,k:100};

  function squarePoint(square,flipped=false){
    const i=typeof square==='number'?square:Rules.sqToIndex(square);if(i<0)return null;
    const file=i%8,rank=Math.floor(i/8),col=flipped?7-file:file,row=flipped?rank:7-rank;
    return{x:col*100+50,y:row*100+50,col,row};
  }

  function destinationSafety(next,to,playerColor){
    const enemy=Rules.opposite(playerColor),attacked=Rules.isSquareAttacked(next,to,enemy);
    if(!attacked)return{status:'safe',attacked:false,defended:false,attackers:[],defenders:[]};
    const attackers=Coach.attackers(next,to,enemy),defenders=Coach.attackers(next,to,playerColor);
    return{status:defenders.length?'defended':'danger',attacked:true,defended:defenders.length>0,attackers,defenders};
  }

  function legalDestinations(state,from,playerColor){
    const idx=typeof from==='number'?from:Rules.sqToIndex(from);if(idx<0||!state?.board?.[idx])return[];
    if(state.turn!==playerColor||Rules.colorOf(state.board[idx])!==playerColor)return[];
    const bySquare=new Map();
    for(const move of Rules.legalMoves(state).filter(m=>m.from===idx)){
      const next=Rules.applyMove(state,move),safety=destinationSafety(next,move.to,playerColor),key=Rules.indexToSq(move.to),old=bySquare.get(key);
      // Promotion variants share a destination. Keep the most cautious classification.
      const rank={safe:0,defended:1,danger:2},status=old&&rank[old.status]>rank[safety.status]?old.status:safety.status;
      bySquare.set(key,{square:key,to:move.to,status,danger:status==='danger',defended:status==='defended',capture:!!move.captured||move.flags.includes('e'),promotions:[...(old?.promotions||[]),...(move.promotion?[move.promotion]:[])]});
    }
    return[...bySquare.values()];
  }

  function threatArrows(state,playerColor,max=3){
    const enemy=Rules.opposite(playerColor),items=[];
    for(let target=0;target<64;target++){
      const p=state.board[target];if(!p||Rules.colorOf(p)!==playerColor)continue;
      const attackers=Coach.attackers(state,target,enemy);if(!attackers.length)continue;
      const defenders=Coach.attackers(state,target,playerColor),type=Rules.typeOf(p),defended=defenders.length>0;
      const priority=(type==='k'?1000:VALUE[type]*100)+(defended?0:55)+(Rules.inCheck(state,playerColor)&&type==='k'?500:0);
      const sorted=attackers.slice().sort((a,b)=>VALUE[Rules.typeOf(state.board[a])]-VALUE[Rules.typeOf(state.board[b])]);
      items.push({from:sorted[0],to:target,fromSq:Rules.indexToSq(sorted[0]),toSq:Rules.indexToSq(target),piece:p,attacker:state.board[sorted[0]],priority,loose:!defended,defended,status:defended?'defended':'danger',defenders});
    }
    return items.sort((a,b)=>b.priority-a.priority).slice(0,max);
  }

  function targetHighlights(state,playerColor,max=4){
    return Coach.opponentTargets(state,playerColor,max).map(x=>({square:x.square,status:x.status,free:x.free,note:x.note,piece:x.piece,bestCapture:x.bestCapture||null}));
  }

  function recommendationArrows(state,options,max=3){
    if(!state)return[];const out=[];
    for(const [i,opt] of (options||[]).slice(0,max).entries()){
      const uci=opt?.uci||opt?.move;if(!uci)continue;const move=Rules.uciToMove(state,uci);if(!move)continue;
      out.push({rank:i+1,from:move.from,to:move.to,fromSq:Rules.indexToSq(move.from),toSq:Rules.indexToSq(move.to),uci,san:opt.san||Rules.moveToSan(state,move),targetKind:opt.targetKind||''});
    }
    return out;
  }

  class BoardOverlay{
    constructor(){this.board=null;this.host=null;this.squareLayer=null;this.svg=null;this.threats=[];this.legals=[];this.targets=[];this.suggestions=[];this.ro=null;this.boundPosition=()=>this.position();}
    mount(board){
      if(this.host)this.destroy();this.board=board;if(!board)return this;
      const host=document.createElement('div');host.id='chessmate-board-overlay';
      Object.assign(host.style,{position:'fixed',pointerEvents:'none',zIndex:'2147482500',left:'0',top:'0',width:'0',height:'0',overflow:'visible'});
      host.innerHTML=`<style>
#chessmate-board-overlay .cm-squares{position:absolute;inset:0;pointer-events:none}.cm-square{position:absolute;width:12.5%;height:12.5%;box-sizing:border-box;pointer-events:none}
.cm-threat-danger{background:rgba(218,58,58,.20);box-shadow:inset 0 0 0 2px rgba(190,34,34,.74);animation:cm-threat-flash .38s ease-in-out 0s 4 alternate}
.cm-threat-defended{background:rgba(222,166,35,.20);box-shadow:inset 0 0 0 2px rgba(187,130,20,.76);animation:cm-threat-flash .38s ease-in-out 0s 4 alternate}
.cm-legal-safe{background:rgba(65,160,86,.25);box-shadow:inset 0 0 0 2px rgba(43,132,64,.70)}
.cm-legal-defended{background:rgba(228,178,45,.28);box-shadow:inset 0 0 0 2px rgba(190,135,23,.80)}
.cm-legal-danger{background:rgba(226,63,63,.28);box-shadow:inset 0 0 0 2px rgba(190,34,34,.82)}
.cm-target{z-index:3;border-radius:2px}.cm-target-free{box-shadow:inset 0 0 0 3px rgba(44,126,207,.92)}.cm-target-loose{box-shadow:inset 0 0 0 2px rgba(67,126,184,.72)}.cm-target:before{content:'';position:absolute;right:5%;top:5%;width:10%;height:10%;min-width:5px;min-height:5px;border-radius:50%;background:rgba(44,126,207,.95);box-shadow:0 0 0 1px rgba(255,255,255,.65)}
.cm-legal-capture:after{content:'';position:absolute;inset:20%;border:3px solid rgba(255,255,255,.80);border-radius:50%}.cm-arrow{filter:drop-shadow(0 1px 1px rgba(0,0,0,.30))}.cm-suggest-arrow{filter:drop-shadow(0 1px 1px rgba(0,0,0,.26))}.cm-suggest-num{font:700 17px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#fff;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:rgba(0,0,0,.16);stroke-width:1px}
@keyframes cm-threat-flash{from{opacity:.45}to{opacity:1}}@media(prefers-reduced-motion:reduce){.cm-threat-danger,.cm-threat-defended{animation:none}}
</style><div class="cm-squares"></div><svg viewBox="0 0 800 800" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"><defs>
<marker id="cm-arrowhead-red" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3.5 L0,7 z" fill="rgba(201,36,36,.88)"></path></marker>
<marker id="cm-arrowhead-yellow" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3.5 L0,7 z" fill="rgba(202,145,24,.92)"></path></marker>
<marker id="cm-arrowhead-suggest" markerWidth="7" markerHeight="7" refX="5.7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="rgba(38,129,106,.90)"></path></marker>
</defs><g class="cm-arrows"></g></svg>`;
      document.documentElement.appendChild(host);this.host=host;this.squareLayer=host.querySelector('.cm-squares');this.svg=host.querySelector('.cm-arrows');
      addEventListener('scroll',this.boundPosition,true);addEventListener('resize',this.boundPosition,true);
      if(globalThis.ResizeObserver){this.ro=new ResizeObserver(this.boundPosition);this.ro.observe(board);}this.position();this.render();return this;
    }
    destroy(){if(this.ro)this.ro.disconnect();this.ro=null;removeEventListener('scroll',this.boundPosition,true);removeEventListener('resize',this.boundPosition,true);this.host?.remove();this.host=null;this.board=null;this.threats=[];this.legals=[];this.targets=[];this.suggestions=[];}
    setBoard(board){if(board!==this.board)this.mount(board);return this;}
    isFlipped(){const b=this.board;if(!b)return false;const orient=(b.getAttribute?.('data-orientation')||b.getAttribute?.('data-player-color')||'').toLowerCase();return orient==='black'||b.classList?.contains('flipped');}
    position(){if(!this.host||!this.board)return;const r=this.board.getBoundingClientRect();Object.assign(this.host.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',display:(r.width>80&&r.height>80)?'block':'none'});}
    showThreats(state,playerColor){this.threats=threatArrows(state,playerColor,3);this.render();return this.threats;}
    clearThreats(){this.threats=[];this.render();}
    showLegalMoves(state,from,playerColor){this.legals=legalDestinations(state,from,playerColor);this.render();return this.legals;}
    clearLegal(){this.legals=[];this.render();}
    showOpponentTargets(state,playerColor){this.targets=targetHighlights(state,playerColor,4);this.render();return this.targets;}
    clearTargets(){this.targets=[];this.render();}
    showSuggestions(state,options){this.suggestions=recommendationArrows(state,options,3);this.render();return this.suggestions;}
    clearSuggestions(){this.suggestions=[];this.render();}
    clearAll(){this.threats=[];this.legals=[];this.targets=[];this.suggestions=[];this.render();}
    squareStyle(sq){const p=squarePoint(sq,this.isFlipped());return`left:${p.col*12.5}%;top:${p.row*12.5}%`;}
    render(){
      if(!this.host)return;this.position();
      const threatBySq=new Map();for(const x of this.threats){const old=threatBySq.get(x.toSq);if(!old||old.status==='defended'&&x.status==='danger')threatBySq.set(x.toSq,x);}
      this.squareLayer.innerHTML=[...threatBySq.values()].map(x=>`<div class="cm-square ${x.status==='defended'?'cm-threat-defended':'cm-threat-danger'}" style="${this.squareStyle(x.toSq)}"></div>`).join('')+
        this.targets.map(x=>`<div class="cm-square cm-target ${x.free?'cm-target-free':'cm-target-loose'}" style="${this.squareStyle(x.square)}"></div>`).join('')+
        this.legals.map(x=>`<div class="cm-square ${x.status==='safe'?'cm-legal-safe':x.status==='defended'?'cm-legal-defended':'cm-legal-danger'} ${x.capture?'cm-legal-capture':''}" style="${this.squareStyle(x.square)}"></div>`).join('');
      const flip=this.isFlipped();
      const threatSvg=this.threats.map(x=>{const a=squarePoint(x.fromSq,flip),b=squarePoint(x.toSq,flip),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,trim=24,ex=b.x-dx/len*trim,ey=b.y-dy/len*trim;const yellow=x.status==='defended';return`<line class="cm-arrow" x1="${a.x}" y1="${a.y}" x2="${ex}" y2="${ey}" stroke="${yellow?'rgba(202,145,24,.88)':'rgba(201,36,36,.84)'}" stroke-width="6" stroke-linecap="round" marker-end="url(#${yellow?'cm-arrowhead-yellow':'cm-arrowhead-red'})"/>`;}).join('');
      const suggestSvg=this.suggestions.map(x=>{const a=squarePoint(x.fromSq,flip),b=squarePoint(x.toSq,flip),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,startTrim=22,endTrim=27,sx=a.x+dx/len*startTrim,sy=a.y+dy/len*startTrim,ex=b.x-dx/len*endTrim,ey=b.y-dy/len*endTrim;const lx=a.x+dx*.72,ly=a.y+dy*.72;return`<g class="cm-suggest"><line class="cm-suggest-arrow" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="rgba(38,129,106,.86)" stroke-width="4" stroke-linecap="round" marker-end="url(#cm-arrowhead-suggest)"/><circle cx="${lx}" cy="${ly}" r="13" fill="rgba(31,105,88,.94)" stroke="rgba(255,255,255,.90)" stroke-width="2"/><text class="cm-suggest-num" x="${lx}" y="${ly+1}">${x.rank}</text></g>`;}).join('');
      this.svg.innerHTML=threatSvg+suggestSvg;
    }
  }
  return{BoardOverlay,squarePoint,destinationSafety,legalDestinations,threatArrows,targetHighlights,recommendationArrows};
});
