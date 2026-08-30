(function () {
  'use strict';
  const API = globalThis.ChessMatePanel;
  if (!API || !API.Panel) return;

  const exact = new Map(Object.entries({
    'ChessMate 机器人教练':'ChessMate Bot Coach','仅 Bot · v0.5.2':'Bot only · v0.5.2','折叠':'Collapse',
    '正在确认页面是否为允许的机器人对局…':'Confirming an allowed Bot game…','当前开局':'Current opening','等待走棋':'Waiting for moves',
    '尚未形成明确开局':'No recognized opening yet','从第一步开始，ChessMate 会根据本地开局库识别开局家族。':'ChessMate identifies opening families from its bundled local opening book.',
    '实时胜率估计':'Live outcome estimate','等待评估':'Waiting for evaluation','你 25%':'You 25%','和棋 50%':'Draw 50%',
    'Bot 的思路':'BOT PLAN','等待确认机器人走棋。':'Waiting for the Bot move.','小心':'WATCH OUT','尚未分析当前局面。':'The current position has not been analyzed yet.',
    '对手的悬空目标':'Opponent loose targets','等待局面形成后检查对方未受保护的棋子。':'Waiting for a position before checking undefended pieces.',
    '你的 3 个优先方案':'Your 3 candidate plans','棋盘上的 ① ② ③ 与下方顺序对应；若能利用对手悬空子，会直接标在方案里。':'Board markers ① ② ③ match the plans below. A loose-piece opportunity is labeled directly.',
    '机器人走棋后会显示推荐着法。':'Candidate moves appear after the Bot moves.','执棋颜色':'Playing color','自动':'Auto','白方':'White','黑方':'Black',
    '分析强度':'Analysis strength','快速':'Quick','均衡':'Balanced','深度':'Deep','威胁箭头':'Threat arrows','落点安全':'Move safety','对手悬空子':'Loose targets',
    '绿：不受攻击':'Green: not attacked','黄：受攻击但有保护':'Yellow: attacked but defended','红：受攻击且无保护':'Red: attacked and undefended','蓝框：对手未保护目标':'Blue: opponent loose target',
    '重置 / 重新同步':'Reset / resync','诊断':'Diagnostics','中局对手画像':'Bot tendency profile','观察中':'Observing','正在积累样本':'Building a sample',
    '会根据 Bot 最近的将军、吃子、王区施压、后撤和回防动作滚动判断。':'Uses recent checks, captures, king pressure, retreats, and defensive moves.',
    '当前建议：先保证王安全并完成出子。':'Current advice: secure your king and complete development.',
    '黄色/红色都仍可能是合法着法；颜色描述的是落点后的直接攻防关系，而不是替你判定“能不能走”。胜率是局面评估换算的近似概率。窗口右下角可拖动改变大小；内容过长时可直接滚动。':'Yellow and red moves may still be legal; colors show the immediate attack/defense relation after the move. Outcome percentages are approximate. Drag the lower-right corner to resize.',
    '拖动改变窗口大小':'Drag to resize','同步完成，等待机器人走棋。':'Synced; waiting for the Bot move.','正在本地分析…':'Analyzing locally…','正在评估候选计划…':'Evaluating candidate plans…',
    '更新中…':'Updating…','未识别到常见开局':'No common opening recognized','当前没有识别到值得优先利用的对手未保护棋子。':'No useful undefended opponent piece is currently identified.',
    '目前没有紧急警告。':'No urgent warning right now.','引擎没有返回可用的合法候选着法。':'The engine returned no usable legal candidate move.',
    '可吃悬空子':'Free capture','悬空子但需计算':'Loose target—calculate','攻击悬空子':'Attack loose target','进攻倾向':'Attacking tendency','防守 / 反击倾向':'Defensive / counterattacking tendency','均衡 / 尚未定型':'Balanced / not yet established'
  }));

  const pieces = {'兵':'pawn','马':'knight','象':'bishop','车':'rook','后':'queen','王':'king','棋子':'piece'};
  function tr(value) {
    if (value == null) return value;
    let s = String(value);
    if (exact.has(s)) return exact.get(s);
    for (const [zh,en] of exact) s = s.split(zh).join(en);
    s = s.replace(/置信度\s*(\d+)%\s*·\s*(\d+)\s*个 Bot 回合/g,'Confidence $1% · $2 Bot turns')
      .replace(/棋盘标记\s*(\d+)/g,'Board marker $1').replace(/深度\s*(\d+)/g,'depth $1')
      .replace(/你\s*(\d+)%/g,'You $1%').replace(/和棋\s*(\d+)%/g,'Draw $1%')
      .replace(/评估\s*([+−-]?[\d.]+)/g,'Eval $1').replace(/你的应对：/g,'Your response: ')
      .replace(/已离开已识别主线/g,'outside recognized book line').replace(/等待机器人走棋/g,'Waiting for the Bot move')
      .replace(/同步/g,'sync').replace(/分析/g,'analysis').replace(/机器人/g,'Bot');
    for (const [zh,en] of Object.entries(pieces)) s=s.split(zh).join(en);
    return s;
  }
  function translateShadow(shadow) {
    if (!shadow) return;
    const walker=document.createTreeWalker(shadow,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    for(const n of nodes){const next=tr(n.nodeValue);if(next!==n.nodeValue)n.nodeValue=next;}
    shadow.querySelectorAll('[title],[aria-label]').forEach(el=>{for(const a of ['title','aria-label'])if(el.hasAttribute(a))el.setAttribute(a,tr(el.getAttribute(a)));});
  }
  const P=API.Panel.prototype;
  const render=P.renderShell; P.renderShell=function(){const out=render.call(this);translateShadow(this.shadow);return out;};
  function wrap(name, mapArgs){const original=P[name];if(!original)return;P[name]=function(...args){const mapped=mapArgs?mapArgs(args):args.map(tr);const out=original.apply(this,mapped);translateShadow(this.shadow);return out;};}
  ['setStatus','setWaiting','setAnalyzing','setSafetyPause','clearWinRate','clearOpening','clearTargets','setDisabled','setSyncRecovering','setSyncError'].forEach(n=>wrap(n));
  wrap('setOpening',args=>{const opening=args[0]?{...args[0],zh:'',idea:'Opening identified from the bundled local book.'}:args[0];return[opening,'Develop pieces, contest the center, and keep your king safe.'];});
  wrap('setMidgame',args=>{const a=args[0];return[a?{...a,label:tr(a.label),evidence:(a.evidence||[]).map(tr),advice:tr(a.advice)}:a];});
  wrap('setTargets',args=>[(args[0]||[]).map(x=>({...x,pieceName:tr(x.pieceName),note:tr(x.note)}))]);
  wrap('showCoach',args=>{const c=args[0]||{};return[{...c,changed:tr(c.changed),ideas:(c.ideas||[]).map(tr),warning:c.warning?{...c.warning,text:tr(c.warning.text)}:c.warning,options:(c.options||[]).map(x=>({...x,targetTag:tr(x.targetTag),rationale:tr(x.rationale)}))},args[1]];});
  wrap('setWinRate',args=>[args[0],tr(args[1])]);
})();
