import {accounts,TODAY,stats,sum,daily,groupBy} from '../data/index.js';
import {icon,esc,money,pct,num,dateLabel,signClass,equityChart,metricStrip,tradeTable,donut,sessionBars,weekdayBars,distribution,empty,sparkline,input,selectField,compact} from '../components/ui.js';
import {filterbar} from './common.js';
function calendar(s,c)
{
  const [y,m]=s.month.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),offset=(first.getUTCDay()+6)%7,length=new Date(Date.UTC(y,m,0)).getUTCDate(),all=c.scopedAll.filter(t=>t.date.startsWith(s.month)),days=groupBy(all,'date'),ds=daily(all),st=stats(all),green=ds.filter(d=>d.pnl>0).length,red=ds.filter(d=>d.pnl<0).length;
  const cells=[];
  for(
  let i=0
  ;i<offset;i++)
  cells.push('<div class="day blank" aria-hidden="true"></div>');
  for(
  let day=1
  ;day<=length;day++)
  {
    const date=`${s.month}-${String(day).padStart(2,'0')}`,trs=days[date]||[],pnl=sum(trs),dow=new Date(date+'T00:00:00Z').getUTCDay();
    cells.push(`<button class="day ${trs.length?(pnl>=0?'win':'loss'):''} ${date===TODAY?'today':''} ${[0,6].includes(dow)?'weekend':''}" data-day="${date}" aria-label="${dateLabel(date,{weekday:'long',month:'long',day:'numeric'})}, ${trs.length} trades, ${money(pnl,true)}"><span class="date-num">${day}</span>${trs.length?`<span class="day-pnl ${signClass(pnl)}">${money(pnl,true,0)}</span><span class="day-trades">${trs.length} ${trs.length===1?'trade':'trades'}</span><span class="day-rr tiny muted" style="font-size:8px;margin-top:2px">${num(sum(trs,'r'))}R</span>`:date<=TODAY?'<span class="day-trades" style="opacity:.6">No trades</span>':''}</button>`)
  }
  while(cells.length%7)
  cells.push('<div class="day blank" aria-hidden="true"></div>');
  const weeks=Array.from({
    length:Math.ceil((offset+length)/7)
  },(_,w)=>
  {
    const start=Math.max(1,w*7-offset+1),end=Math.min(length,(w+1)*7-offset);
    return {
      start,
      end,
      rows:all.filter(t=>+t.date.slice(-2)>=start&&+t.date.slice(-2)<=end)
    }
  }
  );
  return `${filterbar(s,{period:false})}<div class="calendar-layout"><div><section class="panel"><div class="calendar-toolbar"><div class="flex gap12"><h2>${first.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})}</h2><span class="pill neutral">${all.length} trades</span></div><div class="flex gap8"><button class="icon-btn" data-month-shift="-1" aria-label="Previous month">${icon('left',15)}</button><button class="btn btn-sm" data-action="calendar-today">Today</button><button class="icon-btn" data-month-shift="1" aria-label="Next month">${icon('chevron',15)}</button></div></div><div class="calendar-weekdays">${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>`<span>${d.slice(0,3).toUpperCase()}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div><div class="panel-foot"><span>Click a day to review its trades</span><span>Net P&L · includes costs</span></div></section><div class="calendar-key"><span><i class="square-key"></i>Profitable day</span><span><i class="square-key red"></i>Losing day</span><span>All calendar data in UTC</span></div></div><aside class="calendar-side stack"><section class="panel"><div class="panel-head"><h2>The month in focus</h2>${icon('calendar',15)}</div><div class="panel-body"><div class="muted tiny">NET PERFORMANCE</div><div class="money ${signClass(st.pnl)}" style="font-size:30px;letter-spacing:-1px;font-weight:600;margin-top:7px">${money(st.pnl,true,0)}</div><div class="month-overview"><div><small>Green days</small><strong class="positive">${green}</strong></div><div><small>Red days</small><strong class="negative">${red}</strong></div><div><small>Win rate</small><strong>${pct(st.winRate,0)}</strong></div><div><small>Trading days</small><strong>${ds.length}</strong></div></div><div class="focus-card"><div class="eyebrow">Day consistency</div><p>${ds.length?pct(green/ds.length*100,0):'0%'} of active days finished green.</p></div></div></section><section class="panel"><div class="panel-head"><h2>Week by week</h2>${icon('chart',14)}</div><div class="panel-body" style="padding-top:8px">${weeks.map((w,i)=>`<div class="week-row"><div>Week ${i+1}<span class="subtext">${dateLabel(s.month+'-'+String(w.start).padStart(2,'0'))} – ${w.end}</span></div><div style="text-align:right"><strong class="money ${signClass(sum(w.rows))}" style="font-weight:550">${money(sum(w.rows),true,0)}</strong><span class="subtext">${w.rows.length} trades</span></div></div>`).join('')}</div></section><div class="notice">${icon('brain',16)}<span>Review your process on red days. Review your discipline on green ones.</span></div></aside></div>`;
}
export default calendar;
