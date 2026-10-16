import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
test('complete journal screens, workflows, CSV validation, and persistence', async () => {
const output=fs.mkdtempSync(path.join(os.tmpdir(),'edgebook-qa-'));
const elements=new Map(),handlers={},local=new Map();
function el(id){return {id,innerHTML:'',style:{},dataset:{},setAttribute(){},removeAttribute(){},querySelector(){return null},querySelectorAll(){return []},focus(){},append(){},remove(){},classList:{toggle(){},remove(){},add(){}}};}
for(const id of ['app','overlay-root','toast-root'])elements.set(id,el(id));
globalThis.document={body:el('body'),activeElement:el('active'),getElementById:id=>elements.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn),createElement:()=>el('created')};
globalThis.location={hash:''};globalThis.history={pushState(a,b,hash){location.hash=hash},replaceState(a,b,hash){location.hash=hash}};
globalThis.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1440,innerHeight:1000,print(){}};
globalThis.FormData=class {constructor(f){return new Map(Object.entries(f.values))}};
const {s,context,parseImport,validateBackup,actions,authController}=await import(new URL('../src/main.js',import.meta.url).href);
assert(elements.get('app').innerHTML.includes('Welcome back.'));
authController.enterDemo();
assert(elements.get('app').innerHTML.includes('Performance overview'));
const {view,pages,sidebar,topbar}=await import(new URL('../src/pages/index.js',import.meta.url).href);
const {stats,sum,daily,generateTrades}=await import(new URL('../src/data/index.js',import.meta.url).href);
const {equityChart,metricStrip}=await import(new URL('../src/components/ui.js',import.meta.url).href);
const submit=values=>{const f={...values,reportValidity:()=>true};for(const fn of handlers.submit)fn({target:f,preventDefault(){}})};
const click=dataset=>{const target={dataset,classList:{contains(){return false}},closest(){return this}};for(const fn of handlers.click)fn({target,preventDefault(){}})};
const originalCount=s.trades.length;
assert.equal(originalCount,219);
const initial=context();assert.equal(initial.rows.length,79);assert.equal(+stats(initial.rows).pnl.toFixed(2),2491.84);
let screens=0;
for(const [page] of pages){s.page=page;for(const account of ['all','funded','nova','personal']){s.account=account;const html=sidebar(s)+topbar(s)+view(s,context());assert(!html.includes('NaN'),`${page}/${account} has NaN`);assert(!html.includes('undefined'),`${page}/${account} has undefined`);assert(!html.includes('[object Object]'));if(account==='all')fs.writeFileSync(`${output}/${page}.html`,html);screens++;}}
s.account='all';s.page='analytics';for(const tab of ['performance','sessions','instruments','strategies','behavior']){s.analyticsTab=tab;const html=view(s,context());assert(!html.includes('NaN'));assert(!html.includes('undefined'));fs.writeFileSync(`${output}/analytics-${tab}.html`,html);screens++;}
s.page='overview';for(const source of ['Manual','Bot','all'])for(const period of ['7d','30d','90d','all']){s.source=source;s.period=period;assert(!view(s,context()).includes('NaN'));screens++;}
s.source='all';s.period='30d';
for(const rows of [[],[s.trades[0]],s.trades.filter(t=>t.pnl>0),s.trades.filter(t=>t.pnl<0)]){assert(!equityChart(rows).includes('NaN'));assert(!equityChart(rows,{drawdown:true}).includes('NaN'));assert(!metricStrip(rows).includes('NaN'));}
const imported=parseImport('date,time,account,symbol,side,pnl,risk\n2026-10-16,08:30,funded,XAUUSD,Long,250,125');assert.equal(imported.length,1);assert.equal(imported[0].r,2);assert.equal(imported[0].disciplined,true);
assert.throws(()=>parseImport('date,time,account,symbol,side,pnl,risk\n2026-02-30,08:30,funded,XAUUSD,Long,250,125'),/valid date/);
assert.throws(()=>parseImport('date,time,account,symbol,side,pnl,risk\n2026-10-16,08:30,funded,XAUUSD,Long,250,0'),/positive/);
assert.throws(()=>parseImport('date,time,account,symbol,side,pnl,risk\n2026-10-16,25:30,funded,XAUUSD,Long,250,125'),/UTC/);
assert.throws(()=>parseImport('date,time,account,symbol,side,pnl,risk\n2026-10-16,08:30,missing,XAUUSD,Long,250,125'),/account/);
const quoted=parseImport('date,time,account,symbol,side,pnl,risk,notes\r\n2026-10-16,08:30,funded,EURUSD,Short,-40,50,"Patient, but early.\nNext time wait."');assert(quoted[0].notes.includes('\n'));assert.equal(quoted[0].pnl,-40);
submit({id:'trade-form',values:{account:'funded',source:'Manual',date:'2026-10-16',time:'08:30',symbol:'xauusd',side:'Long',entry:'2650',exit:'2670',sl:'2640',tp:'2670',risk:'125',pnl:'245',commission:'5',swap:'0',volume:'.25',duration:'60',strategy:'sweep',mood:'Focused',notes:'Test trade',disciplined:'on'}});
assert.equal(s.trades.length,originalCount+1);const added=s.trades.find(t=>t.id.startsWith('manual-'));assert.equal(added.pnl,245);assert.equal(added.gross,250);assert.equal(added.r,1.96);assert.equal(added.symbol,'XAUUSD');assert.equal(added.session,'London');assert.equal(+stats(context().rows).pnl.toFixed(2),2736.84);
click({trade:added.id});assert(elements.get('overlay-root').innerHTML.includes('The trade review'));assert(!elements.get('overlay-root').innerHTML.includes('NaN'));fs.writeFileSync(`${output}/trade-drawer.html`,elements.get('overlay-root').innerHTML);
click({tradeTab:'execution'});assert(elements.get('overlay-root').innerHTML.includes('Position opened'));
click({tradeTab:'review'});assert(elements.get('overlay-root').innerHTML.includes('review-form'));
submit({id:'review-form',values:{mood:'Calm',rating:'5',notes:'Waited for confirmation',tags:'Plan followed, Patient',disciplined:'on'}});assert.equal(added.reviewed,true);assert.equal(added.rating,5);assert.equal(added.tags.length,2);
const entriesBefore=s.entries.length;submit({id:'journal-form',dataset:{id:''},values:{date:'2026-10-16',mood:'Calm',title:'QA reflection',content:'A complete process review.',energy:'4',tags:'Process'}});assert.equal(s.entries.length,entriesBefore+1);assert.equal(s.habits[3],true);assert.equal(s.page,'journal');
const playbooksBefore=s.playbooks.length;submit({id:'playbook-form',dataset:{id:''},values:{name:'QA setup',description:'Wait for the retest.',type:'Manual',timeframe:'1H',symbols:'EURUSD',risk:'.5',rules:'Bias aligns\nRetest holds'}});assert.equal(s.playbooks.length,playbooksBefore+1);assert.equal(s.playbooks.at(-1).rules.length,2);
submit({id:'risk-form',values:{perTrade:'.4',daily:'1.5',max:'5',losses:'3'}});assert.equal(s.risk.perTrade,.4);assert.equal(s.risk.daily,1.5);
const existingRisk={...s.risk};submit({id:'risk-form',values:{perTrade:'3',daily:'1.5',max:'5',losses:'3'}});assert.deepEqual(s.risk,existingRisk);
submit({id:'connection-form',values:{name:'QA bot',type:'Trading bot / EA',server:'Broker-Demo',login:'123456',currency:'USD'}});assert.equal(s.pendingConnections.length,1);assert(elements.get('overlay-root').innerHTML.includes('No live connection is active'));
const stored=JSON.parse(local.get('edgebook.workspace.v1'));assert.equal(stored.trades.length,s.trades.length);assert.equal(stored.entries.length,s.entries.length);validateBackup({...stored,app:'edgebook',version:1});assert.throws(()=>validateBackup({app:'wrong'}),/supported/);
for(const fn of ['connect','add-trade','add-entry','add-playbook','edit-risk','report','notifications','demo-info','import-csv']){actions[fn]();const html=elements.get('overlay-root').innerHTML;assert(html.includes('role="dialog"'),fn);assert(!html.includes('undefined'),fn);assert(!html.includes('NaN'),fn);fs.writeFileSync(`${output}/modal-${fn}.html`,html);}
fs.writeFileSync(`${output}/actions.json`,JSON.stringify(Object.keys(actions)));
console.log(JSON.stringify({status:'PASS',renderedScreens:screens,trades:originalCount,checked:['account/source/time filters','all 10 pages','5 analytics tabs','empty and one-sided chart samples','CSV required and optional fields','CSV date/time/account/risk errors','multiline CSV quotes','manual trade metric propagation','trade review and execution tabs','journal and habit persistence','playbook creation','risk rule ordering','connection draft save','local storage and backups','all primary modals']}));


