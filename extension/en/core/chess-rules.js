(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessMateRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const FILES = 'abcdefgh';
  const RANKS = '12345678';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const KNIGHT = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
  const KING = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  const BISHOP = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const ROOK = [[1,0],[-1,0],[0,1],[0,-1]];

  function sqToIndex(sq) {
    if (!/^[a-h][1-8]$/.test(sq)) return -1;
    return (Number(sq[1]) - 1) * 8 + FILES.indexOf(sq[0]);
  }
  function indexToSq(i) {
    if (i < 0 || i > 63) return null;
    return FILES[i % 8] + (Math.floor(i / 8) + 1);
  }
  function fileOf(i) { return i % 8; }
  function rankOf(i) { return Math.floor(i / 8); }
  function colorOf(piece) { return piece === piece.toUpperCase() ? 'w' : 'b'; }
  function typeOf(piece) { return piece.toLowerCase(); }
  function sameColor(a,b) { return a && b && colorOf(a) === colorOf(b); }
  function opposite(color) { return color === 'w' ? 'b' : 'w'; }

  function cloneState(s) {
    return {
      board: s.board.slice(), turn: s.turn, castling: s.castling,
      ep: s.ep, halfmove: s.halfmove, fullmove: s.fullmove
    };
  }

  function parseFen(fen) {
    const parts = String(fen || '').trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Invalid FEN');
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Invalid FEN board');
    const board = Array(64).fill(null);
    for (let fenRank = 0; fenRank < 8; fenRank++) {
      let file = 0;
      for (const ch of rows[fenRank]) {
        if (/\d/.test(ch)) file += Number(ch);
        else {
          if (!/[prnbqkPRNBQK]/.test(ch) || file > 7) throw new Error('Invalid FEN piece');
          const rank = 7 - fenRank;
          board[rank * 8 + file] = ch;
          file++;
        }
      }
      if (file !== 8) throw new Error('Invalid FEN rank');
    }
    const turn = parts[1];
    if (turn !== 'w' && turn !== 'b') throw new Error('Invalid turn');
    const castling = parts[2] === '-' ? '' : parts[2];
    const ep = parts[3] === '-' ? null : sqToIndex(parts[3]);
    return {
      board, turn, castling, ep,
      halfmove: Number(parts[4] || 0), fullmove: Number(parts[5] || 1)
    };
  }

  function boardToFenBoard(board) {
    const out = [];
    for (let r = 7; r >= 0; r--) {
      let row = '', empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = board[r * 8 + f];
        if (!p) empty++;
        else {
          if (empty) { row += empty; empty = 0; }
          row += p;
        }
      }
      if (empty) row += empty;
      out.push(row);
    }
    return out.join('/');
  }

  function toFen(s) {
    return [boardToFenBoard(s.board), s.turn, s.castling || '-', s.ep == null ? '-' : indexToSq(s.ep), s.halfmove, s.fullmove].join(' ');
  }

  function placementKey(board) { return boardToFenBoard(board); }

  function findKing(s, color) {
    const k = color === 'w' ? 'K' : 'k';
    return s.board.indexOf(k);
  }

  function isSquareAttacked(s, target, byColor) {
    const tf = fileOf(target), tr = rankOf(target);
    // Pawns
    const pawn = byColor === 'w' ? 'P' : 'p';
    const pawnSourceRank = tr + (byColor === 'w' ? -1 : 1);
    for (const df of [-1,1]) {
      const f = tf + df;
      if (f >= 0 && f < 8 && pawnSourceRank >= 0 && pawnSourceRank < 8) {
        if (s.board[pawnSourceRank * 8 + f] === pawn) return true;
      }
    }
    // Knights
    const knight = byColor === 'w' ? 'N' : 'n';
    for (const [df,dr] of KNIGHT) {
      const f=tf+df,r=tr+dr;
      if (f>=0&&f<8&&r>=0&&r<8&&s.board[r*8+f]===knight) return true;
    }
    // King
    const king = byColor === 'w' ? 'K' : 'k';
    for (const [df,dr] of KING) {
      const f=tf+df,r=tr+dr;
      if (f>=0&&f<8&&r>=0&&r<8&&s.board[r*8+f]===king) return true;
    }
    // Sliders
    for (const [df,dr] of BISHOP) {
      let f=tf+df,r=tr+dr;
      while(f>=0&&f<8&&r>=0&&r<8){
        const p=s.board[r*8+f];
        if(p){ if(colorOf(p)===byColor && ['b','q'].includes(typeOf(p))) return true; break; }
        f+=df;r+=dr;
      }
    }
    for (const [df,dr] of ROOK) {
      let f=tf+df,r=tr+dr;
      while(f>=0&&f<8&&r>=0&&r<8){
        const p=s.board[r*8+f];
        if(p){ if(colorOf(p)===byColor && ['r','q'].includes(typeOf(p))) return true; break; }
        f+=df;r+=dr;
      }
    }
    return false;
  }

  function inCheck(s, color) {
    const king = findKing(s, color);
    if (king < 0) return true;
    return isSquareAttacked(s, king, opposite(color));
  }

  function pushMove(list, s, from, to, flags, promotion) {
    const piece = s.board[from];
    const captured = flags && flags.includes('e') ? (colorOf(piece)==='w'?'p':'P') : s.board[to];
    list.push({from,to,piece,captured:captured||null,promotion:promotion||null,flags:flags||''});
  }

  function pseudoMoves(s) {
    const list=[];
    const us=s.turn;
    for(let from=0;from<64;from++){
      const p=s.board[from]; if(!p||colorOf(p)!==us) continue;
      const t=typeOf(p), ff=fileOf(from), fr=rankOf(from);
      if(t==='p'){
        const dir=us==='w'?1:-1, start=us==='w'?1:6, promo=us==='w'?7:0;
        const oneRank=fr+dir;
        if(oneRank>=0&&oneRank<8){
          const one=oneRank*8+ff;
          if(!s.board[one]){
            if(oneRank===promo) for(const pr of ['q','r','b','n']) pushMove(list,s,from,one,'p',pr);
            else pushMove(list,s,from,one,'');
            if(fr===start){ const two=(fr+2*dir)*8+ff; if(!s.board[two]) pushMove(list,s,from,two,'b'); }
          }
          for(const df of [-1,1]){
            const f=ff+df; if(f<0||f>7) continue;
            const to=oneRank*8+f;
            const dest=s.board[to];
            if(dest && colorOf(dest)!==us){
              if(oneRank===promo) for(const pr of ['q','r','b','n']) pushMove(list,s,from,to,'cp',pr);
              else pushMove(list,s,from,to,'c');
            } else if(s.ep===to) pushMove(list,s,from,to,'e');
          }
        }
      } else if(t==='n' || t==='k'){
        const dirs=t==='n'?KNIGHT:KING;
        for(const [df,dr] of dirs){
          const f=ff+df,r=fr+dr; if(f<0||f>7||r<0||r>7) continue;
          const to=r*8+f,d=s.board[to]; if(!d)pushMove(list,s,from,to,''); else if(colorOf(d)!==us)pushMove(list,s,from,to,'c');
        }
        if(t==='k') addCastles(s,list,from,us);
      } else {
        const dirs=t==='b'?BISHOP:t==='r'?ROOK:BISHOP.concat(ROOK);
        for(const [df,dr] of dirs){
          let f=ff+df,r=fr+dr;
          while(f>=0&&f<8&&r>=0&&r<8){
            const to=r*8+f,d=s.board[to];
            if(!d) pushMove(list,s,from,to,'');
            else { if(colorOf(d)!==us) pushMove(list,s,from,to,'c'); break; }
            f+=df;r+=dr;
          }
        }
      }
    }
    return list;
  }

  function addCastles(s,list,from,color){
    const rank=color==='w'?0:7, kingStart=rank*8+4;
    if(from!==kingStart || inCheck(s,color)) return;
    const enemy=opposite(color);
    const K=color==='w'?'K':'k', Q=color==='w'?'Q':'q';
    if(s.castling.includes(K)){
      const f=rank*8+5,g=rank*8+6,rook=rank*8+7;
      if(!s.board[f]&&!s.board[g]&&s.board[rook]===(color==='w'?'R':'r') && !isSquareAttacked(s,f,enemy)&&!isSquareAttacked(s,g,enemy)) pushMove(list,s,from,g,'k');
    }
    if(s.castling.includes(Q)){
      const d=rank*8+3,c=rank*8+2,b=rank*8+1,rook=rank*8;
      if(!s.board[d]&&!s.board[c]&&!s.board[b]&&s.board[rook]===(color==='w'?'R':'r') && !isSquareAttacked(s,d,enemy)&&!isSquareAttacked(s,c,enemy)) pushMove(list,s,from,c,'q');
    }
  }

  function applyMove(s, move) {
    const n=cloneState(s), p=n.board[move.from], us=colorOf(p), t=typeOf(p);
    n.board[move.from]=null;
    if(move.flags.includes('e')){
      const cap=move.to+(us==='w'?-8:8); n.board[cap]=null;
    }
    n.board[move.to]=move.promotion ? (us==='w'?move.promotion.toUpperCase():move.promotion.toLowerCase()) : p;
    if(move.flags.includes('k')){
      const rank=us==='w'?0:7; n.board[rank*8+7]=null; n.board[rank*8+5]=us==='w'?'R':'r';
    }
    if(move.flags.includes('q')){
      const rank=us==='w'?0:7; n.board[rank*8]=null; n.board[rank*8+3]=us==='w'?'R':'r';
    }
    // Castling rights
    let c=n.castling;
    if(t==='k') c=c.replace(us==='w'?/[KQ]/g:/[kq]/g,'');
    const rightsBySquare={0:'Q',7:'K',56:'q',63:'k'};
    if(rightsBySquare[move.from]) c=c.replace(rightsBySquare[move.from],'');
    if(rightsBySquare[move.to]) c=c.replace(rightsBySquare[move.to],'');
    n.castling=c;
    n.ep=null;
    if(t==='p' && Math.abs(move.to-move.from)===16) n.ep=(move.to+move.from)/2;
    n.halfmove=(t==='p'||move.captured)?0:(n.halfmove+1);
    if(us==='b') n.fullmove++;
    n.turn=opposite(us);
    return n;
  }

  function legalMoves(s) {
    const us=s.turn;
    return pseudoMoves(s).filter(m=>!inCheck(applyMove(s,m),us));
  }

  function moveToUci(m) { return indexToSq(m.from)+indexToSq(m.to)+(m.promotion||''); }
  function uciToMove(s, uci) {
    const m=String(uci||'').trim().match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
    if(!m) return null;
    const from=sqToIndex(m[1]),to=sqToIndex(m[2]),pr=m[3]?m[3].toLowerCase():null;
    return legalMoves(s).find(x=>x.from===from&&x.to===to&&(x.promotion||null)===pr)||null;
  }

  function moveToSan(s, move) {
    if(move.flags.includes('k')) return suffixCheck(s,move,'O-O');
    if(move.flags.includes('q')) return suffixCheck(s,move,'O-O-O');
    const t=typeOf(move.piece), capture=!!move.captured || move.flags.includes('e');
    let san='';
    if(t!=='p'){
      san=t.toUpperCase();
      const siblings=legalMoves(s).filter(m=>m.from!==move.from && typeOf(m.piece)===t && m.to===move.to);
      if(siblings.length){
        const sameFile=siblings.some(m=>fileOf(m.from)===fileOf(move.from));
        const sameRank=siblings.some(m=>rankOf(m.from)===rankOf(move.from));
        if(!sameFile) san+=FILES[fileOf(move.from)];
        else if(!sameRank) san+=RANKS[rankOf(move.from)];
        else san+=indexToSq(move.from);
      }
    } else if(capture) san+=FILES[fileOf(move.from)];
    if(capture) san+='x';
    san+=indexToSq(move.to);
    if(move.promotion) san+='='+move.promotion.toUpperCase();
    return suffixCheck(s,move,san);
  }
  function suffixCheck(s,move,san){
    const n=applyMove(s,move);
    if(inCheck(n,n.turn)) san+=legalMoves(n).length?'#'.replace('#','+'):'#';
    return san;
  }

  function validateBoard(board){
    if(!Array.isArray(board)||board.length!==64) return {ok:false,reason:'Board must contain 64 squares.'};
    const pieces=board.filter(Boolean);
    if(pieces.some(p=>!/[prnbqkPRNBQK]/.test(p))) return {ok:false,reason:'Unknown piece code.'};
    if(pieces.filter(p=>p==='K').length!==1||pieces.filter(p=>p==='k').length!==1) return {ok:false,reason:'Board must contain exactly one king per side.'};
    if(pieces.length<2||pieces.length>32) return {ok:false,reason:'Unexpected piece count.'};
    return {ok:true};
  }

  function inferStateFromStartPlacement(board) {
    const start=parseFen(START_FEN);
    return placementKey(start.board)===placementKey(board)?start:null;
  }

  function pieceAt(s,sq){return s.board[sqToIndex(sq)];}
  function attackedBy(s,sq,color){return isSquareAttacked(s,sqToIndex(sq),color);}

  return {
    START_FEN, FILES, parseFen, toFen, boardToFenBoard, placementKey, validateBoard,
    sqToIndex,indexToSq,colorOf,typeOf,opposite,cloneState,legalMoves,applyMove,
    moveToUci,uciToMove,moveToSan,inCheck,isSquareAttacked,findKing,inferStateFromStartPlacement,pieceAt,attackedBy
  };
});
