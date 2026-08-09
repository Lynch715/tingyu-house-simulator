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
const build=new Function('document','localStorage','window','confirm',`${source}\nreturn {fresh,migrate,monthly,facilityUpkeep,pause,resume,setSpeed,nightEstimate,processNightVisit,processDeferred,hallRequirement,setState:v=>S=v,getState:()=>S,getSpeed:()=>speed};`);
const game=build(document,localStorage,window,()=>true);

let state=game.fresh();
assert.equal(state.version,2);
assert.deepEqual(state.deferred,[]);
assert.equal(state.staff.every(e=>e.adult&&Number.isFinite(e.mood)),true);

const legacy=structuredClone(state);
legacy.version=1;
delete legacy.turn;delete legacy.flags;delete legacy.deferred;delete legacy.nightRecords;
legacy.staff.forEach(e=>{delete e.mood;delete e.adult;delete e.nightCooldown});
const migrated=game.migrate(legacy);
assert.equal(migrated.version,2);
assert.equal(migrated.flags.v2Migrated,true);
assert.equal(migrated.staff.every(e=>e.adult&&e.mood===72),true);

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

console.log('engine tests passed');
