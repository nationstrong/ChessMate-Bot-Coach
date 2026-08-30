(function(root,factory){
  const Rules=typeof module==='object'&&module.exports?require('./chess-rules.js'):root.ChessMateRules;
  const api=factory(Rules); if(typeof module==='object'&&module.exports)module.exports=api; else root.ChessMateCoach=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules){
  'use strict';
  const VALUE={p:1,n:3,b:3,r:5,q:9,k:100};
  const NAME={p:'兵',n:'马',b:'象',r:'车',q:'后',k:'王'};
  function attacksFrom(state,from){
    const p=state.board[from]; if(!p)return[]; const color=Rules.colorOf(p),out=[];
    // Local attack map used for tactical explanations.
    const t=Rules.typeOf(p), f=from%8, r=Math.floor(from/8);
    if(t==='p'){ const dr=color==='w'?1:-1; for(const df of[-1,1]){const nf=f+df,nr=r+dr;if(nf>=0&&nf<8&&nr>=0&&nr<8)out.push(nr*8+nf);} return out; }
    const dirs=t==='n'?[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]:t==='k'?[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]:t==='b'?[[1,1],[1,-1],[-1,1],[-1,-1]]:t==='r'?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    const sliding=['b','r','q'].includes(t);
    for(const[df,dr]of dirs){let nf=f+df,nr=r+dr;while(nf>=0&&nf<8&&nr>=0&&nr<8){const idx=nr*8+nf;out.push(idx);if(state.board[idx])break;if(!sliding)break;nf+=df;nr+=dr;}}
    return out;
  }
  function attackers(state,sq,color){ const a=[]; for(let i=0;i<64;i++){const p=state.board[i];if(p&&Rules.colorOf(p)===color&&attacksFrom(state,i).includes(sq))a.push(i);} return a; }
  function loosePieces(state,color){
    const enemy=Rules.opposite(color), out=[];
    for(let i=0;i<64;i++){const p=state.board[i];if(!p||Rules.colorOf(p)!==color||Rules.typeOf(p)==='k')continue;const atk=attackers(state,i,enemy),def=attackers(state,i,color);if(atk.length&&(!def.length||Math.min(...atk.map(x=>VALUE[Rules.typeOf(state.board[x])]))<VALUE[Rules.typeOf(p)]))out.push({sq:i,piece:p,attackers:atk,defenders:def});}
    return out.sort((a,b)=>VALUE[Rules.typeOf(b.piece)]-VALUE[Rules.typeOf(a.piece)]);
  }
  function movedPieceThreats(after,move){
    const p=after.board[move.to]; if(!p)return[]; const color=Rules.colorOf(p),enemy=Rules.opposite(color);
    return attacksFrom(after,move.to).filter(i=>after.board[i]&&Rules.colorOf(after.board[i])===enemy&&Rules.typeOf(after.board[i])!=='p').map(i=>({sq:i,piece:after.board[i]})).sort((a,b)=>VALUE[Rules.typeOf(b.piece)]-VALUE[Rules.typeOf(a.piece)]);
  }
  function describeBotIdea(record,playerColor){
    const {before,after,move,san}=record, bot=Rules.opposite(playerColor), t=Rules.typeOf(move.piece), ideas=[];
    if(san.includes('+')||san.includes('#')) ideas.push('一种合理的解读是：机器人选择了强制性的将军，迫使你先回应，再继续它原本的计划。');
    if(move.captured) ideas.push(`一种可能的意图是吃掉你的${NAME[Rules.typeOf(move.captured)]}，改变子力或战术上的平衡。`);
    const threats=movedPieceThreats(after,move);
    if(threats.length) ideas.push(`刚走动的${NAME[t]}现在正在攻击你位于 ${Rules.indexToSq(threats[0].sq)} 的${NAME[Rules.typeOf(threats[0].piece)]}。`);
    if(['n','b'].includes(t) && (Math.floor(move.from/8)===(bot==='w'?0:7))) ideas.push(`从局面角度看，这也可以理解为正常出子：${NAME[t]}变得更活跃，同时改善了机器人的子力协调。`);
    if(move.flags.includes('k')||move.flags.includes('q')) ideas.push('机器人通过王车易位改善了王的安全，同时让车更接近中心。');
    if(!ideas.length) ideas.push('一种合理的解读是：机器人主要在改善子力活跃度或控制关键格，并没有立即发动强制战术。');
    return ideas.slice(0,2);
  }
  function warning(after,playerColor){
    if(Rules.inCheck(after,playerColor)) return {urgent:true,text:'你正在被将军。先解除将军，再考虑正常出子或其他计划。'};
    const loose=loosePieces(after,playerColor);
    if(loose.length){const x=loose[0];return{urgent:true,text:`你位于 ${Rules.indexToSq(x.sq)} 的${NAME[Rules.typeOf(x.piece)]}正受到压力，可能处于悬空或战术脆弱状态。`};}
    const enemy=Rules.opposite(playerColor);
    // Detect moved side threats to high-value pieces through all attackers.
    for(let i=0;i<64;i++){const p=after.board[i];if(p&&Rules.colorOf(p)===playerColor&&VALUE[Rules.typeOf(p)]>=5&&attackers(after,i,enemy).length)return{urgent:true,text:`注意你位于 ${Rules.indexToSq(i)} 的${NAME[Rules.typeOf(p)]}，它目前正在被攻击。`};}
    return {urgent:false,text:'暂时没有明显的强制威胁。如果王安全、也没有明显的悬空子，可以放心正常出子或改善子力。'};
  }
  function candidateTargetInsight(state,move,playerColor){
    if(!state||!move)return null;const enemy=Rules.opposite(playerColor),san=Rules.moveToSan(state,move),next=Rules.applyMove(state,move);
    // Normal captures onto an undefended enemy piece are the clearest practical targets.
    // En-passant is deliberately excluded here because the captured pawn is not on move.to.
    const target=state.board[move.to];
    if(target&&Rules.colorOf(target)===enemy&&move.captured){
      const defenders=attackers(state,move.to,enemy),type=Rules.typeOf(target),recapturable=Rules.isSquareAttacked(next,move.to,enemy);
      if(!defenders.length){
        if(!recapturable)return{kind:'free-capture',tag:'可吃悬空子',text:`直接吃掉对方未保护的${NAME[type]}；${san} 后落点目前没有直接回吃`};
        return{kind:'loose-capture-risk',tag:'悬空子但需计算',text:`目标${NAME[type]}本身未受保护，但 ${san} 后你的棋子仍会被攻击，不能把它当作“白捡”`};
      }
    }
    // A candidate can also create a new attack on an enemy piece that itself has no defender.
    const looseAttacks=attacksFrom(next,move.to).filter(i=>{
      const p=next.board[i];return p&&Rules.colorOf(p)===enemy&&Rules.typeOf(p)!=='k'&&attackers(next,i,enemy).length===0;
    }).sort((a,b)=>VALUE[Rules.typeOf(next.board[b])]-VALUE[Rules.typeOf(next.board[a])]);
    if(looseAttacks.length){const sq=looseAttacks[0],p=next.board[sq];return{kind:'creates-target',tag:'攻击悬空子',text:`把对方未保护的${NAME[Rules.typeOf(p)]}（${Rules.indexToSq(sq)}）变成下一步战术目标`};}
    return null;
  }
  function candidateRationale(state,move,playerColor){
    const san=Rules.moveToSan(state,move), next=Rules.applyMove(state,move), t=Rules.typeOf(move.piece), reasons=[],targetInsight=candidateTargetInsight(state,move,playerColor);
    if(Rules.inCheck(state,playerColor)) reasons.push('解除将军');
    if(targetInsight)reasons.push(targetInsight.text);
    if(move.captured&&!targetInsight){ const cap=NAME[Rules.typeOf(move.captured)]; reasons.push(`吃掉对方的${cap}`); }
    if(move.flags.includes('k')||move.flags.includes('q')) reasons.push('改善王的安全并激活一辆车');
    const homeRank=playerColor==='w'?0:7;
    if(['n','b'].includes(t)&&Math.floor(move.from/8)===homeRank) reasons.push(`出动${NAME[t]}`);
    if(san.includes('+')) reasons.push('制造强制性的将军');
    const center=['d4','e4','d5','e5'].map(Rules.sqToIndex);
    if(center.includes(move.to)||attacksFrom(next,move.to).some(x=>center.includes(x))) reasons.push('争夺或加强中心控制');
    const looseBefore=loosePieces(state,playerColor), looseAfter=loosePieces(next,playerColor);
    if(looseAfter.length<looseBefore.length) reasons.push('减轻悬空子受到的压力');
    const attacked=attacksFrom(next,move.to).filter(i=>next.board[i]&&Rules.colorOf(next.board[i])!==playerColor);
    if(attacked.length&&reasons.length<2){ const best=attacked.sort((a,b)=>VALUE[Rules.typeOf(next.board[b])]-VALUE[Rules.typeOf(next.board[a])])[0]; reasons.push(`攻击位于 ${Rules.indexToSq(best)} 的${NAME[Rules.typeOf(next.board[best])]}`); }
    if(!reasons.length) reasons.push('改善子力协调，同时保持局面的灵活性');
    return reasons.slice(0,3).join('；') + '。';
  }
  function unprotectedPieces(state,color){
    const out=[];
    for(let i=0;i<64;i++){
      const p=state.board[i];if(!p||Rules.colorOf(p)!==color||Rules.typeOf(p)==='k')continue;
      const defenders=attackers(state,i,color);if(defenders.length)continue;
      out.push({sq:i,square:Rules.indexToSq(i),piece:p,type:Rules.typeOf(p),value:VALUE[Rules.typeOf(p)],attackers:attackers(state,i,Rules.opposite(color)),defenders:[]});
    }
    return out.sort((a,b)=>b.value-a.value);
  }
  function opponentTargets(state,playerColor,max=4){
    if(!state)return[];const enemy=Rules.opposite(playerColor),legal=state.turn===playerColor?Rules.legalMoves(state):[],out=[];
    for(const x of unprotectedPieces(state,enemy)){
      const directAttackers=attackers(state,x.sq,playerColor),captures=legal.filter(m=>m.to===x.sq&&(m.captured||m.flags.includes('e'))),plans=[];
      for(const m of captures){
        const next=Rules.applyMove(state,m),recapturable=Rules.isSquareAttacked(next,m.to,enemy),supported=attackers(next,m.to,playerColor).length>0;
        plans.push({move:m,san:Rules.moveToSan(state,m),recapturable,supported,capturerValue:VALUE[Rules.typeOf(m.piece)]});
      }
      plans.sort((a,b)=>(a.recapturable-b.recapturable)||(a.capturerValue-b.capturerValue));
      const best=plans[0]||null,free=!!best&&!best.recapturable,hanging=directAttackers.length>0;
      const status=free?'free':hanging?'hanging':'loose';
      const priority=(free?1000:hanging?500:0)+x.value*30-(best?.capturerValue||0);
      let note;
      if(free)note=`可考虑 ${best.san}：吃掉这枚${NAME[x.type]}后，落点目前没有直接回吃。`;
      else if(best)note=`${best.san} 可以吃到它，但落点仍受对方攻击，先算清楚交换是否划算。`;
      else if(hanging)note=`这枚${NAME[x.type]}没有己方棋子保护，而且已经被你攻击；寻找能否增加攻击者或制造战术。`;
      else note=`这枚${NAME[x.type]}目前无人保护，但你暂时没有直接合法吃子；可以把它当作下一步施压目标。`;
      out.push({...x,status,free,hanging,bestCapture:best,note,priority});
    }
    return out.sort((a,b)=>b.priority-a.priority).slice(0,max);
  }
  function buildOptions(state,engineLines,playerColor){
    const out=[];
    for(const line of engineLines||[]){
      const m=Rules.uciToMove(state,line.move); if(!m)continue;
      const insight=candidateTargetInsight(state,m,playerColor);
      out.push({san:Rules.moveToSan(state,m),uci:line.move,rationale:candidateRationale(state,m,playerColor),targetTag:insight?.tag||'',targetKind:insight?.kind||'',score:line.score||null,depth:line.depth||null});
      if(out.length===3)break;
    }
    return out;
  }
  function summarizeChange(record){
    const {move,san}=record,t=NAME[Rules.typeOf(move.piece)];
    if(move.flags.includes('k')||move.flags.includes('q')) return `${san}：机器人完成王车易位，改善了王的安全和车的活跃度。`;
    if(move.captured) return `${san}：机器人的${t}吃掉了你的${NAME[Rules.typeOf(move.captured)]}。`;
    return `${san}：机器人把${t}从 ${Rules.indexToSq(move.from)} 走到 ${Rules.indexToSq(move.to)}。`;
  }
  function coach(record,engineLines,playerColor){return{changed:summarizeChange(record),ideas:describeBotIdea(record,playerColor),warning:warning(record.after,playerColor),options:buildOptions(record.after,engineLines,playerColor)};}
  return {coach,loosePieces,unprotectedPieces,opponentTargets,warning,candidateTargetInsight,candidateRationale,buildOptions,describeBotIdea,summarizeChange,attacksFrom,attackers};
});
