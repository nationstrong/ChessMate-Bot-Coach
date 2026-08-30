(function(root,factory){
  const Rules=typeof module==='object'&&module.exports?require('./chess-rules.js'):root.ChessMateRules;
  const Coach=typeof module==='object'&&module.exports?require('./coach.js'):root.ChessMateCoach;
  const api=factory(Rules,Coach);if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessMateMidgame=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules,Coach){
  'use strict';
  const NAME={p:'兵',n:'马',b:'象',r:'车',q:'后',k:'王'};
  function kingZone(state,color){
    const k=Rules.findKing(state,color);if(k<0)return[];const f=k%8,r=Math.floor(k/8),out=[k];
    for(let df=-1;df<=1;df++)for(let dr=-1;dr<=1;dr++){if(!df&&!dr)continue;const nf=f+df,nr=r+dr;if(nf>=0&&nf<8&&nr>=0&&nr<8)out.push(nr*8+nf);}return out;
  }
  function attackPressure(state,attacker,defender){
    const zone=new Set(kingZone(state,defender));let pieces=0,hits=0,invasion=0;
    for(let i=0;i<64;i++){
      const p=state.board[i];if(!p||Rules.colorOf(p)!==attacker)continue;
      const a=Coach.attacksFrom(state,i);const zh=a.filter(x=>zone.has(x)).length;if(zh){pieces++;hits+=zh;}
      const rank=Math.floor(i/8);if((attacker==='w'&&rank>=4)||(attacker==='b'&&rank<=3))invasion++;
    }
    return{pieces,hits,invasion};
  }
  function countThreatened(state,color){
    const enemy=Rules.opposite(color);let n=0,high=0;
    for(let i=0;i<64;i++){const p=state.board[i];if(!p||Rules.colorOf(p)!==color||Rules.typeOf(p)==='k')continue;if(Coach.attackers(state,i,enemy).length){n++;if(['q','r'].includes(Rules.typeOf(p)))high++;}}
    return{n,high};
  }
  function movedBackward(move,color){const fr=Math.floor(move.from/8),to=Math.floor(move.to/8);return color==='w'?to<fr:to>fr;}
  function moveFeatures(record,bot,player){
    const f={attack:0,defense:0,check:0,capture:0,kingPressure:0,invasion:0,retreat:0,castle:0,escaped:0,relieved:0};
    if(!record?.move||Rules.colorOf(record.move.piece)!==bot)return f;
    const before=record.before,after=record.after,move=record.move,san=record.san||Rules.moveToSan(before,move);
    if(Rules.inCheck(before,bot)){f.defense+=2.8;f.relieved++;}
    if(/[+#]/.test(san)){f.attack+=3.2;f.check++;}
    if(move.captured){f.attack+=1.15;f.capture++;if(['q','r'].includes(Rules.typeOf(move.captured)))f.attack+=.8;}
    if(move.flags.includes('k')||move.flags.includes('q')){f.defense+=1.7;f.castle++;}
    const beforeP=attackPressure(before,bot,player),afterP=attackPressure(after,bot,player);
    const deltaHits=afterP.hits-beforeP.hits,deltaPieces=afterP.pieces-beforeP.pieces,deltaInv=afterP.invasion-beforeP.invasion;
    if(deltaHits>0){f.attack+=Math.min(2,deltaHits*.55);f.kingPressure+=deltaHits;}
    if(deltaPieces>0)f.attack+=Math.min(1.5,deltaPieces*.75);
    if(deltaInv>0){f.attack+=Math.min(1.2,deltaInv*.45);f.invasion+=deltaInv;}
    const beforeThreat=countThreatened(before,player),afterThreat=countThreatened(after,player);
    if(afterThreat.n>beforeThreat.n)f.attack+=Math.min(1.4,(afterThreat.n-beforeThreat.n)*.45);
    if(afterThreat.high>beforeThreat.high)f.attack+=.8;
    const wasAttacked=Coach.attackers(before,move.from,player).length>0,nowAttacked=Coach.attackers(after,move.to,player).length>0;
    if(wasAttacked&&!nowAttacked){f.defense+=1.2;f.escaped++;}
    if(movedBackward(move,bot)&&!move.captured&&!/[+#]/.test(san)){f.defense+=.55;f.retreat++;}
    const looseBefore=Coach.unprotectedPieces?Coach.unprotectedPieces(before,bot):[];
    const looseAfter=Coach.unprotectedPieces?Coach.unprotectedPieces(after,bot):[];
    if(looseAfter.length<looseBefore.length){f.defense+=Math.min(1.4,(looseBefore.length-looseAfter.length)*.55);f.relieved++;}
    return f;
  }
  function assess(history,state,playerColor){
    const bot=Rules.opposite(playerColor),botRecords=(history||[]).filter(r=>r?.move&&Rules.colorOf(r.move.piece)===bot),recent=botRecords.slice(-6);
    if(!state||!recent.length)return{type:'observing',label:'观察中',confidence:0,evidence:['还没有足够的 Bot 走棋样本。'],advice:'先按基本原则下：保证王安全、完成出子、不要留下悬空子。',sampleSize:0};
    const total={attack:0,defense:0,check:0,capture:0,kingPressure:0,invasion:0,retreat:0,castle:0,escaped:0,relieved:0};
    recent.forEach(r=>{const f=moveFeatures(r,bot,playerColor);for(const k of Object.keys(total))total[k]+=f[k]||0;});
    const pos=attackPressure(state,bot,playerColor);total.attack+=Math.min(2.4,pos.hits*.22+pos.pieces*.35+pos.invasion*.12);
    const botLoose=Coach.unprotectedPieces?Coach.unprotectedPieces(state,bot):[];const playerThreat=countThreatened(state,playerColor);
    if(botLoose.length===0&&playerThreat.n===0)total.defense+=.35;
    const margin=total.attack-total.defense;let type='balanced';
    if(total.attack>=3.2&&margin>=1.35)type='attacker';else if(total.defense>=2.6&&margin<=-1.05)type='defender';
    const sampleFactor=Math.min(1,recent.length/4),marginAbs=Math.abs(margin),confidence=Math.round(Math.min(91,42+sampleFactor*22+Math.min(24,marginAbs*6)));
    const evidence=[];
    if(total.check&&type!=='defender')evidence.push(`最近 ${recent.length} 个 Bot 回合里有 ${total.check} 次将军，说明它在使用强制手段争取主动。`);
    if(total.kingPressure>=2&&type!=='defender')evidence.push(`它最近明显增加了你王周围格子的攻击次数，正在把子力向王翼/王区集中。`);
    if(total.invasion>=2&&type!=='defender')evidence.push(`有多枚子进入你的半场，空间和前进方向都更偏向进攻。`);
    if(total.capture>=2&&type!=='defender')evidence.push(`最近频繁发生主动吃子或交换，局面正在被它强制具体化。`);
    if(total.castle&&type!=='attacker')evidence.push(`它优先完成了王车易位，先把自己的王安顿好再展开计划。`);
    if(total.escaped+total.relieved>=2&&type!=='attacker')evidence.push(`它多次把受攻击的子撤离或补强防守，最近的选择偏向化解你的威胁。`);
    if(total.retreat>=2&&type!=='attacker')evidence.push(`它最近出现多次后撤/回防型走法，而不是继续向你的阵地推进。`);
    if(!evidence.length)evidence.push('目前强制手、王区压力和回防动作都不突出，风格还比较均衡。');
    let label,advice;
    if(type==='attacker'){
      label='进攻倾向';
      advice='先守后攻：优先保证王安全，找出它最活跃的攻击子并争取交换；不要为了“也进攻”而打开自己王前的线路。等它的攻势被换掉或逼退后，再利用它前压后留下的空格反击。';
    }else if(type==='defender'){
      label='防守 / 反击倾向';
      advice='不要急着一波冲死。先找它最难保护的弱点、落后发展的子和悬空子；改善自己最差的棋子，再用兵突破打开一条线。最好制造第二个弱点，让它不能只守一个点。';
    }else{
      label='均衡 / 尚未定型';
      advice='暂时不要给它贴死标签。继续完成出子、控制中心并观察它接下来 2–3 个回合，是继续压王还是转为回防。';
    }
    if(recent.length<3){label='观察中 · '+label;advice='样本还少。'+advice;}
    return{type,label,confidence,evidence:evidence.slice(0,3),advice,sampleSize:recent.length,scores:{attack:+total.attack.toFixed(2),defense:+total.defense.toFixed(2)}};
  }
  return{assess,moveFeatures,attackPressure,kingZone};
});
