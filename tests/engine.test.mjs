import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'应能提取游戏脚本');
const initMark="$('continueBtn').disabled=!load();";
const source=script.slice(0,script.indexOf(initMark));

function fakeElement(){
  return {
    innerHTML:'',textContent:'',value:'scholar',disabled:false,open:false,dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    querySelector(){return null},querySelectorAll(){return[]},
    showModal(){this.open=true},close(){this.open=false}
  };
}
const elements=new Map();
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,fakeElement());return elements.get(id)},
  querySelector(){return null},querySelectorAll(){return[]}
};
const store=new Map();
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const window={addEventListener(){}};
const build=new Function('document','localStorage','window','confirm',`${source}\nreturn {fresh,migrate,monthly,facilityUpkeep,pause,resume,setSpeed,nightEstimate,processNightVisit,processDeferred,processAdmirers,maybeSmitten,hallRequirement,unlock,programDefs,rentOf,bribeOfficial,getEl:id=>document.getElementById(id),setState:v=>S=v,getState:()=>S,getSpeed:()=>speed};`);
const game=build(document,localStorage,window,()=>true);

let state=game.fresh();
assert.equal(state.version,4);
assert.deepEqual(state.deferred,[]);
assert.deepEqual(state.admirers,[]);
assert.equal(state.huakui,null);
assert.equal(state.rivalFame,10);
assert.equal(state.heat,0);
assert.equal(state.staff.every(e=>e.adult&&Number.isFinite(e.mood)&&Number.isFinite(e.charm)),true);

const legacy=structuredClone(state);
legacy.version=2;
delete legacy.admirers;delete legacy.huakui;delete legacy.rivalFame;delete legacy.heat;
legacy.staff.forEach(e=>{delete e.charm});
const migrated=game.migrate(legacy);
assert.equal(migrated.version,4);
assert.equal(migrated.flags.v3Migrated,true);
assert.equal(migrated.flags.v4Migrated,true);
assert.ok(Number.isFinite(migrated.rivalFame)&&migrated.heat===0,'迁移旧档应补齐对台与风纪字段');
assert.deepEqual(migrated.admirers,[]);
assert.equal(migrated.staff.every(e=>Number.isFinite(e.charm)&&e.charm>=15&&e.charm<=100),true,'迁移旧档应补齐风情属性');

const veryOld=structuredClone(state);
veryOld.version=1;
delete veryOld.turn;delete veryOld.flags;delete veryOld.deferred;delete veryOld.nightRecords;delete veryOld.admirers;delete veryOld.huakui;
veryOld.staff.forEach(e=>{delete e.mood;delete e.adult;delete e.nightCooldown;delete e.charm});
const migrated1=game.migrate(veryOld);
assert.equal(migrated1.version,4);
assert.equal(migrated1.staff.every(e=>e.adult&&e.mood===72),true);

game.setState(state);
game.setSpeed(0);game.pause();game.resume();
assert.equal(game.getSpeed(),0,'手动暂停后开关弹窗不得误恢复为 1 倍速');

state=game.fresh();
state.facilities.stage=true;
game.setState(state);
const beforeMonth=state.money;
game.monthly();
assert.equal(beforeMonth-state.money,87,'月支出应包含月钱、食宿、楼租和设施维护');
assert.equal(game.facilityUpkeep(),6);

state=game.fresh();
game.setState(state);
const actor=state.staff[0];
actor.status={kind:'night'};
state.nightVisit={id:'night_test',staffId:actor.id,guest:'merchant',turns:1,estimate:game.nightEstimate(actor,'merchant'),date:'测试旬'};
const beforeNight=state.money;
game.processNightVisit();
assert.equal(state.nightVisit,null);
assert.equal(state.nightRecords.length,1);
assert.ok(state.money>beforeNight);
assert.ok(state.nightRecords[0].net>=28&&state.nightRecords[0].net<=42,'单旬留宿净收益应低于轮换刷钱阈值');
assert.equal(state.heat,1,'留宿应积累 1 点风纪注意');
assert.ok(actor.nightCooldown>=2);
assert.equal(actor.status,null);
assert.equal(state.deferred.length,1);
game.processDeferred();
assert.equal(state.deferred.length,1);
game.processDeferred();
assert.equal(state.deferred.length,0,'延迟回礼应在两旬后兑现');

state=game.fresh();
game.setState(state);
assert.equal(game.hallRequirement(0).ok,false);
state.records=Array.from({length:4},(_,i)=>({id:i}));state.fame=12;
assert.equal(game.hallRequirement(0).ok,true);

// 花魁加成应提高留宿身价
state=game.fresh();
game.setState(state);
const dancer=state.staff.find(e=>e.name==='柳如烟');
const plain=game.nightEstimate(dancer,'merchant');
state.huakui=dancer.id;
const crowned=game.nightEstimate(dancer,'merchant');
assert.ok(crowned>plain*1.2&&crowned<plain*1.4,'花魁留宿身价应有约 1.3 倍加成');

// 艳席解锁门槛
state=game.fresh();
game.setState(state);
const wine=game.programDefs.find(p=>p.id==='wine'),spring=game.programDefs.find(p=>p.id==='spring');
assert.equal(game.unlock(wine),false,'名望不足时艳席不可办');
state.fame=10;
assert.equal(game.unlock(wine),true);
assert.equal(game.unlock(spring),false);
state.huakui=1;
assert.equal(game.unlock(spring),true,'有花魁即可办牡丹春宵夜');

// 恩客孝敬与包场只增不减，且无恩客时不动账
state=game.fresh();
game.setState(state);
const idleMoney=state.money;
game.processAdmirers();
assert.equal(state.money,idleMoney,'无恩客时不应有孝敬入账');
state.admirers=[{id:'a1',staffId:3,guest:'merchant',level:2,asked:false,name:'绸缎庄周东家'}];
const before=state.money;
game.processAdmirers();
assert.ok(state.money>=before+12,'恩客月度孝敬应入账');

// 留宿后有几率产生恩客（用高风情多次采样验证不报错且等级封顶）
state=game.fresh();
game.setState(state);
const star=state.staff[2];star.charm=95;
for(let i=0;i<60;i++)game.maybeSmitten(star,'merchant',true);
assert.ok(state.admirers.length<=1,'同一人同一圈层只应有一位恩客');
if(state.admirers.length)assert.ok(state.admirers[0].level<=7,'痴迷等级封顶 7');

// 楼租逐年上涨
state=game.fresh();
game.setState(state);
assert.equal(game.rentOf(),22,'第一年楼租不变');
state.year=5;
assert.equal(game.rentOf(),29,'第五年楼租应涨约 32%');

// 醉仙舫名望月月上涨，被压一头有据可查
state=game.fresh();
game.setState(state);
const rivalBefore=state.rivalFame;
game.monthly();
assert.ok(state.rivalFame>rivalBefore,'醉仙舫名望应逐月增长');

// 风纪攒满触发官府查访，打点后减半
state=game.fresh();
game.setState(state);
state.heat=13;state.money=500;
game.getEl('eventDialog').open=false;
game.monthly(); // 衰减到 12，仍达查访线
assert.equal(game.getEl('eventDialog').open,true,'风纪≥12 应触发官府查访');
const bribeMoney=state.money;
game.bribeOfficial(66);
assert.equal(state.money,bribeMoney-66);
assert.equal(state.heat,6,'打点后风纪减半');

console.log('engine tests passed');
