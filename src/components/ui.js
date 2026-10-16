import {stats,sum,daily,accounts,TODAY} from '../data/index.js';
import {icon} from './icons.js';
import {esc,money,compact,pct,num,dateLabel,signClass} from '../lib/format.js';
export
function symbolIcon(symbol)
{
  return `<span class="symbol-icon ${symbol==='BTCUSD'?'crypto':symbol==='XAUUSD'?'':'fx'}">${symbol==='XAUUSD'?'Au':symbol==='BTCUSD'?'₿':symbol.slice(0,1)}</span>`;
}
export
function tradeTable(rows,{
  full=false,
  playbooks=[],
  timezone='Asia/Karachi'
}={
})
{
  if(!rows.length)
  return empty('No trades in this view','Try another account, period, or filter.','trades');
  return `<div class="table-wrap"><table><thead><tr><th>Instrument</th><th>Date & time</th><th>Direction</th>${full?'<th>Account / source</th><th>Setup</th>':''}<th>Net P&L</th><th>Return</th><th>Review</th><th></th></tr></thead><tbody>${rows.map(t=>{const a=accounts.find(a=>a.id===t.account);const localTime=new Date(`${t.date}T${t.time}:00Z`).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:timezone});return `<tr data-trade="${esc(t.id)}" tabindex="0" role="button" aria-label="Review ${esc(t.symbol)} trade ${money(t.pnl,true)}"><td><div class="symbol-cell">${symbolIcon(t.symbol)}<div><span class="symbol-name">${esc(t.symbol)}</span><span class="subtext">${esc(t.session)} session</span></div></div></td><td>${dateLabel(t.date)}<span class="subtext">${localTime} · ${timezone==='Asia/Karachi'?'PKT':timezone==='Europe/London'?'London':timezone==='America/New_York'?'New York':'UTC'}</span></td><td><span class="side-tag ${t.side==='Short'?'short':''}">${icon(t.side==='Long'?'upRight':'arrow',11)} ${t.side}</span></td>${full?`<td>${esc(a?.short||t.account)}<span class="subtext">${t.source==='Bot'?'⚙ Automated':'Discretionary'}</span></td><td>${esc(playbooks.find(p=>p.id===t.strategy)?.name||'Custom setup')}</td>`:''}<td class="money table-money ${signClass(t.pnl)}">${money(t.pnl,true)}</td><td class="numeric ${signClass(t.r)}">${t.r>0?'+':''}${num(t.r)}R</td><td>${t.reviewed?`<span class="status-check">${icon('checkCircle',12)} Reviewed</span>`:'<span class="status-pending">● To review</span>'}</td><td>${icon('chevron',13)}</td></tr>`}).join('')}</tbody></table></div>`;
}
export
const empty=(title,desc,ico='chart',button='')=>`<div class="empty">${icon(ico,29)}<h3>${esc(title)}</h3><p>${esc(desc)}</p>${button}</div>`;
export
const input=(label,name,value,type='text',extra='')=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(value)}" type="${type}" ${extra}></div>`;
export
const selectField=(label,name,options,value,extra='')=>`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" ${extra}>${options.map(o=>{const v=typeof o==='string'?o:o[0],label=typeof o==='string'?o:o[1];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`}).join('')}</select></div>`;
export * from './icons.js';
export * from './charts.js';
export * from '../lib/format.js';