// Auth routes gate the workspace, preserve local work, and return to a requested page.
authController.signOut({immediate:true});
assert(elements.get('app').innerHTML.includes('You’re signed out'));
click({nav:'risk'});
assert(elements.get('app').innerHTML.includes('Welcome back.'));
location.hash='#trades';authController.handleRoute();
assert(elements.get('app').innerHTML.includes('Welcome back.'));
authController.client.signIn({email:'trader@edgebook.demo',password:'sample'});
authController.handleRoute();
assert.equal(s.page,'trades');
assert.equal(s.trades.length,originalCount+1);
// A different preview identity gets its own workspace namespace.
authController.signOut({immediate:true});
authController.client.signIn({email:'new@example.com',password:'sample'});
authController.client.completeOnboarding({name:'New Trader',timezone:'UTC',risk:.3});
authController.handleRoute();
assert.equal(s.profile.name,'New Trader');assert.equal(s.trades.length,originalCount);
authController.enterDemo();assert.equal(s.trades.length,originalCount+1);

// Exercise the complete UI controller journey through its actual submit handlers.
const submitAuth=async values=>{const f={...values,reportValidity:()=>true,querySelector:()=>null};for(const fn of handlers.submit)await fn({target:f,preventDefault(){}})};
authController.signOut({immediate:true});click({authRoute:'sign-up'});
await submitAuth({id:'auth-sign-up-form',values:{name:'Taylor',email:'taylor@example.com',password:'Sample-Password123',terms:'on'}});
assert.equal(authController.state.route,'verify-email');assert.equal(authController.client.getSession(),null);
await submitAuth({id:'auth-code-form',values:{code:'246810'}});
assert.equal(authController.state.route,'onboarding');
await submitAuth({id:'auth-onboarding-form',values:{name:'Taylor Morgan',timezone:'UTC',intention:'Understand my trading edge'}});
assert.equal(authController.state.onboardingStep,1);
await submitAuth({id:'auth-onboarding-form',values:{risk:'.4'}});
assert.equal(authController.state.onboardingStep,2);
await submitAuth({id:'auth-onboarding-form',values:{}});
assert(authController.isWorkspaceReady());assert.equal(s.profile.name,'Taylor Morgan');assert.equal(s.profile.timezone,'UTC');assert.equal(s.risk.perTrade,.4);
s.settingsTab='security';click({authAction:'toggle-mfa'});assert(s.authSession.user.mfa);
authController.signOut({immediate:true});
await submitAuth({id:'auth-sign-in-form',values:{email:'taylor@example.com',password:'Sample-Password123'}});
assert.equal(authController.state.route,'mfa');assert.equal(authController.client.getSession(),null);
await submitAuth({id:'auth-code-form',values:{code:'246810'}});assert(authController.isWorkspaceReady());
click({authAction:'expire-session'});assert.equal(authController.state.route,'session-expired');
click({authRoute:'forgot-password'});
await submitAuth({id:'auth-forgot-form',values:{email:'taylor@example.com'}});assert.equal(authController.state.route,'reset-sent');
click({authRoute:'reset-password'});
await submitAuth({id:'auth-reset-password-form',values:{password:'New-Sample-Password123',confirmPassword:'Mismatch'}});
assert(authController.state.errors.confirmPassword);
await submitAuth({id:'auth-reset-password-form',values:{password:'New-Sample-Password123',confirmPassword:'New-Sample-Password123'}});
assert.equal(authController.state.route,'reset-success');assert.equal(authController.client.getSession(),null);
for(const [key,value] of local)assert(!String(value).includes('Sample-Password123'),key);
authController.destroy();
fs.rmSync(output,{recursive:true,force:true});
});
