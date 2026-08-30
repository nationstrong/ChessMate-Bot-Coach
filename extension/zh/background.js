'use strict';
let creating=null;
async function ensureOffscreen(){
  if(creating)return creating;
  creating=(async()=>{try{await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['WORKERS'],justification:'Run the bundled local Stockfish WebAssembly worker for permitted bot-game analysis.'});}catch(e){if(!/single offscreen|already exists|Only a single/i.test(String(e?.message||e)))throw e;}})();
  try{await creating;}finally{creating=null;}
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type==='CHESSMATE_ANALYZE'){
    (async()=>{try{await ensureOffscreen();const r=await chrome.runtime.sendMessage({type:'CHESSMATE_OFFSCREEN_ANALYZE',fen:msg.fen,options:msg.options});sendResponse(r);}catch(e){sendResponse({ok:false,error:String(e?.message||e)});}})();return true;
  }
  if(msg?.type==='CHESSMATE_ENGINE_CANCEL'){
    // Cancel the current search but deliberately keep the offscreen document/worker warm.
    // This is used for ordinary bot-game events such as the user's next move or takeback.
    (async()=>{try{await chrome.runtime.sendMessage({type:'CHESSMATE_OFFSCREEN_CANCEL'});}catch{}sendResponse({ok:true});})();return true;
  }
  if(msg?.type==='CHESSMATE_ENGINE_STOP'){
    // Full termination is reserved for a fair-play guard failure or an explicit hard reset.
    (async()=>{try{await chrome.runtime.sendMessage({type:'CHESSMATE_OFFSCREEN_STOP'});}catch{}try{await chrome.offscreen.closeDocument();}catch{}sendResponse({ok:true});})();return true;
  }
});
