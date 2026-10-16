import {accounts,TODAY,stats,sum,daily,groupBy} from '../data/index.js';
import {icon,esc,money,pct,num,dateLabel,signClass,equityChart,metricStrip,tradeTable,donut,sessionBars,weekdayBars,distribution,empty,sparkline,input,selectField,compact} from '../components/ui.js';
/** Shared navigation, page headings, and account/time filters. */
export
const pages=[['overview','grid','Overview'],['trades','trades','Trade history'],['calendar','calendar','Calendar'],['analytics','chart','Analytics'],['equity','wallet','Equity tracker'],['playbooks','book','Playbooks'],['journal','brain','Mindset & journal'],['risk','shield','Risk manager'],['connections','plug','Connections'],['settings','settings','Settings']];
export
function sidebar(s)
{
  return `<div class="nav-scrim" data-action="mobile-close"></div><aside class="sidebar" aria-label="Main navigation"><a class="brand" href="#overview" aria-label="Edgebook overview"><span class="brand-mark"><svg width="30" height="33" viewBox="0 0 30 33" aria-hidden="true"><path d="M2 26V8l11-6v18zm14 5V13l11-6v18z" fill="#d4ef94"/></svg></span><span class="brand-name">edgebook<span style="color:#a8bd89">.</span></span></a><button class="collapse-btn" data-action="collapse" aria-label="${s.collapsed?'Expand':'Collapse'} sidebar">${icon('left',12)}</button><button class="workspace-picker" data-nav="settings"><span class="workspace-initial">${esc((s.profile.name||'Your Workspace').split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><span class="user-info" style="text-align:left;flex:1"><strong style="font-size:11px;font-weight:500;color:#dce4d6">${esc((s.profile.name||'Your').split(' ')[0])}’s workspace</strong><span style="display:block;font-size:9px;color:#7e9788">Personal workspace</span></span>${icon('down',12)}</button><nav class="nav-group"><div class="nav-label">Workspace</div>${pages.slice(0,5).map(([id,ico,label])=>navItem(s,id,ico,label)).join('')}</nav><nav class="nav-group"><div class="nav-label">Build your edge</div>${pages.slice(5,8).map(([id,ico,label])=>navItem(s,id,ico,label)).join('')}</nav><div class="sidebar-bottom">${navItem(s,'connections','plug','Connections')}${navItem(s,'settings','settings','Settings')}<div class="sidebar-note">${icon('spark',19)}<strong>Better process. Better trades.</strong><p>Your next edge is hidden in your last trade.</p></div><div class="sidebar-user"><div class="avatar">${esc((s.profile.name||'Anas Ayub').split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><div class="user-info" style="flex:1"><div class="user-name">${esc(s.profile.name)}</div><div class="user-sub">Personal plan · Preview</div></div><button class="icon-btn signout-control" data-auth-route="sign-out" aria-label="Sign out">${icon('logout',15)}</button></div></div></aside>`;
}
const navItem=(s,id,ico,label)=>`<button class="nav-item ${s.page===id?'active':''}" data-nav="${id}" title="${label}" ${s.page===id?'aria-current="page"':''}>${icon(ico,17)}<span class="nav-text">${label}</span>${id==='connections'?'<span class="badge">MT5</span>':''}</button>`;
export
function topbar(s)
{
  return `<header class="topbar"><div class="flex gap12"><button class="icon-btn mobile-menu" data-action="mobile-menu" aria-label="Open navigation">${icon('menu',19)}</button><div class="breadcrumb">${icon('layers',14)}<span class="muted">Workspace</span><span style="color:#b3bdae">/</span><strong>${pages.find(p=>p[0]===s.page)?.[2]||'Overview'}</strong></div></div><div class="top-actions"><button class="demo-indicator" data-action="demo-info"><span class="status-dot"></span> Demo workspace</button><button class="search-trigger" data-action="search" aria-label="Search workspace">${icon('search',16)}<span>Search anything</span><span class="keycap">⌘ K</span></button><div class="top-divider"></div><button class="icon-btn" data-action="notifications" aria-label="View notifications">${icon('bell',17)}<span class="notification-dot"></span></button><button class="avatar" data-action="account-menu" aria-label="Open account menu">${esc((s.profile.name||'Anas Ayub').split(' ').map(x=>x[0]).slice(0,2).join(''))}</button></div></header>`;
}
const titleMap={
  overview:['Performance overview','A little more clarity. A little more edge.'],
  trades:['Every trade tells a story.','Find the patterns behind your performance.'],
  calendar:['Your trading calendar','The good days, the hard days, and everything you can learn.'],
  analytics:['Understand your edge.','Turn your trading history into decisions you can trust.'],
  equity:['Your capital, in perspective.','Follow the journey. Protect the progress.'],
  playbooks:['Trade with intention.','Define your setups. Measure what actually works.'],
  journal:['A better trader starts here.','Track your mindset. Reflect on the process. Build consistency.'],
  risk:['Protect your ability to trade.','Set boundaries before the market tests them.'],
  connections:['One workspace. Every trade.','Your bots and manual accounts, together in one clear view.'],
  settings:['Make it your workspace.','The little details that make your trading day flow.']
};
export
function pageHead(s)
{
  const [title,sub]=titleMap[s.page];
  const action={
    trades:['add-trade','plus','Add trade'],
    calendar:['weekly-review','file','Monthly review'],
    analytics:['report','download','Performance report'],
    equity:['add-account','plus','Add account'],
    playbooks:['add-playbook','plus','New playbook'],
    journal:['add-entry','plus','Write a reflection'],
    risk:['edit-risk','settings','Edit risk rules'],
    connections:['connect','plus','Connect account'],
    settings:['save-settings','check','Save changes'],
    overview:['add-trade','plus','Add trade']
  }[s.page];
  return `<div class="page-head"><div><h1>${title}</h1><p class="page-subtitle">${sub}</p></div><div class="head-actions">${s.page==='overview'?`<button class="btn" data-action="report">${icon('download',13)} Export report</button>`:''}<button class="btn btn-primary" data-action="${action[0]}">${icon(action[1],14)} ${action[2]}</button></div></div>`;
}
export
function filterbar(s,{
  period=true
}={
})
{
  return `<div class="filterbar"><div class="filters"><label class="select-wrap" aria-label="Account">${icon('wallet',14)}<select data-filter="account" aria-label="Select account"><option value="all">All accounts</option>${accounts.map(a=>`<option value="${a.id}" ${s.account===a.id?'selected':''}>${esc(a.short)}</option>`).join('')}</select></label><label class="select-wrap">${icon('layers',13)}<select data-filter="source" aria-label="Trade source"><option value="all">All trading</option><option value="Manual" ${s.source==='Manual'?'selected':''}>Manual only</option><option value="Bot" ${s.source==='Bot'?'selected':''}>Bots only</option></select></label></div>${period?`<div class="filters"><span class="period-text">${icon('calendar',12)} ${dateLabel(s.fromDate)} – ${dateLabel(TODAY)}</span><div class="period-tabs" aria-label="Time period">${['7d','30d','90d','all'].map(p=>`<button class="${s.period===p?'active':''}" data-period="${p}" aria-pressed="${s.period===p}">${p==='all'?'All time':p.toUpperCase()}</button>`).join('')}</div></div>`:'<span class="period-text">Demo data · July–October 2026</span>'}</div>`;
}
