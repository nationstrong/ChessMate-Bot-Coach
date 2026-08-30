(function(root, factory) {
  const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; else root.ChessMateUci=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function parseInfo(line){
    if(!/^info\s/.test(line)) return null;
    const depth=Number((line.match(/\bdepth (\d+)/)||[])[1]||0);
    const multipv=Number((line.match(/\bmultipv (\d+)/)||[])[1]||1);
    const cpMatch=line.match(/\bscore cp (-?\d+)/), mateMatch=line.match(/\bscore mate (-?\d+)/);
    const pvMatch=line.match(/\bpv\s+(.+)$/);
    if(!pvMatch) return null;
    return {depth,multipv,score:mateMatch?{type:'mate',value:Number(mateMatch[1])}:cpMatch?{type:'cp',value:Number(cpMatch[1])}:null,pv:pvMatch[1].trim().split(/\s+/)};
  }
  function parseBestmove(line){ const m=line.match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/); return m?{bestmove:m[1],ponder:m[2]||null}:null; }
  class MultiPvAccumulator{
    constructor(){this.byPv=new Map();this.bestmove=null;}
    push(line){
      const info=parseInfo(line); if(info&&info.score&&info.pv.length){ const old=this.byPv.get(info.multipv); if(!old||info.depth>=old.depth)this.byPv.set(info.multipv,info); }
      const best=parseBestmove(line); if(best)this.bestmove=best.bestmove;
    }
    result(){ return [...this.byPv.values()].sort((a,b)=>a.multipv-b.multipv).slice(0,3).map(x=>({rank:x.multipv,depth:x.depth,score:x.score,pv:x.pv,move:x.pv[0]})); }
  }
  function scoreForPlayer(score, sideToMove, playerColor){
    if(!score) return null;
    let value=score.value; if(sideToMove!==playerColor)value=-value;
    return {...score,value};
  }
  function scoreToWdl(score, sideToMove, playerColor){
    const normalized=scoreForPlayer(score,sideToMove,playerColor);
    if(!normalized)return null;
    if(normalized.type==='mate'){
      if(normalized.value>0)return{win:99,draw:1,loss:0,cp:null,label:`M${Math.abs(normalized.value)}`};
      if(normalized.value<0)return{win:0,draw:1,loss:99,cp:null,label:`-M${Math.abs(normalized.value)}`};
      return{win:5,draw:90,loss:5,cp:null,label:'M0'};
    }
    const cp=Math.max(-2000,Math.min(2000,Number(normalized.value||0)));
    const expected=1/(1+Math.exp(-cp/250));
    const draw=0.50*Math.exp(-Math.abs(cp)/450);
    let win=Math.max(0,Math.min(1,expected-draw/2));
    let loss=Math.max(0,Math.min(1,1-win-draw));
    let d=Math.max(0,Math.min(1,draw));
    const total=win+d+loss||1;win/=total;d/=total;loss/=total;
    let wi=Math.round(win*100),di=Math.round(d*100),li=100-wi-di;
    if(li<0){di=Math.max(0,di+li);li=0;}
    return{win:wi,draw:di,loss:li,cp,label:(cp>=0?'+':'')+(cp/100).toFixed(2)};
  }
  return {parseInfo,parseBestmove,MultiPvAccumulator,scoreForPlayer,scoreToWdl};
});
