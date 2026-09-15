import {chromium} from 'playwright';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=decodeURIComponent(new URL('..',import.meta.url).pathname);
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';let f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.end(fs.readFileSync(f))}).listen(8123);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const views=['start','home','programs','staff','guests','strategy','help','program','recruit','person','night','nightreport','report','event','huakui','redeem','inspect','poach','duel','ending','bankrupt'];
for(const vp of [{w:1440,h:900},{w:390,h:844}]){
  for(const v of views){
    const pg=await b.newPage({viewport:{width:vp.w,height:vp.h}});const errs=[];
    pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text())});
    await pg.goto(`http://localhost:8123/?audit=${v}`);await pg.waitForTimeout(300);
    const wide=await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    if(errs.length||wide)console.log(vp.w,v,errs.join(' | '),wide?'横向溢出':'');
    if(vp.w===390&&['home','staff','program','event'].includes(v)||vp.w===1440&&['home','programs','report'].includes(v))await pg.screenshot({path:`/tmp/shot_${vp.w}_${v}.png`,fullPage:false});
    await pg.close();
  }
}
// 真点一遍：开新局 → 排场子 → 过旬到结算
const pg=await b.newPage({viewport:{width:1440,height:900}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('http://localhost:8123/');await pg.click('text=开张');await pg.click('.nav[data-page=programs]');await pg.click('.program button.primary:not([disabled])');await pg.click('#dlgFoot button.primary');
for(let i=0;i<6;i++){await pg.click('.step');await pg.waitForTimeout(80);if(await pg.$('#dlg[open]')){const t=await pg.textContent('#dlgTitle');console.log('弹窗:',t);const c=await pg.$('#dlgBody .choice');if(c)await c.click();else await pg.click('#dlgFoot button');}}
console.log('点击流程错误:',errs);
await pg.screenshot({path:'/tmp/shot_flow.png'});
await b.close();srv.close();
