(function(root,factory){
  const Rules=typeof module==='object'&&module.exports?require('../core/chess-rules.js'):root.ChessMateRules;
  const api=factory(Rules);if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessMateChessCom=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Rules){
  'use strict';
  // All Chess.com-specific selectors and safety signals live in this adapter.
  const BOARD_SELECTORS=['wc-chess-board','chess-board','.board-layout-chessboard .board','[data-board-id]'];
  const PIECE_SELECTORS=['.piece[class*="square-"]','[data-piece][data-square]','[data-piece-code][data-square]'];
  const POSITIVE_TEXT=[/\bPlay Bots\b/i,/\bBot Chat\b/i,/\bcomputer opponent\b/i,/\bplay computer\b/i,/\bcomputer game\b/i,/\bChallenge a bot\b/i];
  const POSITIVE_ATTR_SELECTORS=['[data-bot-id]','[data-opponent-type="bot"]','[data-player-type="computer"]','[data-cy*="bot" i]','[data-testid*="bot" i]'];
  const HUMAN_BLOCK_TEXT=[/\bLive Chess\b/i,/\bRated\b.*\bgame\b/i,/\bDraw Offer\b/i];
  const LOCALES=new Set(['en','es','fr','de','ru','pt','it','pl','tr','zh','zh-tw','ja','ko','nl','cs','sv','da','no','fi','ro','hu','uk','vi','id']);

  function pathParts(url){try{return new URL(url).pathname.split('/').filter(Boolean).map(x=>x.toLowerCase());}catch{return[];}}
  function isAllowedUrl(url=location.href){
    let u;try{u=new URL(url);}catch{return false;}if(u.protocol!=='https:'||!/(^|\.)chess\.com$/i.test(u.hostname)||u.hostname.toLowerCase()!=='www.chess.com')return false;
    const p=pathParts(url);if(p[0]==='play'&&p[1]==='computer')return true;
    if(LOCALES.has(p[0])&&p[1]==='play'&&p[2]==='computer')return true;
    // Chess.com also uses explicit /game/computer/<id> URLs for computer games.
    // This remains fail-closed because /game/live and /play/online are separately blocked,
    // and positive Bot/Computer page signals are still required below.
    if(p[0]==='game'&&p[1]==='computer')return true;
    if(LOCALES.has(p[0])&&p[1]==='game'&&p[2]==='computer')return true;
    return false;
  }
  function isKnownHumanUrl(url=location.href){
    const p=pathParts(url);if(!p.length)return false;const off=LOCALES.has(p[0])?1:0;
    return (p[off]==='play'&&p[off+1]==='online')||(p[off]==='game'&&p[off+1]==='live')||(p[off]==='live');
  }
  function rootsFor(node){const out=[node];if(node&&node.shadowRoot)out.push(node.shadowRoot);return out;}
  function allRoots(base=document){const queue=[base],seen=new Set(),out=[];while(queue.length){const r=queue.shift();if(!r||seen.has(r))continue;seen.add(r);out.push(r);let els=[];try{els=r.querySelectorAll('*');}catch{}for(const el of els)if(el.shadowRoot)queue.push(el.shadowRoot);}return out;}
  function queryDeep(selectors,base=document){for(const r of allRoots(base))for(const s of selectors){try{const n=r.querySelector(s);if(n)return n;}catch{}}return null;}
  function anyDeep(selector,base=document){return!!queryDeep([selector],base);}
  function findBoard(){return queryDeep(BOARD_SELECTORS);}
  function pieceNodes(board){
    const out=[],seen=new Set();for(const root of rootsFor(board))for(const sel of PIECE_SELECTORS){let nodes=[];try{nodes=root.querySelectorAll(sel);}catch{}for(const n of nodes)if(!seen.has(n)){seen.add(n);out.push(n);}}return out;
  }
  function classPiece(node){const classes=[...node.classList],code=classes.find(c=>/^[wb][prnbqk]$/.test(c));if(!code)return null;return code[0]==='w'?code[1].toUpperCase():code[1];}
  function attrPiece(node){
    const raw=(node.getAttribute('data-piece')||node.getAttribute('data-piece-code')||'').trim();
    if(/^[wb][prnbqk]$/i.test(raw)){const c=raw[0].toLowerCase(),t=raw[1].toLowerCase();return c==='w'?t.toUpperCase():t;}
    if(/^[prnbqkPRNBQK]$/.test(raw))return raw;
    const words=raw.toLowerCase().match(/(white|black)[-_ ]?(pawn|rook|knight|bishop|queen|king)/);if(words){const map={pawn:'p',rook:'r',knight:'n',bishop:'b',queen:'q',king:'k'},p=map[words[2]];return words[1]==='white'?p.toUpperCase():p;}return null;
  }
  function nodeSquare(node){
    const attr=node.getAttribute('data-square');if(attr&&/^[a-h][1-8]$/i.test(attr))return attr.toLowerCase();
    const cls=[...node.classList].find(c=>/^square-[1-8][1-8]$/.test(c));if(cls){const m=cls.match(/square-([1-8])([1-8])/);return Rules.FILES[Number(m[1])-1]+m[2];}
    const file=node.getAttribute('data-file'),rank=node.getAttribute('data-rank');if(file&&rank&&/^[a-h]$/i.test(file)&&/^[1-8]$/.test(rank))return file.toLowerCase()+rank;return null;
  }
  function readBoard(board=findBoard()){
    if(!board)return{ok:false,error:'没有检测到受支持的 Chess.com 棋盘元素。'};
    const arr=Array(64).fill(null),duplicates=[];let parsed=0;
    for(const node of pieceNodes(board)){const piece=classPiece(node)||attrPiece(node),sq=nodeSquare(node);if(!piece||!sq)continue;const i=Rules.sqToIndex(sq);if(arr[i])duplicates.push(sq);arr[i]=piece;parsed++;}
    if(duplicates.length)return{ok:false,error:'以下格子检测到多个棋子：'+duplicates.join(', ')+'.'};
    const valid=Rules.validateBoard(arr);if(!valid.ok)return{ok:false,error:`已匹配棋盘元素，但局面不完整：${valid.reason}`,board:arr,pieceCount:parsed};
    return{ok:true,board:arr,pieceCount:parsed,element:board};
  }
  function textSample(){return(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,50000);}
  function matchingText(regexes,text){return regexes.filter(r=>r.test(text)).map(r=>r.source);}
  function diagnostics(){
    const urlOk=isAllowedUrl(),knownHumanUrl=isKnownHumanUrl(),board=findBoard(),read=board?readBoard(board):null,text=textSample();
    const positiveAttrs=POSITIVE_ATTR_SELECTORS.filter(s=>anyDeep(s)),positiveText=matchingText(POSITIVE_TEXT,text),humanText=matchingText(HUMAN_BLOCK_TEXT,text);
    return{href:location.href,pathname:location.pathname,urlAllowed:urlOk,knownHumanUrl,boardSelector:board?BOARD_SELECTORS.find(s=>{try{return board.matches(s);}catch{return false;}})||board.tagName.toLowerCase():null,pieceCount:read?.pieceCount||0,boardValid:!!read?.ok,positiveText,positiveAttrs,humanText,flipped:!!board?.classList?.contains('flipped')};
  }
  function confirmBotMode(){
    const d=diagnostics();
    if(d.knownHumanUrl)return{allowed:false,hard:true,code:'human-url',reason:'检测到明确的真人对局网址，因此教练功能已关闭。',diagnostics:d};
    if(!d.urlAllowed)return{allowed:false,hard:false,code:'url',reason:`当前路径 ${d.pathname||'/'} 不在 ChessMate 明确允许的机器人/电脑对局列表中。`,diagnostics:d};
    if(d.humanText.length&&!d.positiveText.length&&!d.positiveAttrs.length)return{allowed:false,hard:true,code:'human-signal',reason:'检测到真人对局信号，因此教练功能已关闭。',diagnostics:d};
    if(!d.boardValid)return{allowed:false,hard:false,code:'board',reason:'Chess.com 正在重绘棋盘，暂时没有检测到完整且受支持的棋盘。',diagnostics:d};
    if(!d.positiveText.length&&!d.positiveAttrs.length)return{allowed:false,hard:false,code:'bot-signal',reason:'暂时无法明确确认对手是机器人/电脑。',diagnostics:d};
    return{allowed:true,hard:false,code:'ok',reason:'已确认 Chess.com 机器人/电脑对局网址和页面信号。',diagnostics:d};
  }
  function getPlayerColor(setting='auto'){
    if(setting==='white')return'w';if(setting==='black')return'b';const board=findBoard();
    const explicit=board?.getAttribute('data-player-color')||document.querySelector('[data-player-color]')?.getAttribute('data-player-color');if(explicit&&/^white$/i.test(explicit))return'w';if(explicit&&/^black$/i.test(explicit))return'b';return board?.classList?.contains('flipped')?'b':'w';
  }
  function getTrustedStartHints(){
    const u=new URL(location.href),fen=u.searchParams.get('fen'),raw=u.searchParams.get('moves')||u.searchParams.get('moveList'),moves=raw?raw.split(/[,_\s-]+/).filter(x=>/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(x)):null;return fen?{fen,moves}:{};
  }
  function eventPieceInfo(event){const path=typeof event?.composedPath==='function'?event.composedPath():[event?.target];for(const node of path||[]){if(!node||!node.getAttribute||!node.classList)continue;const piece=classPiece(node)||attrPiece(node),square=nodeSquare(node);if(piece&&square)return{node,piece,square};}return null;}
  function bindPieceInteractions(board,handlers={}){
    const roots=rootsFor(board),clean=[],down=e=>{const info=eventPieceInfo(e);if(info)handlers.onPick?.(info,e);},up=e=>handlers.onRelease?.(e);
    for(const r of roots){if(!r?.addEventListener)continue;r.addEventListener('pointerdown',down,true);r.addEventListener('pointerup',up,true);r.addEventListener('pointercancel',up,true);clean.push(()=>{r.removeEventListener('pointerdown',down,true);r.removeEventListener('pointerup',up,true);r.removeEventListener('pointercancel',up,true);});}return()=>clean.forEach(fn=>fn());
  }
  function observe(board,callback){const observers=[],add=root=>{if(!root)return;const o=new MutationObserver(callback);o.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-square','data-piece','data-piece-code']});observers.push(o);};add(board);if(board.shadowRoot)add(board.shadowRoot);return()=>observers.forEach(o=>o.disconnect());}
  return{BOARD_SELECTORS,PIECE_SELECTORS,isAllowedUrl,isKnownHumanUrl,findBoard,readBoard,diagnostics,confirmBotMode,getPlayerColor,getTrustedStartHints,observe,nodeSquare,classPiece,attrPiece,eventPieceInfo,bindPieceInteractions};
});
