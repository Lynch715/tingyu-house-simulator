// node tests/engine.test.mjs —— V2 引擎冒烟测试（新档、老档迁移、排场子到结算、过夜、事件队列）
import assert from 'node:assert/strict';
import {buildGame,playOne} from './sim.mjs';

const G=buildGame();
// 新档
G.newGame();
let s=G.S;
assert.equal(s.version,5);assert.equal(s.staff.length,4);assert.deepEqual(s.queue,[]);
assert.ok(s.staff.every(e=>Number.isFinite(e.mood)&&Number.isFinite(e.charm)&&e.nightPreference));

// 老档（V1 版本 4 的形状）能读进来
const legacy={version:4,house:'听雨楼',year:2,month:5,period:2,money:500,fame:20,taste:12,network:9,hall:1,staff:[{id:1,name:'顾清和',role:'owner',level:3,qin:40,dance:31,wit:67,host:79,energy:90,salary:12,status:null,xp:10,adult:true}],records:[],news:[],trend:{name:'x',desc:'y',guest:'scholar',key:'qin',left:3},facilities:{stage:true},relations:{scholar:20},rivalFame:22,heat:3};
const m=G.normalize(structuredClone(legacy));
assert.equal(m.version,5);assert.equal(m.turn,36+12+1);assert.equal(m.relations.noble,0);assert.equal(m.staff[0].mood,72);assert.ok(m.staff[0].charm>=15);assert.deepEqual(m.deferred,[]);

// 排场子 → 过旬 → 中途事件进队列 → 结算进队列
G.newGame();s=G.S;
assert.equal(G.startProgram('qin',[2,4],1,{sound:3,care:3}),true);
assert.ok(s.program&&s.money===360-28);
G.advance(1);
assert.ok(G.dlg&&G.dlg.choices.length>=2,'半程应弹出事件');
G.dlgAct('c',1);// 不花钱那个
assert.equal(G.dlg,null);
G.advance(1);
assert.equal(s.program,null,'两旬后应结算');assert.equal(s.records.length,1);assert.ok(s.records[0].total>0&&s.records[0].crit.length===4,'应有四评客');
assert.equal(G.dlg.title,'这场算账');G.dlgAct('b',0);

// 过夜
s.fame=10;const cand=G.nightCandidates()[0];assert.ok(cand);
assert.equal(G.startNight(cand.id,cand.nightPreference),true);
G.advance(1);
assert.equal(s.nightRecords.length,1);let seen=false;for(let i=0;i<5&&G.dlg;i++){if(G.dlg.title==='过夜的账')seen=true;if(G.dlg.choices?.length)G.dlgAct('c',G.dlg.choices.length-1);else G.dlgAct('b',(G.dlg.buttons||[]).length-1)}assert.ok(seen,'应弹出过夜的账');

// 事件队列不会打断结算：一旬里同时到月底+结算
const r=playOne('smart',2);
assert.ok(!r.log.some(l=>l.startsWith('卡死')),'机器人不应卡死');
assert.ok(r.records>10);assert.ok(r.avg>15&&r.avg<38,'均分应在合理区间 '+r.avg);
console.log('engine.test 全过 ·',`两年机器人：${r.records} 场，均分 ${r.avg.toFixed(1)}，银子 ${Math.round(r.money)}`);
