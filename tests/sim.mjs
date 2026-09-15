// 无头自动对局：node tests/sim.mjs [naive|smart] [年数] [局数]
// 用假 DOM 把 index.html 的脚本跑起来，机器人自己排场子、招人、歇人，统计首年均分、破产率等。
import fs from 'node:fs';
const [,, mode='smart', yearsArg='3', runsArg='10']=process.argv;
const YEARS=+yearsArg,RUNS=+runsArg;
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const source=script.slice(0,script.indexOf('/*__INIT__*/'));

export function buildGame(){
  const els=new Map();
  function el(){return{innerHTML:'',textContent:'',value:'',disabled:false,open:false,dataset:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},showModal(){this.open=true},close(){this.open=false}}}
  const document={getElementById(id){if(!els.has(id))els.set(id,el());return els.get(id)},querySelector(){return null},querySelectorAll(){return[]}};
  const store=new Map();
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  const window={addEventListener(){},removeEventListener(){}};
  const f=new Function('document','localStorage','window','confirm','setInterval','clearInterval','setTimeout','clearTimeout',
    source+`\nreturn {get S(){return S},set S(v){S=v},fresh,normalize,newGame,advance,startProgram,startNight,restAll,makeCands,hire,buyFacility,upgradeHall,buyItem,setCareer,giveItem,ITEMS,CAREERS,unlocked,nightCandidates,openHuakui,runHuakui,PROGRAMS,FACILITIES,HALLS,get dlg(){return dlgState},dlgAct,closeDlg,flushQueue,get cands(){return cands},burnOf,rentOf,hallReq,EVENTS};`);
  return f(document,localStorage,window,()=>true,()=>0,()=>{},()=>0,()=>{});
}

function resolveDialogs(G,log){
  let guard=0;
  while(G.dlg&&guard++<20){
    const d=G.dlg;
    if(d.choices&&d.choices.length){
      // 优先不花钱的选项；花钱的能付得起才选
      let order=d.choices.map((c,i)=>i).sort((a,b)=>(d.choices[a].sub||'').startsWith('花')-(d.choices[b].sub||'').startsWith('花'));
      let done=false;
      for(const i of order){const before=G.dlg;G.dlgAct('c',i);if(G.dlg!==before||!G.dlg){done=true;break}}
      if(!done){log.push('卡死在弹窗：'+d.title);G.closeDlg()}
    }else if(d.buttons&&d.buttons.length){
      let i=d.buttons.findIndex(b=>b.primary);if(i<0)i=d.buttons.length-1;
      if(d.title.startsWith('八年')||d.title==='楼易主了'){log.push('结束：'+d.title);G.closeDlg(true);return 'end'}
      G.dlgAct('b',i);
    }else G.closeDlg();
  }
}

