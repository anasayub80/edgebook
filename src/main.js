/** Application controller: browser state, forms, dialogs, persistence, and UI events. */
import {csvCell,csvKeys,parseImport as parseTradeCsv} from './lib/csv.js';
import {TODAY,accounts,generateTrades,initialPlaybooks,initialEntries,stats,sum,daily,groupBy} from './data/index.js';
import {icon,esc,money,pct,num,dateLabel,signClass,tradeTable,empty,input,selectField,symbolIcon,equityChart} from './components/ui.js';
import {pages,sidebar,topbar,view,setupArt} from './pages/index.js';
const STORAGE='edgebook.workspace.v1';
const defaults={
  trades:generateTrades(),
  entries:initialEntries,
  playbooks:initialPlaybooks,
  risk:{
    perTrade:.5,
    daily:2,
    max:5,
    losses:3
  },
  profile:{
    name:'Anas Ayub',
    timezone:'Asia/Karachi',
    currency:'USD',
    weekStart:'Monday',
    intention:'Protect my capital. Follow my process. Let the results follow.'
  },
  notifications:{
    review:true,
    risk:true,
    insights:true
  },
  habits:[true,true,false,false],
  dailyMood:'Focused',
  pendingConnections:[],
  collapsed:false
};
let saved;
try
{
  saved=JSON.parse(localStorage.getItem(STORAGE)||'null')
}
catch
{
}
const validSaved=saved&&Array.isArray(saved.trades)&&Array.isArray(saved.entries)&&Array.isArray(saved.playbooks);
const s={
  ...structuredClone(defaults),
  ...(validSaved?saved:{
  }),
  profile:{
    ...defaults.profile,
    ...saved?.profile
  },
  risk:{
    ...defaults.risk,
    ...saved?.risk
  },
  notifications:{
    ...defaults.notifications,
    ...saved?.notifications
  },
  page:pages.some(p=>p[0]===location.hash.slice(1))?location.hash.slice(1):'overview',
  period:'30d',
  account:'all',
  source:'all',
  month:TODAY.slice(0,7),
  tradeSearch:'',
  tradeResult:'all',
  tradeSymbol:'all',
  tradeSession:'all',
  tradePage:1,
  analyticsTab:'performance',
  settingsTab:'profile',
  equityMode:'pnl'
};
let focusedBeforeOverlay=null,activeTradeId=null,tradeTab='overview',tempScreenshot=null,importRows=[],toastTimer;
function persist()
{
  const data={
  };
  for(
  const k
  of Object.keys(defaults))
  data[k]=s[k];
  try
  {
    localStorage.setItem(STORAGE,JSON.stringify(data));
    return true
  }
  catch
  {
    toast('Browser storage is full. Export a backup or use a smaller screenshot.');
    return false
  }
}
function fromDate()
{
  if(s.period==='all')
  return s.trades.length?s.trades.reduce((min,t)=>t.date<min?t.date:min,TODAY):TODAY;
  const d=new Date(TODAY+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()-(s.period==='7d'?6:s.period==='30d'?29:89));
  return d.toISOString().slice(0,10)
}
function context()
{
  s.fromDate=fromDate();
  const scopedAll=s.trades.filter(t=>(s.account==='all'||t.account===s.account)&&(s.source==='all'||t.source===s.source)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),rows=scopedAll.filter(t=>t.date>=s.fromDate&&t.date<=TODAY),startBalance=sum(accounts.filter(a=>s.account==='all'||a.id===s.account),'balance');
  return {
    rows,
    scopedAll,
    allTrades:s.trades,
    startBalance,
    openingBalance:startBalance+sum(scopedAll.filter(t=>t.date<s.fromDate))
  };
}
function render({
  focusSearch=false
}={
})
{
  document.body.classList.toggle('collapsed',s.collapsed);
  document.getElementById('app').innerHTML=`${sidebar(s)}<div class="layout">${topbar(s)}<main id="main" class="main" tabindex="-1">${view(s,context())}<footer class="footer"><span>${icon('shield',11)} Your process is your edge. <b>Protect it.</b></span><span>Demo workspace · Sample data through 16 Oct 2026 · Saved in this browser</span></footer></main></div>`;
  document.title=`${pages.find(p=>p[0]===s.page)?.[2]} · Edgebook`;
  if(s.page==='risk')
  calculate();
  if(focusSearch)
  {
    const inp=document.querySelector('[data-input="trade-search"]');
    inp?.focus();
    inp?.setSelectionRange(s.tradeSearch.length,s.tradeSearch.length)
  }
}
function nav(page)
{
  if(!pages.some(p=>p[0]===page))
  return;
  closeOverlay();
  s.page=page;
  document.body.classList.remove('sidebar-open');
  if(location.hash!=='#'+page)
  history.pushState(null,'','#'+page);
  render();
  window.scrollTo({
    top:0,
    behavior:'instant'
  })
}
function toast(message)
{
  clearTimeout(toastTimer);
  document.getElementById('toast-root').innerHTML=`<div class="toast">${icon('checkCircle',16)} ${esc(message)}</div>`;
  toastTimer=setTimeout(()=>document.getElementById('toast-root').innerHTML='',4500)
}
function showOverlay(html)
{
  focusedBeforeOverlay=document.activeElement;
  const root=document.getElementById('overlay-root');
  root.innerHTML=`<div class="overlay">${html}</div>`;
  document.body.style.overflow='hidden';
  document.getElementById('app').setAttribute('inert','');
  setTimeout(()=>
  {
    const focus=root.querySelector('input:not([type="hidden"]),textarea,select');
    (focus||root.querySelector('button'))?.focus()
  }
  ,40)
}
function closeOverlay()
{
  document.getElementById('overlay-root').innerHTML='';
  document.body.style.overflow='';
  document.getElementById('app').removeAttribute('inert');
  document.querySelector('.chart-tip')?.remove();
  focusedBeforeOverlay?.focus?.();
  activeTradeId=null;
  tempScreenshot=null
}
const closeBtn=()=>`<button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close',18)}</button>`;
function modal(title,subtitle,body,footer='',wide=false)
{
  showOverlay(`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><h2 id="dialog-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${closeBtn()}</div><div class="modal-body">${body}</div>${footer?`<div class="modal-foot">${footer}</div>`:''}</section>`)
}
function newTrade()
{
  modal('Capture the decision.','Log a closed trade and the thinking behind it.',`<form id="trade-form" class="form-grid">${selectField('Account','account',accounts.map(a=>[a.id,a.short]),s.account==='all'?'funded':s.account)}${selectField('Trading source','source',['Manual','Bot'],'Manual')}${input('Trade date (UTC)','date',TODAY,'date',`required max="${TODAY}"`)}${input('Entry time (UTC)','time','08:30','time','required')}${input('Instrument','symbol','XAUUSD','text','required maxlength="15" pattern="[A-Za-z0-9._-]+"')}${selectField('Direction','side',['Long','Short'],'Long')}${input('Entry price','entry','2650','number','required min="0.00001" step="any"')}${input('Exit price','exit','2660','number','required min="0.00001" step="any"')}${input('Stop loss price','sl','2645','number','required min="0.00001" step="any"')}${input('Take profit price','tp','2660','number','required min="0.00001" step="any"')}${input('Initial risk ($)','risk','125','number','required min="0.01" step="0.01"')}${input('Net P&L ($) · after costs','pnl','245','number','required step="0.01"')}${input('Commission ($)','commission','5','number','min="0" step="0.01" required')}${input('Swap ($) · signed','swap','0','number','step="0.01" required')}${input('Position size (lots)','volume','0.25','number','required min="0.001" step="0.001"')}${input('Holding time (minutes)','duration','60','number','required min="0" max="43200"')}${selectField('Playbook','strategy',s.playbooks.map(p=>[p.id,p.name]),'sweep')}${selectField('Entry emotion','mood',['Focused','Calm','Anxious','FOMO','Frustrated'],s.dailyMood)}<div class="field full"><label for="f-notes">Trade notes</label><textarea name="notes" id="f-notes" placeholder="What was the setup? What did you do well? What would you change?" maxlength="5000"></textarea></div><label class="checkline" style="grid-column:1/-1"><input name="disciplined" type="checkbox" checked>I followed my trading plan</label><p class="field-help" style="grid-column:1/-1">Session is assigned from UTC entry time. Net P&L is used as entered; commissions are not subtracted twice.</p></form>`,`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" type="submit" form="trade-form">${icon('check',14)} Save trade</button>`,true)
}
function priceSnapshot(t)
{
  const vals=[t.entry,t.exit,t.sl,t.tp].filter(v=>v>0),lo=Math.min(...vals),hi=Math.max(...vals),x=v=>40+(v-lo)/(hi-lo||1)*410;
  const levels=[['Stop loss',t.sl,'#bc9380',45],['Entry',t.entry,'#879573',78],['Exit',t.exit,t.pnl>=0?'#5e8a49':'#ba806a',111],['Target',t.tp,'#a5b98c',144]].filter(l=>l[1]>0);
  return `<div style="background:#f7f9f1;border:1px solid #e7eddd;border-radius:9px;padding:14px;margin:20px 0"><div class="between"><span class="label" style="font-size:8px">Execution levels</span><span class="tiny muted" style="font-size:8px">Recorded prices · not a price chart</span></div><svg viewBox="0 0 500 175" role="img" aria-label="Trade execution price levels">${levels.map(([l,v,color,y])=>`<line x1="40" x2="450" y1="${y}" y2="${y}" stroke="#e3e9da"/><circle cx="${x(v)}" cy="${y}" r="4" fill="${color}"/><text x="2" y="${y-10}" fill="${color}" font-size="9" font-family="sans-serif">${l}</text><text x="498" y="${y-10}" text-anchor="end" fill="${color}" font-size="9" font-family="sans-serif">${v}</text>`).join('')}</svg></div>`;
}
function tradeDrawer(id,tab='overview')
{
  const t=s.trades.find(t=>t.id===id);
  if(!t)
  return;
  activeTradeId=id;
  tradeTab=tab;
  const a=accounts.find(a=>a.id===t.account),p=s.playbooks.find(p=>p.id===t.strategy);
  const exitDate=new Date(new Date(`${t.date}T${t.time}:00Z`).getTime()+t.duration*60000);
  const body=tab==='overview'?`${priceSnapshot(t)}<div class="detail-grid">${[['Account',a?.name||t.account],['Setup',p?.name||'Custom'],['Source',t.source],['Initial risk',money(t.risk)],['Position size',`${t.volume} lots`],['Holding time',`${t.duration} min`],['Gross P&L',money(t.gross,true)],['Commission',money(-t.commission)],['Swap',money(t.swap,true)]].map(([l,v])=>`<div><small>${l}</small><strong>${esc(v)}</strong></div>`).join('')}</div><div class="detail-section"><div class="between"><h3>The decision behind the trade</h3><span class="pill ${t.disciplined?'':'red'}">${t.disciplined?'Plan followed':'Rule broken'}</span></div><p class="small muted" style="line-height:1.9;white-space:pre-wrap">${esc(t.notes||'No notes yet. Add your observations in the Review tab.')}</p><div class="flex gap8 wrap" style="margin-top:16px">${t.tags.map(tag=>`<span class="pill neutral">${esc(tag)}</span>`).join('')}<span class="pill neutral">${esc(t.mood)}</span></div></div>${t.screenshot?`<div class="detail-section"><h3>Chart attachment</h3><img class="screenshot-preview" src="${safeImage(t.screenshot)}" alt="Trade chart screenshot"></div>`:''}<div class="focus-card"><div class="eyebrow">The review prompt</div><p>Would you take this exact trade again, with the same information?</p></div>`:tab==='review'?`<form id="review-form" class="form-grid">${selectField('Entry emotion','mood',['Focused','Calm','Anxious','FOMO','Frustrated'],t.mood)}${selectField('Execution quality','rating',[[1,'1 · Poor process'],[2,'2 · Needs work'],[3,'3 · Acceptable'],[4,'4 · Well executed'],[5,'5 · A+ execution']].map(([v,l])=>[String(v),l]),String(t.rating))}<div class="field full"><label for="f-review-notes">What can you learn from this decision?</label><textarea name="notes" id="f-review-notes" style="min-height:160px" maxlength="5000" placeholder="Setup quality, entry timing, trade management, lessons…">${esc(t.notes)}</textarea></div><div class="field full"><label for="f-review-tags">Tags · comma separated</label><input name="tags" id="f-review-tags" value="${esc(t.tags.join(', '))}" maxlength="300" placeholder="Plan followed, Early entry, News"></div><label class="checkline field full" style="flex-direction:row"><input name="disciplined" type="checkbox" ${t.disciplined?'checked':''}>This trade followed my trading plan</label><div class="field full"><label for="trade-screenshot">Attach a chart screenshot</label><input id="trade-screenshot" type="file" accept="image/png,image/jpeg,image/webp" data-upload="trade-screenshot"><span class="field-help">PNG, JPG or WebP · up to 1.5 MB · stored in this browser</span><div id="screenshot-preview">${t.screenshot?`<img class="screenshot-preview" src="${safeImage(t.screenshot)}" alt="Attached trade chart"><button type="button" class="text-btn" data-action="remove-screenshot">Remove attachment</button>`:''}</div></div></form>`:`<div class="notice">${icon('info',15)}<span>Closed-trade execution summary. Detailed broker deals and fills will be added with MT5 sync.</span></div><div class="execution-line"><span class="line-icon">${icon('plus',13)}</span><div><h4>Position opened · ${t.side}</h4><p>${dateLabel(t.date)} at ${t.time} UTC · ${t.volume} lots at ${t.entry}</p></div></div><div class="execution-line"><span class="line-icon">${icon('shield',13)}</span><div><h4>Initial risk defined</h4><p>Stop loss ${t.sl} · Target ${t.tp} · Risk ${money(t.risk)}</p></div></div><div class="execution-line"><span class="line-icon">${icon('check',13)}</span><div><h4>Position closed</h4><p>${exitDate.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})} at ${exitDate.toISOString().slice(11,16)} UTC · Exit ${t.exit}</p></div></div><div class="execution-line"><span class="line-icon">${icon('wallet',13)}</span><div><h4>Net result · ${money(t.pnl,true)}</h4><p>Gross ${money(t.gross,true)} − Commission ${money(t.commission)} + Swap ${money(t.swap,true)}</p></div></div>`;
  showOverlay(`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><span class="eyebrow" style="font-size:8px">TRADE #${esc(id)}</span><h2 id="dialog-title" style="margin-top:6px">The trade review</h2><p>${dateLabel(t.date,{weekday:'short',month:'short',day:'numeric',year:'numeric'})} · ${esc(t.session)} session</p></div>${closeBtn()}</div><div class="modal-body"><div class="trade-hero"><div class="flex gap12">${symbolIcon(t.symbol)}<div><h2>${esc(t.symbol)}</h2><span class="side-tag ${t.side==='Short'?'short':''}">${t.side} · ${t.source}</span></div></div><div style="text-align:right"><div class="pnl money ${signClass(t.pnl)}">${money(t.pnl,true)}</div><span class="tiny muted">${num(t.r)}R · ${t.reviewed?'Reviewed':'Awaiting review'}</span></div></div><div class="tabs">${[['overview','Overview'],['review','Review & notes'],['execution','Execution']].map(([v,l])=>`<button data-trade-tab="${v}" class="${tab===v?'active':''}">${l}</button>`).join('')}</div>${body}</div><div class="modal-foot">${tab==='review'?`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" type="submit" form="review-form">${icon('check',14)} Save review</button>`:`<button class="btn btn-ghost btn-danger" data-delete-trade="${esc(id)}">${icon('trash',13)} Delete</button><span class="spacer"></span><button class="btn btn-primary" data-trade-tab="review">${icon('edit',13)} ${t.reviewed?'Edit review':'Review trade'}</button>`}</div></section>`);
  activeTradeId=id;
  tempScreenshot=t.screenshot||null;
}
const safeImage=v=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v||'')?v:'';
function journalForm(id)
{
  const e=s.entries.find(e=>e.id===id);
  modal(e?'Refine your reflection.':'Make room for reflection.','A few honest sentences can change your next session.',`<form id="journal-form" data-id="${esc(id||'')}" class="form-grid">${input('Date','date',e?.date||TODAY,'date',`required max="${TODAY}"`)}${selectField('How did you feel?','mood',['Focused','Calm','Anxious','FOMO','Frustrated'],e?.mood||s.dailyMood)}<div class="field full"><label for="f-title">Give your reflection a title</label><input id="f-title" name="title" required maxlength="120" placeholder="What did today teach you?" value="${esc(e?.title||'')}"></div><div class="field full"><label for="f-content">Your reflection</label><textarea name="content" id="f-content" required maxlength="10000" style="min-height:180px" placeholder="What worked? What challenged you? What is one thing you’ll carry into tomorrow?">${esc(e?.content||'')}</textarea></div>${selectField('Energy level','energy',[[1,'1 · Low'],[2,'2 · Below average'],[3,'3 · Steady'],[4,'4 · Good'],[5,'5 · Excellent']].map(([v,l])=>[String(v),l]),String(e?.energy||4))}${input('Tags · comma separated','tags',e?.tags.join(', ')||'','text','maxlength="300"')}</form>`,`${e?`<button class="btn btn-ghost btn-danger" data-delete-entry="${esc(e.id)}">Delete</button><span class="spacer"></span>`:''}<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" form="journal-form" type="submit">Save reflection ${icon('check',13)}</button>`)
}
function playbookForm(id)
{
  const p=s.playbooks.find(p=>p.id===id);
  modal(p?'Make the rules your own.':'Define your next edge.','A good setup is one you can describe, repeat, and review.',`<form id="playbook-form" data-id="${esc(id||'')}" class="form-grid"><div class="field full"><label for="f-playbook-name">Playbook name</label><input id="f-playbook-name" name="name" required maxlength="70" placeholder="e.g. London liquidity sweep" value="${esc(p?.name||'')}"></div>${selectField('Execution','type',['Manual','Bot'],p?.type||'Manual')}${input('Timeframe','timeframe',p?.timeframe||'1H → 5M','text','required maxlength="30"')}${input('Instruments','symbols',p?.symbols||'XAUUSD, GBPUSD','text','maxlength="150"')}${input('Maximum risk (%)','risk',p?.risk||s.risk.perTrade,'number','required min="0.01" max="100" step="0.01"')}<div class="field full"><label for="f-playbook-description">Describe the setup</label><textarea name="description" id="f-playbook-description" required maxlength="1000">${esc(p?.description||'')}</textarea></div><div class="field full"><label for="f-rules">Entry and management rules · one per line</label><textarea name="rules" id="f-rules" required maxlength="3000" style="min-height:160px" placeholder="Higher timeframe bias aligns\nWait for confirmation\nDefine invalidation before entry">${esc(p?.rules.join('\n')||'')}</textarea></div></form>`,`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" form="playbook-form" type="submit">${icon('check',13)} Save playbook</button>`)
}
function showPlaybook(id)
{
  const p=s.playbooks.find(p=>p.id===id);
  if(!p)
  return;
  const rows=context().rows.filter(t=>t.strategy===id),st=stats(rows);
  modal(esc(p.name),`${esc(p.type)} · ${esc(p.timeframe)} · ${esc(p.symbols)}`,`<div style="background:${esc(p.color)};border-radius:10px;padding:15px;display:flex;align-items:center;justify-content:space-between;margin-bottom:22px"><div><span class="label" style="color:#6e8658">The setup</span><p class="small" style="line-height:1.9;color:#678050;max-width:330px;margin-top:8px">${esc(p.description)}</p></div><div style="width:130px">${setupArt()}</div></div><div class="detail-grid"><div><small>Net P&L · selected period</small><strong class="${signClass(st.pnl)}">${money(st.pnl,true)}</strong></div><div><small>Win rate</small><strong>${pct(st.winRate)}</strong></div><div><small>Trades</small><strong>${rows.length}</strong></div></div><div class="detail-section"><h3>The rules of engagement</h3><div class="checklist">${p.rules.map((r,i)=>`<div class="flex gap12"><span class="step-num">${i+1}</span><span class="small muted">${esc(r)}</span></div>`).join('')}</div></div><div class="notice" style="margin-top:24px">${icon('shield',16)}<span>Maximum risk: ${p.risk}% per trade. Follow the account’s loss boundaries even when this setup appears.</span></div>`,`<button class="btn" data-filter-strategy="${esc(id)}">View trades ${icon('arrow',12)}</button><button class="btn btn-primary" data-edit-playbook="${esc(id)}">${icon('edit',13)} Edit playbook</button>`,true)
}
function riskForm()
{
  modal('Set your boundaries.','Make these decisions before the next trade.',`<form id="risk-form" class="form-grid">${input('Risk per trade (%)','perTrade',s.risk.perTrade,'number','required min="0.01" max="100" step="0.01"')}${input('Daily loss limit (%)','daily',s.risk.daily,'number','required min="0.1" max="100" step="0.1"')}${input('Max drawdown boundary (%)','max',s.risk.max,'number','required min="0.1" max="100" step="0.1"')}${input('Pause after consecutive losses','losses',s.risk.losses,'number','required min="1" max="20" step="1"')}<div class="notice" style="grid-column:1/-1">${icon('info',15)}<span>Percentages use the selected accounts’ starting capital. These are planning rules in this preview; no MT5 orders are changed.</span></div></form>`,`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" form="risk-form" type="submit">${icon('shield',13)} Save risk rules</button>`)
}
function calculate()
{
  const f=document.getElementById('calculator');
  if(!f)
  return;
  const data=Object.fromEntries(new FormData(f)),bal=+data.calcBalance,risk=+data.calcRisk,entry=+data.calcEntry,stop=+data.calcStop,contract=+data.calcContract,rr=+data.calcRR;
  const out=document.getElementById('calc-result');
  if(!(bal>0&&risk>0&&risk<=100&&entry>0&&stop>0&&entry!==stop&&contract>0&&rr>0))
  {
    out.innerHTML='<span class="small">Enter valid values and a stop different from entry.</span>';
    return
  }
  const dollarRisk=bal*risk/100,size=dollarRisk/(Math.abs(entry-stop)*contract),lot=Math.floor(size*100)/100,tp=entry+(entry>stop?1:-1)*Math.abs(entry-stop)*rr;
  out.innerHTML=`<div class="eyebrow">PLANNED POSITION SIZE</div><strong>${lot.toFixed(2)} <span style="font-size:13px;font-weight:500;color:#91a776">lots</span></strong><div class="between small" style="margin-top:15px;color:#8ca375"><span>Risk budget <b style="color:#607e47">${money(dollarRisk)}</b></span><span>Target <b style="color:#607e47">${money(dollarRisk*rr)}</b></span></div><div class="between tiny muted" style="margin-top:8px"><span>Target price ${Number(tp.toFixed(5))}</span><span>Rounded down to 0.01 lots</span></div>${lot===0?'<p class="small negative" style="margin-top:10px">Calculated size is below a 0.01 lot step.</p>':''}`
}
function dayDrawer(date)
{
  const rows=context().scopedAll.filter(t=>t.date===date),st=stats(rows);
  showOverlay(`<section class="drawer" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><span class="eyebrow">DAILY REVIEW</span><h2 id="dialog-title" style="margin-top:8px">${dateLabel(date,{weekday:'long',month:'long',day:'numeric'})}</h2><p>${rows.length} closed trades · UTC calendar day</p></div>${closeBtn()}</div><div class="modal-body"><div class="trade-hero"><div><span class="label">Net result</span><div class="pnl money ${signClass(st.pnl)}" style="margin-top:8px">${money(st.pnl,true)}</div></div><span class="pill ${st.pnl<0?'red':''}">${rows.length?st.pnl>=0?'Green day':'Red day':'No trades'}</span></div><div class="detail-grid"><div><small>Winning trades</small><strong>${st.wins}</strong></div><div><small>Losing trades</small><strong>${st.losses}</strong></div><div><small>Plan adherence</small><strong>${pct(st.discipline,0)}</strong></div></div>${tradeTable(rows,{playbooks:s.playbooks,timezone:s.profile.timezone})}<div class="focus-card"><div class="eyebrow">Today’s lesson</div><p>Which decision would you repeat? Which one would you change?</p></div>${s.entries.filter(e=>e.date===date).map(e=>`<article class="journal-entry" style="padding:20px 0"><h2>${esc(e.title)}</h2><p>${esc(e.content)}</p></article>`).join('')}</div><div class="modal-foot"><button class="btn btn-primary" data-journal-date="${date}">${icon('edit',13)} Add daily reflection</button></div></section>`)
}
function report()
{
  const c=context();
  let reportStart=s.fromDate,reportEnd=TODAY;
  if(s.page==='calendar')
  {
    c.rows=c.scopedAll.filter(t=>t.date.startsWith(s.month));
    reportStart=s.month+'-01';
    const [y,m]=s.month.split('-').map(Number);
    reportEnd=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
    if(reportEnd>TODAY&&s.month===TODAY.slice(0,7))
    reportEnd=TODAY;
  }
  const st=stats(c.rows),ds=daily(c.rows);
  modal('Your performance, in perspective.',`${dateLabel(reportStart)} – ${dateLabel(reportEnd,{month:'short',day:'numeric',year:'numeric'})} · ${s.account==='all'?'All accounts':esc(accounts.find(a=>a.id===s.account)?.name)}`,`<div class="notice">${icon('info',15)}<span>Design preview report · illustrative demo trades and any entries added in this browser.</span></div><div class="report-section"><span class="eyebrow">THE RESULTS</span><div class="detail-grid">${[['Net P&L',money(st.pnl,true)],['Win rate',pct(st.winRate)],['Profit factor',num(st.pf)],['Trades',st.total],['Max drawdown',money(st.drawdown)],['Expectancy',money(st.expectancy)]].map(([k,v])=>`<div><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>${equityChart(c.rows)}</div><div class="report-section"><h3>The process</h3><p>${pct(st.discipline,0)} plan adherence across ${st.total} trades. ${ds.filter(d=>d.pnl>0).length} profitable days and ${ds.filter(d=>d.pnl<0).length} losing days. Total commissions: ${money(st.commission)}. Average net return: ${num(st.avgR)}R per trade.</p></div><div class="report-section"><h3>A question for your next session</h3><p>What is one behavior you can repeat more consistently, regardless of the next trade’s outcome?</p></div>`,`<button class="btn" data-action="export-csv">${icon('download',13)} Trades CSV</button><button class="btn btn-primary" data-action="print-report">${icon('file',13)} Print / Save PDF</button>`,true)
}
function connection(step=1)
{
  if(step===1)
  {
    modal('Bring your trading together.','Choose how you’d like to add trades to your workspace.',`<div class="setup-progress"><div class="active"></div><div></div><div></div></div><div class="notice">${icon('info',15)}<span>This is the connection design preview. Live MT5 sync will be implemented in the backend phase.</span></div><button class="choice-card" data-connection-step="2">${icon('plug',25)}<div><h3>MetaTrader 5 account</h3><p>Manual trading account or Expert Advisor activity</p></div>${icon('chevron',16)}</button><button class="choice-card" data-action="import-csv">${icon('file',25)}<div><h3>CSV trade history</h3><p>Import closed trades using the journal template</p></div>${icon('chevron',16)}</button><button class="choice-card" data-action="add-trade">${icon('edit',25)}<div><h3>Manual trade entry</h3><p>Add the trade, the result, and your reasoning</p></div>${icon('chevron',16)}</button>`);
    return
  }
  modal('Set up your MT5 workspace.','Save a connection draft. No credentials required.',`<div class="setup-progress"><div class="active"></div><div class="active"></div><div></div></div><form id="connection-form" class="form-grid"><div class="field full"><label for="f-connection-name">Account nickname</label><input id="f-connection-name" name="name" required maxlength="60" placeholder="e.g. My funded account"></div>${selectField('Account activity','type',['Manual trading','Trading bot / EA','Mixed activity'],'Manual trading')}${input('Broker server name','server','','text','required maxlength="100" placeholder="e.g. Broker-Demo"')}${input('Account login / demo number','login','','text','required maxlength="30" pattern="[0-9]+" placeholder="Demo account number"')}${selectField('Account currency','currency',['USD'],'USD')}<div class="notice" style="grid-column:1/-1">${icon('lock',16)}<span>No passwords are collected. Your broker is not contacted. The next phase will add a secure read-only MT5 sync method and server-side storage.</span></div></form>`,`<button class="btn" data-connection-step="1">Back</button><button class="btn btn-primary" form="connection-form" type="submit">Save connection draft ${icon('arrow',13)}</button>`)
}
function accountDetail(id)
{
  const a=accounts.find(a=>a.id===id);
  modal(esc(a.name),'Sample account · MT5 connection design',`<div class="detail-grid"><div><small>Broker</small><strong>${esc(a.broker)}</strong></div><div><small>Account number</small><strong>••••${a.number.slice(-4)}</strong></div><div><small>Trading activity</small><strong>${a.type}</strong></div><div><small>Starting capital</small><strong>${money(a.balance)}</strong></div><div><small>Currency</small><strong>USD</strong></div><div><small>Connection</small><strong>Demo data only</strong></div></div><div class="notice">${icon('info',16)}<span>This account contains sample trades. No broker connection is active. Save a connection draft to plan your own MT5 integration.</span></div>`,`<button class="btn" data-account-card="${id}">View equity ${icon('arrow',12)}</button><button class="btn btn-primary" data-action="connect">Set up connection</button>`)
}
function confirmDialog(title,body,action)
{
  modal(title,'This changes your browser workspace.',`<p class="small muted" style="line-height:1.9">${body}</p>`,`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" data-action="${action}">Confirm</button>`)
}
function demoInfo()
{
  modal('A clearer view of your edge.','Edgebook · Interactive UI/UX preview',`<div class="stack"><p class="small muted" style="line-height:2">Explore a complete journal experience with three sample MT5 accounts. Account and time filters, analytics, calendar drilldowns, trade reviews, playbooks, position sizing, and journal entries are interactive.</p><div class="notice">${icon('lock',16)}<span>Changes are saved in this browser. MT5 is not connected. No broker passwords are requested and no trades are executed.</span></div><div><h3>Designed for the next phase</h3><p class="small muted" style="line-height:2;margin-top:8px">Secure MT5 synchronization, floating equity, broker deals, backend storage, account access, and server-side risk alerts.</p></div><button class="btn" data-nav="connections">Explore connection setup ${icon('arrow',13)}</button></div>`)
}
function notifications()
{
  const c=context(),st=stats(c.rows),notices=[];
  if(s.notifications.review&&!s.habits[3])
  notices.push(['book','Close the review loop.',`${c.rows.filter(t=>!t.reviewed).length} trades are waiting for a review.`,'trades']);
  if(s.notifications.insights)
  {
    const best=Object.entries(groupBy(c.rows,'session')).sort((a,b)=>sum(b[1])-sum(a[1]))[0];
    if(best)
    notices.push(['spark',`${best[0]} leads this period.`,`${money(sum(best[1]),true)} net P&L across ${best[1].length} trades.`,'analytics']);
  }
  if(s.notifications.risk)
  {
    const loss=Math.max(0,-sum(c.scopedAll.filter(t=>t.date===TODAY)));
    if(loss>=c.startBalance*s.risk.daily/100)
    notices.push(['shield','Daily loss boundary reached.',`Today’s realized loss is ${money(loss)}. Review your limits.`,'risk']);
  }
  modal('A few things worth your attention.','In-app updates from your demo workspace.',notices.length?notices.map(([ico,title,desc,page])=>`<button class="choice-card" data-nav="${page}">${icon(ico,22)}<div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>${icon('chevron',14)}</button>`).join(''):empty('You’re all caught up.','Update your notification preferences in Settings.','bell'))
}
function searchDialog()
{
  showOverlay(`<section class="modal" role="dialog" aria-modal="true" aria-label="Search workspace"><div class="search-box">${icon('search',19)}<input id="command-search" placeholder="Search pages, instruments, or trade notes…" autocomplete="off" aria-label="Search workspace">${closeBtn()}</div><div id="command-results" class="command-results"></div><div class="panel-foot"><span>Navigate your workspace</span><span>Esc to close · Enter to open first result</span></div></section>`);
  updateSearch('')
}
function updateSearch(q)
{
  q=q.toLowerCase().trim();
  const pageResults=pages.filter(p=>p[2].toLowerCase().includes(q)),trades=q?s.trades.filter(t=>[t.symbol,t.notes,t.id].join(' ').toLowerCase().includes(q)).reverse().slice(0,5):[];
  document.getElementById('command-results').innerHTML=pageResults.map(([id,ico,label])=>`<button class="command-result" data-nav="${id}">${icon(ico,17)}<span>${label}</span><span>Go to page ${icon('arrow',12)}</span></button>`).join('')+trades.map(t=>`<button class="command-result" data-trade="${esc(t.id)}">${icon('trades',17)}<span>${esc(t.symbol)} · ${dateLabel(t.date)}</span><span class="${signClass(t.pnl)}">${money(t.pnl,true)}</span></button>`).join('')||empty('No matches yet.','Try a page name, instrument, or trade note.','search')
}
function download(content,type,name)
{
  const url=URL.createObjectURL(new Blob([content],{
    type
  })),a=document.createElement('a');
  a.href=url;
  a.download=name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function exportCSV(all=false)
{
  const c=context();
  let rows=all?s.trades:c.rows;
  if(s.page==='trades'&&!all)
  rows=rows.filter(t=>(s.tradeResult==='all'||(s.tradeResult==='wins'?t.pnl>0:s.tradeResult==='losses'?t.pnl<0:!t.reviewed))&&(s.tradeSymbol==='all'||t.symbol===s.tradeSymbol)&&(s.tradeSession==='all'||t.session===s.tradeSession)&&(!s.tradeSearch||[t.symbol,t.session,s.playbooks.find(p=>p.id===t.strategy)?.name,t.notes,t.id].join(' ').toLowerCase().includes(s.tradeSearch.toLowerCase())));
  download('\uFEFF'+csvKeys.join(',')+'\r\n'+rows.map(t=>csvKeys.map(k=>csvCell(t[k])).join(',')).join('\r\n'),'text/csv;charset=utf-8',`edgebook-trades-${TODAY}.csv`);
  toast(`${rows.length} trades exported`)
}
function importDialog()
{
  importRows=[];
  modal('Give your history a home.','Import closed trades into this browser workspace.',`<div class="notice">${icon('file',16)}<span>Use the Edgebook CSV template. Required columns: date, time, account, symbol, side, pnl, risk. Account IDs: funded, nova, personal. Dates use YYYY-MM-DD and times use UTC HH:mm.</span></div><button class="text-btn" data-action="csv-template" style="margin:15px 0">${icon('download',13)} Download CSV template</button><label class="upload-zone" for="csv-file">${icon('cloud',28)}<strong>Choose your trade history</strong><p>CSV file · up to 2 MB / 2,000 trades</p><input id="csv-file" type="file" accept=".csv,text/csv" data-upload="csv"></label><div id="import-preview" style="margin-top:15px"></div>`,`<button class="btn" data-action="close">Cancel</button><button class="btn btn-primary" id="import-confirm" data-action="confirm-import" disabled>Import trades</button>`,true)
}
function restoreDialog()
{
  modal('Restore your workspace.','Import a backup exported by Edgebook.',`<p class="small muted" style="line-height:1.9;margin-bottom:18px">This replaces your current browser workspace with the trades, journal, rules, and settings from your backup. Export your current workspace first if you want to keep it.</p><label class="upload-zone">${icon('refresh',26)}<strong>Select an Edgebook backup</strong><input type="file" accept=".json,application/json" data-upload="restore"></label><div id="restore-status" style="margin-top:15px"></div>`,`<button class="btn" data-action="backup">Export current backup</button><button class="btn" data-action="close">Cancel</button>`)
}
let pendingRestore=null;
function saveSettings()
{
  const f=document.getElementById('settings-form');
  if(f)
  {
    if(!f.reportValidity())
    return;
    s.profile={
      ...s.profile,
      ...Object.fromEntries(new FormData(f))
    };
    persist();
    render();
    toast('Your preferences are saved')
  }
  else
  {
    persist();
    toast('Your preferences are saved')
  }
}
const actions={
  close:closeOverlay,
  collapse:()=>
  {
    s.collapsed=!s.collapsed;
    persist();
    render()
  }
  ,
  'mobile-menu':()=>document.body.classList.add('sidebar-open'),
  'mobile-close':()=>document.body.classList.remove('sidebar-open'),
  'add-trade':newTrade,
  'add-entry':()=>journalForm(),
  'add-playbook':()=>playbookForm(),
  'edit-risk':riskForm,
  report,
  'weekly-review':report,
  connect:()=>connection(1),
  'add-account':()=>connection(1),
  'import-csv':importDialog,
  search:searchDialog,
  notifications,
  'demo-info':demoInfo,
  'calendar-today':()=>
  {
    s.month=TODAY.slice(0,7);
    render()
  }
  ,
  'save-settings':saveSettings,
  'export-csv':()=>exportCSV(false),
  'export-all':()=>exportCSV(true),
  'print-report':()=>window.print(),
  'review-pending':()=>
  {
    s.tradeResult='unreviewed';
    nav('trades')
  }
  ,
  backup:()=>
  {
    const out={
      app:'edgebook',
      version:1,
      exportedAt:new Date().toISOString()
    };
    for(
    const k
    of Object.keys(defaults))
    out[k]=s[k];
    download(JSON.stringify(out,null,2),'application/json',`edgebook-backup-${TODAY}.json`);
    toast('Workspace backup downloaded')
  }
  ,
  restore:restoreDialog,
  reset:()=>confirmDialog('Start fresh with the demo?','Your added trades, reflections, attachments, rules, and preferences will be removed from this browser. Export a backup first if you need them.','reset-confirm'),
  'reset-confirm':()=>
  {
    try
    {
      localStorage.removeItem(STORAGE)
    }
    catch
    {
    }
    Object.assign(s,structuredClone(defaults));
    closeOverlay();
    render();
    toast('Demo workspace restored')
  }
  ,
  'remove-screenshot':()=>
  {
    tempScreenshot=null;
    document.getElementById('screenshot-preview').innerHTML='';
    toast('Attachment removed. Save the review to apply.')
  }
  ,
  'confirm-import':()=>
  {
    if(!importRows.length)
    return;
    s.trades.push(...importRows);
    s.trades.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    if(!persist())
    {
      s.trades=s.trades.filter(t=>!importRows.includes(t));
      return
    }
    const n=importRows.length;
    importRows=[];
    closeOverlay();
    s.period='all';
    s.tradeResult='all';
    s.tradeSymbol='all';
    s.tradeSession='all';
    s.tradeSearch='';
    s.tradePage=1;
    s.account='all';
    s.source='all';
    nav('trades');
    toast(`${n} trades imported into your workspace`)
  }
  ,
  'csv-template':()=>
  {
    const example={
      date:TODAY,
      time:'08:30',
      account:'funded',
      symbol:'XAUUSD',
      side:'Long',
      source:'Manual',
      session:'London',
      strategy:'sweep',
      entry:2650,
      exit:2670,
      sl:2640,
      tp:2670,
      volume:.25,
      risk:250,
      pnl:495,
      commission:5,
      swap:0,
      duration:60,
      mood:'Focused',
      disciplined:true,
      notes:'Clean sweep and confirmed retest.'
    };
    download(csvKeys.join(',')+'\r\n'+csvKeys.map(k=>csvCell(example[k])).join(','),'text/csv;charset=utf-8','edgebook-import-template.csv')
  }
  ,
  'restore-confirm':()=>
  {
    if(!pendingRestore)
    return;
    const previous={
    };
    for(
    const k
    of Object.keys(defaults))
    {
      previous[k]=s[k];
      s[k]=pendingRestore[k]
    }
    if(!persist())
    {
      Object.assign(s,previous);
      return
    }
    pendingRestore=null;
    closeOverlay();
    render();
    toast('Workspace restored from your backup')
  }
  ,
  'delete-trade-confirm':()=>
  {
    const id=document.getElementById('dialog-delete-id')?.value;
    if(!id)
    return;
    s.trades=s.trades.filter(t=>t.id!==id);
    persist();
    closeOverlay();
    render();
    toast('Trade deleted')
  }
  ,
  'delete-entry-confirm':()=>
  {
    const id=document.getElementById('dialog-delete-id')?.value;
    if(!id)
    return;
    s.entries=s.entries.filter(e=>e.id!==id);
    persist();
    closeOverlay();
    render();
    toast('Reflection deleted')
  }
};
document.addEventListener('click',e=>
{
  const el=e.target.closest('button,a,[data-trade],[data-day],.overlay');
  if(!el)
  return;
  if(el.classList.contains('overlay')&&e.target===el)
  {
    closeOverlay();
    return
  }
  if(el.dataset.nav)
  {
    e.preventDefault();
    if(el.dataset.setTab)
    s.analyticsTab=el.dataset.setTab;
    nav(el.dataset.nav);
    return
  }
  if(el.dataset.action)
  {
    actions[el.dataset.action]?.();
    return
  }
  if(el.dataset.period)
  {
    s.period=el.dataset.period;
    s.tradePage=1;
    render();
    return
  }
  if(el.dataset.trade)
  {
    tradeDrawer(el.dataset.trade);
    return
  }
  if(el.dataset.tradeTab)
  {
    tradeDrawer(activeTradeId,el.dataset.tradeTab);
    return
  }
  if(el.dataset.analysisTab)
  {
    s.analyticsTab=el.dataset.analysisTab;
    render();
    return
  }
  if(el.dataset.equityMode)
  {
    s.equityMode=el.dataset.equityMode;
    render();
    return
  }
  if(el.dataset.monthShift)
  {
    const [y,m]=s.month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+Number(el.dataset.monthShift),1));
    s.month=d.toISOString().slice(0,7);
    render();
    return
  }
  if(el.dataset.day)
  {
    dayDrawer(el.dataset.day);
    return
  }
  if(el.dataset.pageNumber)
  {
    s.tradePage=+el.dataset.pageNumber;
    render();
    document.querySelector('.table-toolbar')?.scrollIntoView({
      block:'nearest'
    });
    return
  }
  if(el.dataset.accountCard)
  {
    s.account=s.account===el.dataset.accountCard?'all':el.dataset.accountCard;
    nav('equity');
    return
  }
  if(el.dataset.accountDetail)
  {
    accountDetail(el.dataset.accountDetail);
    return
  }
  if(el.dataset.playbook)
  {
    showPlaybook(el.dataset.playbook);
    return
  }
  if(el.dataset.editPlaybook)
  {
    playbookForm(el.dataset.editPlaybook);
    return
  }
  if(el.dataset.filterStrategy)
  {
    s.tradeSearch=s.playbooks.find(p=>p.id===el.dataset.filterStrategy)?.name||'';
    s.tradeResult='all';
    s.tradeSymbol='all';
    s.tradeSession='all';
    s.tradePage=1;
    nav('trades');
    return
  }
  if(el.dataset.editEntry)
  {
    journalForm(el.dataset.editEntry);
    return
  }
  if(el.dataset.journalDate)
  {
    const date=el.dataset.journalDate;
    journalForm();
    document.querySelector('#journal-form [name="date"]').value=date;
    return
  }
  if(el.dataset.mood)
  {
    s.dailyMood=el.dataset.mood;
    persist();
    render();
    toast(`Today’s check-in: ${s.dailyMood}`);
    return
  }
  if(el.dataset.settingsTab)
  {
    savePendingSettings();
    s.settingsTab=el.dataset.settingsTab;
    render();
    return
  }
  if(el.dataset.toggleSetting)
  {
    s.notifications[el.dataset.toggleSetting]=!s.notifications[el.dataset.toggleSetting];
    persist();
    render();
    return
  }
  if(el.dataset.connectionStep)
  {
    connection(+el.dataset.connectionStep);
    return
  }
  if(el.dataset.removeConnection)
  {
    s.pendingConnections=s.pendingConnections.filter(a=>a.id!==el.dataset.removeConnection);
    persist();
    render();
    toast('Connection draft removed');
    return
  }
  if(el.dataset.deleteTrade||el.dataset.deleteEntry)
  {
    const isTrade=!!el.dataset.deleteTrade,id=el.dataset.deleteTrade||el.dataset.deleteEntry;
    confirmDialog(isTrade?'Delete this trade?':'Delete this reflection?',isTrade?'This trade and its review will be removed. Your analytics will update immediately.':'This journal entry will be removed from your workspace.',isTrade?'delete-trade-confirm':'delete-entry-confirm');
    document.querySelector('.modal-body').insertAdjacentHTML('beforeend',`<input type="hidden" id="dialog-delete-id" value="${esc(id)}">`);
    return
  }
}
);
function savePendingSettings()
{
  const f=document.getElementById('settings-form');
  if(f&&f.checkValidity())
  {
    s.profile={
      ...s.profile,
      ...Object.fromEntries(new FormData(f))
    };
    persist()
  }
}
document.addEventListener('change',async e=>
{
  const el=e.target;
  if(el.dataset.filter)
  {
    s[el.dataset.filter]=el.value;
    s.tradePage=1;
    render();
    return
  }
  if(el.dataset.habit!==undefined)
  {
    s.habits[+el.dataset.habit]=el.checked;
    persist();
    render();
    return
  }
  if(el.dataset.upload==='trade-screenshot')
  {
    const file=el.files[0];
    if(!file)
    return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1500000)
    {
      toast('Choose a PNG, JPG or WebP under 1.5 MB.');
      el.value='';
      return
    }
    const reader=new FileReader();
    reader.onload=()=>
    {
      tempScreenshot=reader.result;
      document.getElementById('screenshot-preview').innerHTML=`<img class="screenshot-preview" src="${safeImage(tempScreenshot)}" alt="Trade screenshot preview"><button type="button" class="text-btn" data-action="remove-screenshot">Remove attachment</button>`
    }
    ;
    reader.readAsDataURL(file);
    return
  }
  if(el.dataset.upload==='csv')
  {
    const file=el.files[0];
    if(!file)
    return;
    const out=document.getElementById('import-preview'),confirm=document.getElementById('import-confirm');
    try
    {
      if(file.size>2000000)
      throw Error('File is larger than 2 MB.');
      importRows=parseImport(await file.text());
      out.innerHTML=`<div class="notice">${icon('checkCircle',16)}<span>${importRows.length} trades validated · Net P&L ${money(sum(importRows),true)}. Import will add these trades; existing trades remain.</span></div>${tradeTable(importRows.slice(0,3),{playbooks:s.playbooks,timezone:s.profile.timezone})}`;
      confirm.disabled=false;
      confirm.textContent=`Import ${importRows.length} trades`
    }
    catch(err)
    {
      importRows=[];
      out.innerHTML=`<div class="notice" style="color:#b4785f;background:#fcf3eb">${icon('info',16)}${esc(err.message)}</div>`;
      confirm.disabled=true
    }
    return
  }
  if(el.dataset.upload==='restore')
  {
    const file=el.files[0];
    if(!file)
    return;
    const out=document.getElementById('restore-status');
    try
    {
      if(file.size>15000000)
      throw Error('Backup is larger than 15 MB.');
      const b=JSON.parse(await file.text());
      validateBackup(b);
      pendingRestore=b;
      out.innerHTML=`<div class="notice">${icon('checkCircle',15)}<span>${b.trades.length} trades, ${b.entries.length} reflections, ${b.playbooks.length} playbooks ready.</span></div><button class="btn btn-primary" data-action="restore-confirm" style="margin-top:15px">Replace workspace with this backup</button>`
    }
    catch(err)
    {
      pendingRestore=null;
      out.innerHTML=`<div class="notice">${icon('info',15)}${esc(err.message)}</div>`
    }
    return
  }
}
);
document.addEventListener('input',e=>
{
  if(e.target.dataset.input==='trade-search')
  {
    s.tradeSearch=e.target.value;
    s.tradePage=1;
    render({
      focusSearch:true
    })
  }
  if(e.target.id==='command-search')
  updateSearch(e.target.value);
  if(e.target.closest('#calculator'))
  calculate()
}
);
document.addEventListener('submit',e=>
{
  const f=e.target;
  if(!['trade-form','review-form','journal-form','playbook-form','risk-form','connection-form','settings-form'].includes(f.id))
  return;
  e.preventDefault();
  if(!f.reportValidity())
  return;
  const d=Object.fromEntries(new FormData(f));
  if(f.id==='trade-form')
  {
    const hour=+d.time.slice(0,2),pnl=+d.pnl,risk=+d.risk,commission=+d.commission,swap=+d.swap;
    const t={
      ...d,
      id:'manual-'+Date.now(),
      symbol:d.symbol.toUpperCase(),
      entry:+d.entry,
      exit:+d.exit,
      sl:+d.sl,
      tp:+d.tp,
      pnl,
      risk,
      r:+(pnl/risk).toFixed(2),
      commission,
      swap,
      gross:pnl+commission-swap,
      volume:+d.volume,
      duration:+d.duration,
      session:hour<8?'Asia':hour<13?'London':hour<22?'New York':'Off session',
      disciplined:d.disciplined==='on',
      rating:3,
      tags:['Manually added'],
      reviewed:false
    };
    if((d.side==='Long'&&t.sl>=t.entry)||(d.side==='Short'&&t.sl<=t.entry))
    {
      toast('Place the initial stop on the loss side of your entry.');
      return
    }
    s.trades.push(t);
    s.trades.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    if(!persist())
    {
      s.trades=s.trades.filter(x=>x!==t);
      return
    }
    closeOverlay();
    render();
    toast('Trade saved. Your analytics are up to date.')
  }
  else
  if(f.id==='review-form')
  {
    const t=s.trades.find(t=>t.id===activeTradeId);
    if(!t)
    return;
    const old={
      ...t
    };
    Object.assign(t,{
      mood:d.mood,
      rating:+d.rating,
      notes:d.notes,
      tags:d.tags.split(',').map(x=>x.trim()).filter(Boolean),
      disciplined:d.disciplined==='on',
      reviewed:true,
      screenshot:tempScreenshot
    });
    if(!persist())
    {
      Object.assign(t,old);
      return
    }
    closeOverlay();
    render();
    toast('Review saved. A better process starts here.')
  }
  else
  if(f.id==='journal-form')
  {
    const id=f.dataset.id,old=s.entries.find(e=>e.id===id),entry={
      id:id||'journal-'+Date.now(),
      date:d.date,
      title:d.title.trim(),
      content:d.content.trim(),
      mood:d.mood,
      energy:+d.energy,
      tags:d.tags.split(',').map(x=>x.trim()).filter(Boolean),
      checks:[...s.habits]
    };
    if(!entry.title||!entry.content)
    {
      toast('Add a title and a reflection.');
      return
    }
    if(old)
    s.entries=s.entries.map(e=>e.id===id?entry:e);
    else
    s.entries.unshift(entry);
    if(entry.date===TODAY)
    {
      s.habits[3]=true;
      entry.checks[3]=true
    }
    persist();
    closeOverlay();
    nav('journal');
    toast('Reflection saved. Keep showing up.')
  }
  else
  if(f.id==='playbook-form')
  {
    const p={
      id:f.dataset.id||'setup-'+Date.now(),
      name:d.name.trim(),
      description:d.description.trim(),
      type:d.type,
      timeframe:d.timeframe,
      symbols:d.symbols,
      risk:+d.risk,
      rules:d.rules.split('\n').map(r=>r.trim()).filter(Boolean),
      color:s.playbooks.find(p=>p.id===f.dataset.id)?.color||'#e3ead8'
    };
    if(!p.name||!p.rules.length)
    {
      toast('Add a setup name and at least one rule.');
      return
    }
    const idx=s.playbooks.findIndex(x=>x.id===p.id);
    if(idx>=0)
    s.playbooks[idx]=p;
    else
    s.playbooks.push(p);
    persist();
    closeOverlay();
    nav('playbooks');
    toast('Playbook saved')
  }
  else
  if(f.id==='risk-form')
  {
    if(+d.perTrade>+d.daily||+d.daily>+d.max)
    {
      toast('Use per-trade risk ≤ daily loss limit ≤ maximum drawdown.');
      return
    }
    s.risk={
      perTrade:+d.perTrade,
      daily:+d.daily,
      max:+d.max,
      losses:+d.losses
    };
    persist();
    closeOverlay();
    render();
    toast('Risk rules updated')
  }
  else
  if(f.id==='connection-form')
  {
    s.pendingConnections.push({
      ...d,
      id:'connection-'+Date.now()
    });
    persist();
    modal('Your connection draft is saved.','The setup is ready for the backend phase.',`<div class="setup-progress"><div class="active"></div><div class="active"></div><div class="active"></div></div><div class="setup-success"><div class="success-icon">${icon('check',28)}</div><h2>${esc(d.name)}</h2><p>${esc(d.server)} · ${esc(d.type)}<br>Configuration saved locally. No live connection is active.</p></div><div class="notice">${icon('plug',16)}<span>Live sync will require a secure MT5 bridge, server-side credentials, and a historical trade import. Your draft is visible under Connections.</span></div>`,`<button class="btn btn-primary" data-nav="connections">View connections ${icon('arrow',13)}</button>`);
    render()
  }
  else
  if(f.id==='settings-form')
  saveSettings()
}
);
function validateBackup(b)
{
  if(b.app!=='edgebook'||b.version!==1||!Array.isArray(b.trades)||!Array.isArray(b.entries)||!Array.isArray(b.playbooks)||!b.profile||!b.risk||!b.notifications||!Array.isArray(b.habits)||!Array.isArray(b.pendingConnections))
  throw Error('This is not a supported Edgebook backup.');
  if(b.trades.length>10000||b.entries.length>5000||b.playbooks.length>300)
  throw Error('Backup exceeds the workspace limits.');
  for(
  const t
  of b.trades)
  {
    if(['gross','commission','swap','entry','exit','sl','tp','volume','duration','rating'].some(k=>!Number.isFinite(t[k])))
    throw Error('Backup contains invalid trade numbers.');
    if(typeof t.notes!=='string'||!['Long','Short'].includes(t.side)||!['Manual','Bot'].includes(t.source)||!['Focused','Calm','Anxious','FOMO','Frustrated'].includes(t.mood))
    throw Error('Backup contains invalid trade fields.');
    if(typeof t.id!=='string'||typeof t.date!=='string'||typeof t.time!=='string'||typeof t.symbol!=='string'||!Number.isFinite(t.pnl)||!Number.isFinite(t.risk)||t.risk<=0||!Number.isFinite(t.r)||!Array.isArray(t.tags)||!accounts.some(a=>a.id===t.account))
    throw Error('Backup contains an invalid trade.');
  }
  for(
  const e
  of b.entries)
  if(typeof e.title!=='string'||typeof e.content!=='string'||typeof e.date!=='string'||!Array.isArray(e.tags))
  throw Error('Backup contains an invalid journal entry.');
  for(
  const p
  of b.playbooks)
  if(typeof p.name!=='string'||!Array.isArray(p.rules)||!/^#[0-9a-fA-F]{6}$/.test(p.color))
  throw Error('Backup contains an invalid playbook.');
  if(typeof b.profile.name!=='string'||!['Asia/Karachi','UTC','Europe/London','America/New_York'].includes(b.profile.timezone))
  throw Error('Backup contains invalid preferences.');
  for(
  const k
  of ['perTrade','daily','max','losses'])
  if(!(b.risk[k]>0&&Number.isFinite(b.risk[k])))
  throw Error('Backup contains invalid risk rules.');
}
document.addEventListener('keydown',e=>
{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')
  {
    e.preventDefault();
    searchDialog();
    return
  }
  if(e.key==='Escape')
  {
    if(document.querySelector('.overlay'))
    closeOverlay();
    document.body.classList.remove('sidebar-open');
    return
  }
  const overlay=document.querySelector('.overlay');
  if(overlay&&e.key==='Tab')
  {
    const focusable=[...overlay.querySelectorAll('button:not(:disabled),input:not([type="hidden"]),textarea,select,[tabindex="0"],a[href]')].filter(el=>el.offsetParent!==null),first=focusable[0],last=focusable.at(-1);
    if(!first)
    return;
    if(e.shiftKey&&document.activeElement===first)
    {
      e.preventDefault();
      last.focus()
    }
    else
    if(!e.shiftKey&&document.activeElement===last)
    {
      e.preventDefault();
      first.focus()
    }
  }
  if(e.key==='Enter'&&e.target.id==='command-search')
  {
    e.preventDefault();
    document.querySelector('.command-result')?.click()
  }
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-trade]'))
  {
    e.preventDefault();
    tradeDrawer(e.target.dataset.trade)
  }
}
);
window.addEventListener('popstate',()=>
{
  s.page=pages.some(p=>p[0]===location.hash.slice(1))?location.hash.slice(1):'overview';
  closeOverlay();
  render()
}
);
let tip;
document.addEventListener('pointerover',e=>
{
  const el=e.target.closest('[data-tip]');
  if(!el)
  return;
  document.querySelector('.chart-tip')?.remove();
  tip=document.createElement('div');
  tip.className='chart-tip';
  const [title,...rest]=el.dataset.tip.split('|');
  tip.innerHTML=`<strong>${esc(title)}</strong>${rest.map(r=>`<span>${esc(r)}</span>`).join('')}`;
  document.body.append(tip);
  positionTip(e)
}
);
function positionTip(e)
{
  if(!tip)
  return;
  tip.style.left=Math.max(8,Math.min(window.innerWidth-tip.offsetWidth-10,e.clientX+15))+'px';
  tip.style.top=Math.max(8,Math.min(window.innerHeight-tip.offsetHeight-10,e.clientY+15))+'px'
}
document.addEventListener('pointermove',e=>
{
  if(e.target.closest('[data-tip]'))
  positionTip(e)
}
);
document.addEventListener('pointerout',e=>
{
  if(e.target.closest('[data-tip]'))
  {
    tip?.remove();
    tip=null
  }
}
);
render();
export {s,context,parseImport,validateBackup,actions,render};
function parseImport(text)
{
  return parseTradeCsv(text,s.playbooks);
}
