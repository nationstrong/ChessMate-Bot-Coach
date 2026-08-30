'use strict';
let worker=null,readyPromise=null,chain=Promise.resolve(),active=null,vendorChecked=false,vendorAvailable=false;
async function hasVendor(){
 if(vendorChecked)return vendorAvailable;vendorChecked=true;
 try{const [js,wasm]=await Promise.all([fetch(chrome.runtime.getURL('vendor/stockfish-18-lite-single.js'),{method:'HEAD'}),fetch(chrome.runtime.getURL('vendor/stockfish-18-lite-single.wasm'),{method:'HEAD'})]);vendorAvailable=js.ok&&wasm.ok;}catch{vendorAvailable=false;}return vendorAvailable;
}
function disposeWorker(){try{worker?.terminate();}catch{}worker=null;readyPromise=null;}
function cancelSearch(reason='分析已取消。'){
 try{worker?.postMessage('stop');}catch{}
 if(active){const done=active;active=null;done.resolve({ok:false,cancelled:true,error:reason,lines:[]});}
}
function ensureWorker(){
 if(worker)return readyPromise;
 worker=new Worker(chrome.runtime.getURL('vendor/stockfish-18-lite-single.js'));
 let resolveReady,rejectReady;readyPromise=new Promise((res,rej)=>{resolveReady=res;rejectReady=rej;});
 const timer=setTimeout(()=>{disposeWorker();rejectReady(new Error('Stockfish 未能完成 UCI 初始化。'));},9000);
 worker.onmessage=e=>{const text=String(e.data||'');for(const line of text.split(/\r?\n/).filter(Boolean)){if(line==='uciok'){worker?.postMessage('isready');}else if(line==='readyok'){clearTimeout(timer);resolveReady(true);}if(active){active.acc.push(line);if(/^bestmove\s/.test(line)){const done=active;active=null;done.resolve({ok:true,engine:'stockfish-18-lite-single',lines:done.acc.result(),bestmove:done.acc.bestmove});}}}};
 worker.onerror=e=>{clearTimeout(timer);const err=new Error(e.message||'Stockfish 工作线程错误');if(active){const done=active;active=null;done.reject(err);}disposeWorker();rejectReady(err);};
 worker.postMessage('uci');return readyPromise;
}
async function analyzeStockfish(fen,options={}){
 await ensureWorker();
 return new Promise((resolve,reject)=>{const acc=new ChessMateUci.MultiPvAccumulator();active={resolve,reject,acc};worker.postMessage('stop');worker.postMessage('setoption name MultiPV value '+Math.max(1,Math.min(3,Number(options.multiPv||3))));worker.postMessage('position fen '+fen);const movetime=Math.max(50,Math.min(5000,Number(options.movetime||700))),depth=Math.max(1,Math.min(30,Number(options.depth||14)));worker.postMessage(`go movetime ${movetime} depth ${depth}`);});
}
async function analyze(fen,options={}){
 if(await hasVendor()){
   try{return await analyzeStockfish(fen,options);}catch(e){
     // A crashed/failed worker must not poison the rest of the game. Recreate it once.
     cancelSearch('Stockfish 正在自动重启。');disposeWorker();
     try{return await analyzeStockfish(fen,options);}catch(e2){disposeWorker();const fb=await ChessMateFallbackEngine.analyzeFen(fen,options);return{...fb,recoveredFrom:String(e2?.message||e2)};}
   }
 }
 return ChessMateFallbackEngine.analyzeFen(fen,options);
}
function stop(){cancelSearch('分析已终止。');disposeWorker();}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
 if(msg?.type==='CHESSMATE_OFFSCREEN_ANALYZE'){chain=chain.catch(()=>{}).then(()=>analyze(msg.fen,msg.options));chain.then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));return true;}
 if(msg?.type==='CHESSMATE_OFFSCREEN_CANCEL'){cancelSearch();sendResponse({ok:true});return false;}
 if(msg?.type==='CHESSMATE_OFFSCREEN_STOP'){stop();sendResponse({ok:true});return false;}
});