export function playOne(mode,years){
  const G=buildGame();G.newGame();
  const log=[];let ended=false;
  const S=()=>G.S;
  while(S().year<=years&&!ended){
    if(resolveDialogs(G,log)==='end'){ended=true;break}
    const s=S();
    // 歇：体力低的空闲人
    s.staff.filter(e=>!e.status&&e.energy<40).forEach(e=>e.status={kind:'rest',turns:1});
    // 排场子
    if(!s.program){
      const free=s.staff.filter(e=>!e.status&&e.energy>=25);
      let list=G.PROGRAMS.filter(d=>G.unlocked(d)&&free.length>=d.need&&s.money>=d.cost*1.35+40);
      if(list.length){
        let d;
        if(mode==='naive')d=list[Math.floor(Math.random()*list.length)];
        else{
          // 聪明点：风向匹配优先，其次按底价/人数，选本事最匹配的
          list.sort((a,b)=>{const ta=a.guest===s.trend.guest?1.22:1,tb=b.guest===s.trend.guest?1.22:1;return (b.base*tb/b.need)-(a.base*ta/a.need)});
          d=list[0];
        }
        const team=free.slice().sort((a,b)=>(b[d.keys[0]]+b[d.keys[1]])-(a[d.keys[0]]+a[d.keys[1]])).slice(0,mode==='naive'?d.need:Math.min(free.length,d.need+1)).map(e=>e.id);
        const focus={sound:0,look:0,flirt:0,care:0};
        if(mode!=='naive'){const W={scholar:{sound:.4,care:.3,look:.15,flirt:.15},merchant:{look:.35,flirt:.3,care:.2,sound:.15},wanderer:{flirt:.35,sound:.3,look:.2,care:.15},noble:{care:.4,look:.3,sound:.2,flirt:.1}}[d.guest];const top=Object.keys(W).sort((a,b)=>W[b]-W[a]);focus[top[0]]=3;focus[top[1]]=3}
        G.startProgram(d.id,team,mode==='naive'?1:(s.money>400?1.35:1),focus);
      }
    }
    // 过夜（smart）：有合适的人且没安排
    if(mode==='smart'&&!s.nightVisit&&s.fame>=8){
      const c=G.nightCandidates().filter(e=>!e.status);
      if(c.length){const e=c.sort((a,b)=>b.charm-a.charm)[0];G.startNight(e.id,e.nightPreference)}
    }
    // 花魁
    if(mode==='smart'&&s.fame>=15&&s.money>=500&&!s.flags['huakui_y'+s.year]){const e=s.staff.filter(x=>!x.status).sort((a,b)=>b.charm-a.charm)[0];if(e)G.runHuakui(e.id)}
    // 招人 / 添东西 / 扩楼
    if(mode==='smart'&&s.money>350){
      const cap=G.HALLS[s.hall].cap+(s.facilities.carriage?1:0);
      if(s.staff.length<cap){G.makeCands(true);const best=G.cands.slice().sort((a,b)=>(b.qin+b.dance+b.wit+b.host+b.charm)-(a.qin+a.dance+a.wit+a.host+a.charm))[0];if(best&&s.money>best.signing+300)G.hire(G.cands.indexOf(best))}
      else if(G.hallReq().ok&&s.hall<2&&s.money>G.HALLS[s.hall+1].cost+250)G.upgradeHall();
      else{const f=G.FACILITIES.find(x=>!s.facilities[x.id]&&s.money>x.cost+300);if(f)G.buyFacility(f.id);else{const it=G.ITEMS.find(x=>!s.items.includes(x.id)&&s.money>x.cost+300);if(it){G.buyItem(it.id);if(it.scope==='person'){const e=s.staff.filter(x=>x.role!=='owner').sort((a,b)=>(b.qin+b.dance+b.charm)-(a.qin+a.dance+a.charm))[0];if(e)G.giveItem(e.id,it.id)}}}}
      s.staff.filter(e=>e.level>=5&&!e.career&&G.CAREERS[e.role]&&s.money>200).forEach(e=>G.setCareer(e.id,G.CAREERS[e.role][0].id));
    }
    G.advance(1);
  }
  const s=S();
  const y1=s.records.filter(r=>+r.date.match(/第 (\d+) 年/)[1]===1);
  return{years:s.year,money:s.money,fame:s.fame,taste:s.taste,network:s.network,hall:s.hall,staff:s.staff.length,records:s.records.length,
    y1avg:y1.length?y1.reduce((a,r)=>a+r.total,0)/y1.length:0,avg:s.records.length?s.records.reduce((a,r)=>a+r.total,0)/s.records.length:0,hof:s.hof.length,combos:s.combosFound.length,items:s.items.length,careers:s.staff.filter(e=>e.career).length,
    nights:s.nightRecords.length,admirers:s.admirers.length,huakui:!!s.huakui,bankrupt:s.ended,log};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const rs=[];for(let i=0;i<RUNS;i++)rs.push(playOne(mode,YEARS));
  const avg=k=>(rs.reduce((a,r)=>a+r[k],0)/rs.length).toFixed(1);
  console.log(`${mode} × ${RUNS} 局 × ${YEARS} 年`);
  console.log(`首年均分 ${avg('y1avg')} · 总均分 ${avg('avg')} · 场次 ${avg('records')} · 银子 ${avg('money')} · 名声 ${avg('fame')} · 格调 ${avg('taste')} · 门路 ${avg('network')}`);
  console.log(`名楼志 ${avg('hof')} · 组合 ${avg('combos')} · 物件 ${avg('items')} · 转职 ${avg('careers')} · 楼级 ${avg('hall')} · 人数 ${avg('staff')} · 过夜 ${avg('nights')} · 老客 ${avg('admirers')} · 花魁率 ${(rs.filter(r=>r.huakui).length/rs.length*100).toFixed(0)}% · 破产率 ${(rs.filter(r=>r.bankrupt).length/rs.length*100).toFixed(0)}%`);
  const problems=rs.flatMap(r=>r.log).filter(l=>l.startsWith('卡死'));if(problems.length)console.log('问题：',[...new Set(problems)]);
}
