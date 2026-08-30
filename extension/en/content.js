(async function(){
  'use strict';
  if(globalThis.__CHESSMATE_BOOTED__)return;globalThis.__CHESSMATE_BOOTED__=true;
  const Rules=globalThis.ChessMateRules,Tracker=globalThis.ChessMateTracker.GameStateTracker,Coach=globalThis.ChessMateCoach,Uci=globalThis.ChessMateUci,Opening=globalThis.ChessMateOpeningBook,Midgame=globalThis.ChessMateMidgame,Site=globalThis.ChessMateChessCom,Panel=globalThis.ChessMatePanel.Panel,BoardOverlay=globalThis.ChessMateBoardOverlay.BoardOverlay;
  const PIECE_NAME={p:'兵',n:'马',b:'象',r:'车',q:'后',k:'王'};
  let panel,tracker=new Tracker(),overlay=new BoardOverlay(),stopObserve=null,stopInteractions=null,guardTimer=null,debounceTimer=null,analysisToken=0,winToken=0,active=false,paused=false,guardFailureSince=0,guardFailureCount=0,dragging=false,syncRecovering=false,syncFailureSince=0,lastOptions=[],lastOptionsKey='';
  const GUARD_INTERVAL=650,GUARD_GRACE_MS=4200,GUARD_FAILURE_LIMIT=7,SYNC_RECOVERY_NOTICE_MS=6500;
  panel=await new Panel({onReset:()=>resync(true),onSettings:(settings,key)=>onSettingChanged(settings,key),onDiagnostics:()=>refreshDiagnostics()}).mount();

  async function onSettingChanged(settings,key){
    if(key==='playerColor'){await cancelEngineSearch(true);const player=Site.getPlayerColor(settings.playerColor);refreshPositionInsights(player);if(panel.settings.boardThreats&&tracker.state?.turn===player)overlay.showThreats(tracker.state,player);else overlay.clearThreats();restoreSuggestions(tracker.state,player);if(active&&tracker.state&&!syncRecovering)updateWinRateOnly(tracker.state,player);return;}
    if(key==='boardThreats'&&!settings.boardThreats)overlay.clearThreats();
    if(key==='moveSafety'&&!settings.moveSafety)overlay.clearLegal();
    if(key==='opponentTargets')refreshTargets(Site.getPlayerColor(settings.playerColor));
    if(key==='analysisLevel'&&active&&tracker.state&&!syncRecovering)updateWinRateOnly(tracker.state,Site.getPlayerColor(settings.playerColor));
  }
  async function cancelEngineSearch(invalidate=true){if(invalidate){analysisToken++;winToken++;}try{await chrome.runtime.sendMessage({type:'CHESSMATE_ENGINE_CANCEL'});}catch{}}
  async function stopEngine(){analysisToken++;winToken++;try{await chrome.runtime.sendMessage({type:'CHESSMATE_ENGINE_STOP'});}catch{}}
  function clearBoardUi(destroy=false){overlay.clearAll();if(destroy)overlay.destroy();}
  function clearSuggestions(){lastOptions=[];lastOptionsKey='';overlay.clearSuggestions();}
  function showSuggestions(state,options){lastOptions=options||[];lastOptionsKey=state?Rules.placementKey(state.board):'';overlay.showSuggestions(state,lastOptions);}
  function restoreSuggestions(state,player){if(state&&state.turn===player&&lastOptions.length&&lastOptionsKey===Rules.placementKey(state.board))overlay.showSuggestions(state,lastOptions);else overlay.clearSuggestions();}
  function refreshDiagnostics(extra={}){panel.setDiagnostics({...Site.diagnostics(),guard:{active,paused,failureCount:guardFailureCount,dragging,syncRecovering,...extra},visualHints:{threatArrows:panel.settings.boardThreats,moveSafety:panel.settings.moveSafety,opponentTargets:panel.settings.opponentTargets},tracker:{historyLength:tracker.history.length,syncError:tracker.syncError}});}
  function cleanupBoardListeners(){stopObserve?.();stopObserve=null;stopInteractions?.();stopInteractions=null;}
  function resetGuardFailures(){guardFailureSince=0;guardFailureCount=0;}
  function resetSyncRecovery(){syncRecovering=false;syncFailureSince=0;tracker.syncError=null;}
  function updateOpening(player=Site.getPlayerColor(panel.settings.playerColor)){const opening=Opening?.identify?.(tracker.history);if(opening)panel.setOpening(opening,Opening.playerTip(opening,player));else panel.clearOpening(tracker.history.length?'未识别到常见开局':'等待走棋');}
  function updateMidgame(player=Site.getPlayerColor(panel.settings.playerColor)){if(Midgame?.assess&&tracker.state)panel.setMidgame(Midgame.assess(tracker.history,tracker.state,player));else panel.clearMidgame();}
  function refreshTargets(player=Site.getPlayerColor(panel.settings.playerColor)){
    if(!tracker.state||tracker.state.turn!==player){overlay.clearTargets();panel.clearTargets('轮到 Bot 时先不标记可吃目标，避免局面变化造成误导。');return[];}
    const targets=Coach.opponentTargets(tracker.state,player,4).map(x=>({...x,pieceName:PIECE_NAME[x.type]||'棋子'}));panel.setTargets(targets);
    if(panel.settings.opponentTargets)overlay.showOpponentTargets(tracker.state,player);else overlay.clearTargets();return targets;
  }
  function refreshPositionInsights(player=Site.getPlayerColor(panel.settings.playerColor)){updateOpening(player);updateMidgame(player);refreshTargets(player);}
  async function hardDisable(reason){active=false;paused=false;dragging=false;syncRecovering=false;cleanupBoardListeners();clearBoardUi(true);lastOptions=[];lastOptionsKey='';await stopEngine();tracker.reset();resetGuardFailures();panel.setDisabled(reason);refreshDiagnostics({disabled:true});}
  async function safetyPause(g){
    if(!paused){active=false;paused=true;cleanupBoardListeners();clearBoardUi(true);await cancelEngineSearch(true);guardFailureSince=Date.now();guardFailureCount=1;}else guardFailureCount++;
    panel.setSafetyPause(g.reason);refreshDiagnostics({lastGuardCode:g.code});
  }
  function bindBoard(board){
    cleanupBoardListeners();overlay.mount(board);stopObserve=Site.observe(board,onMutation);stopInteractions=Site.bindPieceInteractions(board,{onPick:onPiecePick,onRelease:onPieceRelease});
  }
  async function reconcileVisibleBoard(){
    const read=Site.readBoard();if(!read.ok)return{ok:false,error:read.error};if(!tracker.state)return{ok:false,error:'追踪器没有可恢复的局面。'};
    if(Rules.placementKey(read.board)===Rules.placementKey(tracker.state.board))return{ok:true,changed:false,records:[]};return tracker.observe(read.board);
  }
  async function resumeExistingSession(message='Bot 页面信号已恢复，棋局追踪继续。'){
    const g=Site.confirmBotMode();if(!g.allowed)return false;const rec=await reconcileVisibleBoard();
    if(!rec.ok){panel.setSyncRecovering(rec.error);active=true;paused=false;syncRecovering=true;syncFailureSince=syncFailureSince||Date.now();return false;}
    const board=Site.findBoard();if(!board)return false;bindBoard(board);active=true;paused=false;resetGuardFailures();resetSyncRecovery();
    const player=Site.getPlayerColor(panel.settings.playerColor);refreshPositionInsights(player);
    if(rec.rewound){await handleRewind(rec,player);}else if(rec.changed){await processRecords(rec.records||[rec.record],player);}else{panel.setWaiting(message);if(panel.settings.boardThreats&&tracker.state.turn===player)overlay.showThreats(tracker.state,player);restoreSuggestions(tracker.state,player);updateWinRateOnly(tracker.state,player);}
    refreshDiagnostics({recovered:true});return true;
  }
  async function resync(userInitiated){
    const g=Site.confirmBotMode();refreshDiagnostics();
    if(!g.allowed){cleanupBoardListeners();clearBoardUi(true);active=false;paused=false;dragging=false;if(g.hard){await stopEngine();panel.setDisabled(g.reason);}else{await cancelEngineSearch(true);panel.setSafetyPause(g.reason);}return;}
    await cancelEngineSearch(true);cleanupBoardListeners();clearBoardUi(true);active=false;paused=false;dragging=false;resetGuardFailures();resetSyncRecovery();
    // A manual Resync in the middle of a game should first reuse the already verified
    // tracker history. Throwing it away would make the button self-defeating after move 1.
    if(userInitiated&&tracker.state){
      const rec=await reconcileVisibleBoard();
      if(rec.ok){const board=Site.findBoard();if(board){bindBoard(board);active=true;const player=Site.getPlayerColor(panel.settings.playerColor);refreshPositionInsights(player);if(rec.rewound)await handleRewind(rec,player);else if(rec.changed)await processRecords(rec.records||[rec.record],player);else{panel.setWaiting('重新同步完成，已保留当前棋局历史。');if(panel.settings.boardThreats&&tracker.state.turn===player)overlay.showThreats(tracker.state,player);restoreSuggestions(tracker.state,player);updateWinRateOnly(tracker.state,player);}return;}}
    }
    tracker.reset();lastOptions=[];lastOptionsKey='';const read=Site.readBoard();if(!read.ok){panel.setSyncRecovering(read.error);return;}
    const init=tracker.initFromObserved(read.board,Site.getTrustedStartHints());if(!init.ok){panel.setSyncError(init.error);return;}
    active=true;bindBoard(Site.findBoard());const player=Site.getPlayerColor(panel.settings.playerColor);refreshPositionInsights(player);panel.setWaiting(userInitiated?'同步完成，等待下一步棋。':'同步完成，等待机器人走棋。');if(panel.settings.boardThreats&&tracker.state.turn===player)overlay.showThreats(tracker.state,player);updateWinRateOnly(tracker.state,player);
  }
  function onPiecePick(info){
    dragging=true;if(!active||syncRecovering||!panel.settings.moveSafety||!tracker.state)return;const player=Site.getPlayerColor(panel.settings.playerColor);
    if(Rules.colorOf(info.piece)!==player||tracker.state.turn!==player){overlay.clearLegal();return;}overlay.showLegalMoves(tracker.state,info.square,player);
  }
  function onPieceRelease(){
    setTimeout(()=>{dragging=false;overlay.clearLegal();scheduleBoardCheck(120);},170);
  }
  function scheduleBoardCheck(delay=165){clearTimeout(debounceTimer);debounceTimer=setTimeout(()=>processStableBoard().catch(()=>{}),delay);}
  function onMutation(){if(!active||dragging)return;scheduleBoardCheck(165);}
  async function processStableBoard(){
    if(!active||paused||dragging)return;const a=Site.readBoard();if(!a.ok)return;const keyA=Rules.placementKey(a.board);await sleep(95);if(dragging)return;const b=Site.readBoard();if(!b.ok||Rules.placementKey(b.board)!==keyA)return;
    const result=tracker.observe(b.board);if(!result.ok){await enterSyncRecovery(result.error);return;}resetSyncRecovery();if(!result.changed){if(panel.shadow?.querySelector('.status')?.textContent?.includes('同步正在自动恢复'))panel.setWaiting('棋盘已恢复到已验证局面，继续分析。');return;}
    const player=Site.getPlayerColor(panel.settings.playerColor);if(result.rewound){await handleRewind(result,player);return;}await processRecords(result.records||[result.record],player);
  }
  async function enterSyncRecovery(error){
    if(!syncRecovering){syncRecovering=true;syncFailureSince=Date.now();await cancelEngineSearch(true);clearBoardUi();}
    panel.setSyncRecovering(error);refreshDiagnostics({syncRecoveryError:error});
  }
  async function trySyncRecovery(){
    if(!syncRecovering||dragging||paused||!tracker.state)return false;const rec=await reconcileVisibleBoard();if(!rec.ok){if(Date.now()-syncFailureSince>SYNC_RECOVERY_NOTICE_MS)panel.setSyncRecovering(rec.error+' 自动恢复仍在继续；如果你刚悔棋或拖动棋子，请等待棋盘稳定。');return false;}
    resetSyncRecovery();const player=Site.getPlayerColor(panel.settings.playerColor);refreshPositionInsights(player);
    if(rec.rewound)await handleRewind(rec,player);else if(rec.changed)await processRecords(rec.records||[rec.record],player);else{panel.setWaiting('同步已自动恢复，继续当前棋局。');if(panel.settings.boardThreats&&tracker.state.turn===player)overlay.showThreats(tracker.state,player);restoreSuggestions(tracker.state,player);updateWinRateOnly(tracker.state,player);}return true;
  }
  async function handleRewind(result,player){
    await cancelEngineSearch(true);clearBoardUi();lastOptions=[];lastOptionsKey='';refreshPositionInsights(player);panel.setWaiting(`检测到悔棋：已安全回退 ${result.rewindCount||1} 个半回合，并继续追踪。`);
    if(tracker.state.turn===player){if(panel.settings.boardThreats)overlay.showThreats(tracker.state,player);refreshTargets(player);}else{overlay.clearThreats();overlay.clearTargets();panel.clearTargets('悔棋后轮到 Bot，等待它走棋。');}
    updateWinRateOnly(tracker.state,player);refreshDiagnostics({rewound:result.rewindCount||1});
  }
  async function processRecords(records,player){
    if(!records?.length)return;overlay.clearLegal();refreshPositionInsights(player);const last=records[records.length-1],mover=Rules.colorOf(last.move.piece);
    if(mover===player){await cancelEngineSearch(true);overlay.clearThreats();overlay.clearTargets();clearSuggestions();panel.clearTargets('你已经走棋，等待 Bot 回应后重新检查它的悬空子。');panel.setWaiting(records.length>1?'快速连续走棋已自动补同步；正在更新胜率。':'已确认你的走棋，正在更新胜率并等待机器人回应。');updateWinRateOnly(last.after,player);return;}
    await handleBotMove(last,player);
  }
  async function analyze(fen,level,phase){
    const profile=phase==='win'?{movetime:150,depth:8}:phase==='quick'?{movetime:220,depth:10}:{quick:{movetime:250,depth:10},balanced:{movetime:850,depth:15},deep:{movetime:1900,depth:19}}[level];
    try{return await chrome.runtime.sendMessage({type:'CHESSMATE_ANALYZE',fen,options:{multiPv:phase==='win'?1:3,...profile}});}catch(e){return{ok:false,error:e.message||String(e)};}
  }
  function winRateFromAnalysis(result,state,player,refined=false){
    const score=result?.lines?.[0]?.score;if(!score)return false;const wdl=Uci.scoreToWdl(score,state.turn,player);if(!wdl)return false;const engine=result.engine?.startsWith('stockfish')?'Stockfish':result.engine==='fallback'?'备用评估器':'';panel.setWinRate(wdl,(refined?'深度':'快速')+(engine?' · '+engine:''));return true;
  }
  async function updateWinRateOnly(state,player){
    if(!active||paused||syncRecovering||!state)return;const token=++winToken;panel.setWinRateLoading();const result=await analyze(Rules.toFen(state),panel.settings.analysisLevel,'win');if(token!==winToken||!active||paused||syncRecovering)return;if(result?.ok)winRateFromAnalysis(result,state,player,false);else if(!result?.cancelled)panel.clearWinRate('胜率更新失败');
  }
  async function handleBotMove(record,player){
    await cancelEngineSearch(true);clearSuggestions();const token=++analysisToken;if(panel.settings.boardThreats)overlay.showThreats(record.after,player);else overlay.clearThreats();refreshPositionInsights(player);
    panel.setAnalyzing('已确认机器人走棋，正在本地分析…');panel.setWinRateLoading();const fen=Rules.toFen(record.after),quick=await analyze(fen,panel.settings.analysisLevel,'quick');if(token!==analysisToken||!active||paused||syncRecovering)return;
    if(!quick?.ok){if(!quick?.cancelled)panel.setStatus('off','本地引擎暂时不可用：'+(quick?.error||'未知错误')+'；下一次局面变化会自动重试。');return;}
    winRateFromAnalysis(quick,record.after,player,false);const quickCoach=Coach.coach(record,quick.lines,player);panel.showCoach(quickCoach,false);showSuggestions(record.after,quickCoach.options);
    if(panel.settings.analysisLevel==='quick')return;const deep=await analyze(fen,panel.settings.analysisLevel,'deep');if(token!==analysisToken||!active||paused||syncRecovering)return;if(deep?.ok){winRateFromAnalysis(deep,record.after,player,true);const deepCoach=Coach.coach(record,deep.lines,player);panel.showCoach(deepCoach,true);showSuggestions(record.after,deepCoach.options);}
  }
  function isTransientBoardOnly(g){return g?.code==='board'&&g?.diagnostics?.urlAllowed&&!g?.diagnostics?.knownHumanUrl&&(g.diagnostics.positiveText?.length||g.diagnostics.positiveAttrs?.length);}
  async function guardTick(){
    const g=Site.confirmBotMode();
    if(g.allowed){
      if(paused&&tracker.state){await resumeExistingSession();return;}
      if(!active&&!tracker.state){await resync(false);return;}
      if(active){
        resetGuardFailures();const board=Site.findBoard();if(board&&overlay.board!==board){await cancelEngineSearch(true);clearBoardUi(true);cleanupBoardListeners();bindBoard(board);panel.setWaiting('检测到棋盘组件重绘，已重新绑定并保留棋局状态。');restoreSuggestions(tracker.state,Site.getPlayerColor(panel.settings.playerColor));scheduleBoardCheck(120);}
        if(syncRecovering)await trySyncRecovery();
      }
      refreshDiagnostics();return;
    }
    // An incomplete board during drag/animation is not evidence of a human opponent. Keep
    // the verified bot session and warm engine alive, but do not consume that bad snapshot.
    if(isTransientBoardOnly(g)){
      if(active&&!dragging&&syncRecovering)await trySyncRecovery();refreshDiagnostics({transientBoard:true,lastGuardCode:g.code});return;
    }
    if(g.hard){await hardDisable(g.reason);return;}
    await safetyPause(g);const elapsed=Date.now()-guardFailureSince;if(elapsed>=GUARD_GRACE_MS||guardFailureCount>=GUARD_FAILURE_LIMIT)await hardDisable(g.reason+' 连续多次确认失败，为保护公平性已保持关闭。');
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  guardTimer=setInterval(()=>guardTick().catch(()=>{}),GUARD_INTERVAL);await guardTick();
})();
