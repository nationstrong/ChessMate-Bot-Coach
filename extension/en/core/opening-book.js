(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessMateOpeningBook=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // A deliberately compact, local teaching book. It identifies opening families and
  // common branches by longest UCI-prefix match. No network request or remote code.
  const O=(eco,en,zh,moves,idea,whitePlan,blackPlan)=>({eco,en,zh,moves:moves.trim()?moves.trim().split(/\s+/):[],idea,whitePlan,blackPlan});
  const BOOK=[
    O('B00',"King's Pawn Opening",'王兵开局','e2e4','白方先占据中心并打开后和王翼象的通道。','继续出子、控制 d5/f5，并争取安全王车易位。','选择一种中心反击体系，例如 ...e5、...c5、...e6 或 ...c6。'),
    O('C20','Open Game','开放性开局','e2e4 e7e5','双方都用王兵占中心，局面通常较开放，发展速度和王的安全很重要。','Nf3、Bc4/Bb5，快速出子并准备易位。','发展王翼子力，保护 e5，并避免后过早暴露。'),
    O('C50','Italian Game','意大利开局','e2e4 e7e5 g1f3 b8c6 f1c4','白方象直接瞄准 f7，强调快速发展和中心压力。','准备 c3+d4 或稳健易位，避免只盯着 f7 做一次性攻击。','完成出子并用 ...Nf6、...Bc5 或 ...Be7 稳住中心。'),
    O('C60','Ruy Lopez','西班牙开局','e2e4 e7e5 g1f3 b8c6 f1b5','白方用象牵制 c6 马，间接向 e5 中心施压。','先完成易位，再决定是否交换 c6 马并用 d4 扩张中心。','保护 e5，常用 ...a6、...Nf6，并准备 ...b5 或 ...Be7。'),
    O('C44','Scotch Game','苏格兰开局','e2e4 e7e5 g1f3 b8c6 d2d4','白方很早用 d4 直接打开中心，换取空间和主动出子。','用开放线发展子力，避免为了多吃一个兵而落后发展。','先处理中央交换，再迅速出子并攻击白方中心。'),
    O('C42','Petrov Defense','彼得罗夫防御','e2e4 e7e5 g1f3 g8f6','黑方不被动保护 e5，而是反攻白方 e4，结构通常扎实。','中心交换后争取更活跃的子力，避免机械交换到完全平淡。','保持对称结构的同时寻找 ...d5，优先完成发展。'),
    O('C41','Philidor Defense','菲利多尔防御','e2e4 e7e5 g1f3 d7d6','黑方用 ...d6 稳固 e5，但会稍微限制后翼象。','用 d4 占更多中心并快速发展。','寻找 ...Nf6、...Be7 和合适时机的 ...d5 反击。'),
    O('C25','Vienna Game','维也纳开局','e2e4 e7e5 b1c3','白方先发展后翼马，保留 f4 或 Nf3 的不同计划。','根据黑方布局选择 f4 扩张或安静 Nf3，保持中心弹性。','正常出子并警惕白方 f4 的王翼空间。'),
    O('C30',"King's Gambit",'王翼弃兵','e2e4 e7e5 f2f4','白方用 f 兵换取开放线和快速攻击机会，王翼会更锋利。','迅速发展并利用 f 线，不要为了追回兵浪费太多节奏。','如果接受弃兵，优先巩固王安全并消化额外兵。'),
    O('B20','Sicilian Defense','西西里防御','e2e4 c7c5','黑方用 c 兵从侧翼争夺 d4，制造不对称结构和反击机会。','通常用 Nf3+d4 打开中心，利用发展领先争主动。','争夺 d4、发展后翼，并准备在 c 线或后翼反击。'),
    O('B50','Open Sicilian','开放西西里','e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4','白方用 d4 交换 c 兵，形成典型开放西西里结构。','快速发展并寻找王翼攻势，同时注意 d4 马的稳定。','利用半开放 c 线和中心反击，通常后翼有更多空间。'),
    O('B90','Sicilian Najdorf','西西里纳道尔夫变例','e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6','...a6 控制 b5 并准备 ...b5，是非常灵活且战术性强的体系。','根据布局选择 Be3、Bg5 或 Be2，并尽快确定王的位置。','准备 ...e5 或 ...e6，并利用后翼扩张和 c 线。'),
    O('B70','Sicilian Dragon','西西里龙式变例','e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6','黑方把王翼象放到 g7 长对角线，双方常出现相反翼攻击。','Be3、Qd2、长易位后常见王翼推进，但必须计算黑方 c 线反击。','Bg7、O-O 后快速在 c 线和后翼制造反击。'),
    O('C00','French Defense','法国防御','e2e4 e7e6','黑方准备用 ...d5 正面挑战 e4，结构坚固但 c8 象常较难发展。','通常用 d4 建中心，再决定推进 e5、交换或保持张力。','用 ...d5 攻击白方中心，常见第二次反击是 ...c5。'),
    O('C02','French Defense: Advance','法国防御·推进变例','e2e4 e7e6 d2d4 d7d5 e4e5','白方用 e5 获得空间，黑方则攻击白方兵链根部 d4。','支持 d4，并考虑 c3、Nf3、Bd3；不要让中心兵链成为固定靶子。','典型计划是 ...c5 和 ...Nc6，持续攻击 d4。'),
    O('C01','French Defense: Exchange','法国防御·交换变例','e2e4 e7e6 d2d4 d7d5 e4d5 e6d5','中心变得对称，局面通常更开放、更重视子力活动。','利用先手发展优势，避免无意义地把所有子都换掉。','自然出子并争取平衡，不要因为结构对称就完全被动。'),
    O('C05','French Defense: Tarrasch','法国防御·塔拉什变例','e2e4 e7e6 d2d4 d7d5 b1d2','Nd2 避免 ...Bb4 的牵制，并保持中心选择。','常见 Nf3、Bd3、Ngf3；关注 e5 与 c3 的结构选择。','用 ...c5 立即挑战 d4，并寻找对 d4/e4 的压力。'),
    O('B10','Caro-Kann Defense','卡罗-康防御','e2e4 c7c6','黑方准备 ...d5 挑战中心，同时通常能让 c8 象顺利出动。','建立 d4 中心并利用空间优势，别让黑方舒适完成发展。','用 ...d5 建立稳固结构，之后把浅色格象发展到 f5 或 g4。'),
    O('B12','Caro-Kann: Advance','卡罗-康·推进变例','e2e4 c7c6 d2d4 d7d5 e4e5','白方用 e5 抢空间，黑方会从 c5/e6 方向攻击中心。','利用空间发展王翼，同时保护 d4/e5 兵链。','常见 ...Bf5、...e6、...c5，从两侧攻击白方中心。'),
    O('B01','Scandinavian Defense','斯堪的纳维亚防御','e2e4 d7d5','黑方第一步就直接攻击 e4，通常会较早让后参与战斗。','通常 exd5 后用发展节奏攻击黑后。','追回 d5 兵时避免后被连续追赶造成发展落后。'),
    O('B07','Pirc Defense','皮尔茨防御','e2e4 d7d6 d2d4 g8f6 b1c3 g7g6','黑方先允许白方占中心，再用子力和兵反击它。','利用空间，但别过度推进；稳健发展后再决定 f4/e5。','完成 ...Bg7、...O-O，再用 ...e5 或 ...c5 反击中心。'),
    O('B06','Modern Defense','现代防御','e2e4 g7g6','黑方不立即占中心，而是准备从 g7 长对角线施压。','建立强中心并快速发展，但要为 ...c5/...d5 反击留意。','用 ...Bg7 后针对白方中心选择 ...c5 或 ...d5。'),
    O('B02','Alekhine Defense','阿廖欣防御','e2e4 g8f6','黑方诱导白方推进兵，再攻击这些前进过度的中心兵。','可以抢空间，但每推进一步都要考虑这些兵是否会成为靶子。','诱导白方兵前进后，用 ...d6、...c5 等方式攻击中心。'),
    O('D00',"Queen's Pawn Opening",'后兵开局','d2d4','白方先控制 e5/c5，通常进入较封闭、战略性更强的结构。','用 c4 或 Nf3/Bf4 建立体系并自然发展。','选择 ...d5、...Nf6、...f5 等方式争夺中心。'),
    O('D06',"Queen's Gambit",'后翼弃兵','d2d4 d7d5 c2c4','白方用 c 兵挑战 d5，目标不是白送兵，而是争取中心优势。','继续发展并利用 c/d 线空间，若黑方吃兵通常可通过 e3/Bxc4 追回。','决定接受、拒绝或进入斯拉夫结构，并保持中心稳固。'),
    O('D30',"Queen's Gambit Declined",'后翼弃兵拒绝','d2d4 d7d5 c2c4 e7e6','黑方用 e6 支撑 d5，结构稳固但 c8 象暂时受限。','正常发展并对 d5 施压，常见 Nc3、Nf3、Bg5。','完成 Nf6、Be7、O-O，并寻找 ...c5 或 ...e5 解放中心。'),
    O('D20',"Queen's Gambit Accepted",'后翼弃兵接受','d2d4 d7d5 c2c4 d5c4','黑方暂时吃下 c4 兵，通常目标是争取时间而非死守额外兵。','用 e3/Bxc4 追回兵并依靠中心发展领先。','不要为保住 c4 兵浪费太多节奏，优先完成发展。'),
    O('D10','Slav Defense','斯拉夫防御','d2d4 d7d5 c2c4 c7c6','黑方用 c6 支撑 d5，不封住 c8 象，是非常扎实的后兵体系。','发展 Nc3/Nf3，并寻找 e3 或 Qc2 等方式加强中心。','保持 d5，选择 ...Nf6、...dxc4 或 ...Bf5 的发展方案。'),
    O('A45','Indian Game','印度防御体系','d2d4 g8f6','黑方先用马控制 e4，不立即用兵占据中心，保留多种印度防御选择。','通常用 c4 扩张中心，同时完成 Nf3/Nc3。','根据白方布局选择 ...g6、...e6、...c5 或 ...d5。'),
    O('E60',"King's Indian Defense",'王翼印度防御','d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6','白方占据大中心，黑方允许空间劣势以换取王翼和中心反击。','稳固中心后常在后翼扩张；注意黑方 ...f5 的王翼攻击。','完成易位并准备 ...e5 或 ...c5，典型情况下用 ...f5 攻王翼。'),
    O('E20','Nimzo-Indian Defense','尼姆佐印度防御','d2d4 g8f6 c2c4 e7e6 b1c3 f8b4','黑方用 Bb4 牵制 c3 马，争夺 e4 并愿意制造白方双兵。','决定是否允许 Bxc3，利用双象或中心空间补偿结构弱点。','对 e4/c4 施压，利用结构目标而不是急于战术攻击。'),
    O('E12',"Queen's Indian Defense",'后翼印度防御','d2d4 g8f6 c2c4 e7e6 g1f3 b7b6','黑方准备 ...Bb7，从长对角线控制中心，结构非常稳健。','用 g3/Bg2 或 Nc3 发展，同时限制 ...Ne4。','...Bb7、...Be7 后保持中心弹性，寻找 ...c5 或 ...d5。'),
    O('D80','Grünfeld Defense','格林菲尔德防御','d2d4 g8f6 c2c4 g7g6 b1c3 d7d5','黑方允许白方建立中心，随后用 Bg7 和 c5 直接攻击它。','建立中心时要确保它能被子力支持，不要只靠兵。','快速攻击 d4/e4 中心，长对角线是核心资源。'),
    O('A60','Benoni Defense','别诺尼防御','d2d4 g8f6 c2c4 c7c5 d4d5 e7e6','黑方接受空间劣势，以不对称兵链和后翼反击换取动态机会。','利用中心和王翼空间；留意黑方 b5/c4 的后翼反击。','准备 ...exd5、...d6 和 ...b5，攻击白方中心与后翼。'),
    O('A80','Dutch Defense','荷兰防御','d2d4 f7f5','黑方第一步用 f 兵控制 e4，主动争取王翼空间，但也略微削弱王。','优先控制 e4，并考虑 g3/Bg2 对黑王施压。','完成王翼发展并利用 ...e6/...Nf6 建立对 e4 的控制。'),
    O('D02','London System','伦敦体系','d2d4 d7d5 c1f4','白方很早把象放到 f4，追求稳定、可重复的体系结构。','常见 Nf3、e3、c3、Bd3；别只机械摆阵，要关注何时 c4/e4 突破。','用 ...Nf6、...c5 或 ...Bd6 主动挑战白方稳定结构。'),
    O('A46','London System','伦敦体系','d2d4 g8f6 c1f4','白方采用 Bf4 的体系发展，重点是稳固中心和快速完成布局。','Nf3、e3、c3 后寻找 Ne5 或 c4/e4 的主动突破。','尽早用 ...c5 或 ...d5 争中心，避免让白方完全舒服摆阵。'),
    O('E00','Catalan Opening','加泰罗尼亚开局','d2d4 g8f6 c2c4 e7e6 g2g3','白方结合后翼弃兵式中心与 Bg2 长对角线压力。','Bg2、Nf3、O-O 后长期施压 c/d 线和后翼。','完成发展并谨慎处理 c4/d5 张力，别轻易留下长期弱兵。'),
    O('A10','English Opening','英国式开局','c2c4','白方从侧翼控制 d5，常转入位置性、灵活且可转置的结构。','发展 Nc3/g3/Bg2，并根据黑方中心选择 d4 或 e4。','先决定是否占中心，再注意白方从 c 线和长对角线施压。'),
    O('A20','English Opening: King\'s English','英国式开局·王兵应对','c2c4 e7e5','黑方用 ...e5 建立反向西西里式结构，白方多一个先手。','Nc3、g3、Bg2 后从后翼和 d5 格施压。','Nf6、Nc6 后稳住 d4/d5 控制，避免后翼被白方完全压制。'),
    O('A30','English Opening: Symmetrical','英国式开局·对称变例','c2c4 c7c5','双方用 c 兵控制 d4/d5，局面常较位置化且容易转置。','利用先手先完成发展，再寻找 d4 突破。','保持灵活，别机械模仿白方每一步而失去主动计划。'),
    O('A04','Réti Opening','列蒂开局','g1f3','白方先发展马并控制 e5，暂不暴露中心兵结构。','根据黑方中心选择 c4、g3 或 d4，利用转置保持灵活。','占据中心或稳固控制 d4/e4，别让白方无成本从侧翼施压。'),
    O('A09','Réti Opening','列蒂开局·c4体系','g1f3 d7d5 c2c4','白方从侧翼攻击 d5，而不是立即用 d 兵正面对抗。','g3/Bg2 后持续对中心施压，必要时 d4 转入后兵开局。','稳固 d5 或用 ...e6/...c6 建结构，同时完成发展。'),
    O('A02',"Bird's Opening",'伯德开局','f2f4','白方用 f 兵控制 e5，类似荷兰防御多一个先手，但王翼也会变松。','发展 Nf3、e3、b3/Bb2，并持续关注王翼安全。','攻击 e4/e5 控制链，必要时直接利用白方王翼弱点。')
  ];
  BOOK.sort((a,b)=>b.moves.length-a.moves.length);

  function normalizeHistory(history){
    return (history||[]).map(x=>typeof x==='string'?x:x?.uci).filter(Boolean).map(x=>String(x).toLowerCase());
  }
  function isPrefix(line,moves){if(line.length>moves.length)return false;for(let i=0;i<line.length;i++)if(line[i]!==moves[i])return false;return true;}
  function identify(history){
    const moves=normalizeHistory(history);if(!moves.length)return null;
    const found=BOOK.find(x=>isPrefix(x.moves,moves));if(!found)return null;
    const exact=moves.length===found.moves.length;
    return {...found,exact,recognizedPly:found.moves.length,currentPly:moves.length,outOfBook:moves.length>found.moves.length};
  }
  function playerTip(opening,playerColor){if(!opening)return'';return playerColor==='b'?opening.blackPlan:opening.whitePlan;}
  return{BOOK,identify,playerTip,normalizeHistory};
});
