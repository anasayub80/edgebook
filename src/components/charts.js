import {stats,sum,daily,accounts,TODAY} from '../data/index.js';
import {icon} from './icons.js';
import {esc,money,compact,pct,num,dateLabel,signClass} from '../lib/format.js';
/** Data-driven SVG charts and performance summaries. */
export
function sparkline(values,color='#7b9b63',width=75,height=27)
{
  if(!values.length)
  return '';
  const lo=Math.min(0,...values),hi=Math.max(1,...values),points=values.map((v,i)=>`${i/(values.length-1||1)*(width-2)+1},${height-2-(v-lo)/(hi-lo)*(height-4)}`).join(' ');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
let chartID=0;
export
function equityChart(rows,{
  balance=0,
  drawdown=false,
  small=false,
  compactLabels=false
}={
})
{
  const ds=daily(rows);
  let total=balance,peak=balance;
  const points=[{
    date:ds[0]?.date||TODAY,
    value:balance,
    pnl:0
  },...ds.map(d=>
  {
    total+=d.pnl;
    peak=Math.max(peak,total);
    return{
      date:d.date,
      value:drawdown?total-peak:total,
      pnl:d.pnl
    }
  }
  )];
  if(drawdown)
  points[0].value=0;
  const w=720,h=small?205:245,pad={
    top:15,
    right:60,
    bottom:30,
    left:10
  },cw=w-pad.left-pad.right,ch=h-pad.top-pad.bottom;
  const vals=points.map(p=>p.value),lo=Math.min(...vals),hi=Math.max(...vals),range=Math.max(100,hi-lo),min=drawdown?lo-range*.08:lo-range*.12,max=hi+range*.15;
  const xy=points.map((p,i)=>({
    x:pad.left+i/(points.length-1||1)*cw,
    y:pad.top+(max-p.value)/(max-min)*ch,
    ...p
  }));
  const line=xy.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const area=`${line} L${xy.at(-1).x},${h-pad.bottom} L${pad.left},${h-pad.bottom} Z`;
  const uid='gradient-'+chartID++;
  const color=drawdown?'#b87864':'#54855e';
  return `<div class="equity-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${drawdown?'Drawdown':'Equity'} chart across ${ds.length} trading days. Ending at ${money(xy.at(-1).value)}"><defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${drawdown?'#d4ac9f':'#a4c483'}" stop-opacity=".28"/><stop offset="100%" stop-color="${drawdown?'#d4ac9f':'#a4c483'}" stop-opacity=".01"/></linearGradient></defs>${Array.from({length:5},(_,i)=>{const y=pad.top+i*ch/4,value=max-(max-min)*i/4;return `<line x1="${pad.left}" x2="${w-pad.right}" y1="${y}" y2="${y}" class="chart-grid"/><text x="${w-pad.right+12}" y="${y+3}" class="chart-label">${esc(compactLabels?compact(value):Math.abs(value)>=1000?`${(value/1000).toFixed(1)}k`:Math.round(value))}</text>`}).join('')}<path d="${area}" fill="url(#${uid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${xy.at(-1).x}" cy="${xy.at(-1).y}" r="4" fill="${color}" stroke="white" stroke-width="2"/>${xy.filter((p,i)=>i>0).map(p=>`<rect class="chart-hit" x="${p.x-cw/(points.length-1||1)/2}" y="0" width="${cw/(points.length-1||1)}" height="${h-pad.bottom+5}" data-tip="${esc(dateLabel(p.date,{month:'short',day:'numeric',year:'numeric'})+'|'+(drawdown?'Drawdown: ':'Balance: ')+money(p.value)+'|Day P&L: '+money(p.pnl,true))}"><title>${dateLabel(p.date)}: ${money(p.value)}</title></rect>`).join('')}${[0,.25,.5,.75,1].map(fr=>{const p=xy[Math.round(fr*(xy.length-1))];return `<text x="${p.x}" y="${h-7}" class="chart-label" text-anchor="${fr===0?'start':fr===1?'end':'middle'}">${dateLabel(p.date)}</text>`}).join('')}</svg></div>`;
}
export
function metricStrip(rows,balance=40000)
{
  const s=stats(rows),cum=[];
  let v=0,wins=0,count=0;
  const rates=[];
  daily(rows).forEach(d=>
  {
    cum.push(v+=d.pnl);
    wins+=d.trades.filter(t=>t.pnl>0).length;
    count+=d.trades.length;
    rates.push(wins/count*100)
  }
  );
  return `<div class="metric-strip"><div class="metric"><div class="metric-label">Net P&L <span class="info-icon" title="Realized profit after commissions and swap">i</span></div><div class="metric-value ${signClass(s.pnl)}">${money(s.pnl,s.pnl>0)}</div><div class="metric-foot"><strong>${s.pnl>=0?'↗':'↘'} ${pct(s.pnl/balance*100)}</strong><span>return on starting balance</span></div><div class="metric-spark">${sparkline(cum)}</div></div><div class="metric"><div class="metric-label">Win rate <span class="info-icon" title="Winning trades divided by all closed trades">i</span></div><div class="metric-value">${num(s.winRate)}<small>%</small></div><div class="metric-foot"><strong>${s.wins} wins</strong><span>of ${s.total} trades</span></div><div class="metric-spark">${sparkline(rates,'#a5b88a')}</div></div><div class="metric"><div class="metric-label">Profit factor <span class="info-icon" title="Sum of winning trade net P&L divided by the absolute sum of losing trade net P&L">i</span></div><div class="metric-value">${num(s.pf)}<small>PF</small></div><div class="metric-foot"><span>${money(sum(rows.filter(t=>t.pnl>0)),false,0)} won / ${money(-sum(rows.filter(t=>t.pnl<0)),false,0)} lost</span></div></div><div class="metric"><div class="metric-label">Expectancy <span class="info-icon" title="Average net P&L per trade">i</span></div><div class="metric-value">${money(s.expectancy)}<small>/trade</small></div><div class="metric-foot"><strong>${num(s.avgR)}R</strong><span>average realized return</span></div></div></div>`;
}
export
function donut(rows)
{
  const s=stats(rows),circ=2*Math.PI*48,ratio=s.total?s.wins/s.total:0;
  return `<div class="performance-top"><div class="donut-wrap"><svg viewBox="0 0 116 116" aria-label="${pct(s.winRate)} winning trades" role="img"><circle cx="58" cy="58" r="48" fill="none" stroke="#e9ddd7" stroke-width="9"/><circle cx="58" cy="58" r="48" fill="none" stroke="#799c60" stroke-width="9" stroke-dasharray="${circ*ratio} ${circ}" stroke-linecap="round"/></svg><div class="donut-center"><strong>${num(s.winRate,1)}<span style="font-size:12px">%</span></strong><small>Win rate</small></div></div><div class="donut-details"><div><div class="flex gap8"><span class="dot"></span><small>Winning trades</small></div><strong>${s.wins}</strong></div><div><div class="flex gap8"><span class="dot loss"></span><small>Losing trades</small></div><strong>${s.losses}</strong></div></div></div><div class="performance-ratio"><div class="between"><span>Avg. win</span><span>Avg. loss</span></div><div class="ratio-bar"><div style="width:${s.avgWin/(s.avgWin-s.avgLoss||1)*100}%"></div></div><div class="between"><strong>${money(s.avgWin)}</strong><span>${money(s.avgLoss)}</span></div></div>`;
}
export
function sessionBars(rows)
{
  const groups=['Asia','London','New York'].map(name=>({
    name,
    rows:rows.filter(t=>t.session===name)
  })),max=Math.max(1,...groups.map(g=>Math.abs(sum(g.rows))));
  return groups.map((g,i)=>`<div class="session-row"><div class="session-top"><span class="session-name">${icon(['moon','sun','globe'][i],14)} ${g.name} <span class="muted tiny">${['00–08','08–13','13–22'][i]} UTC</span></span><strong class="money ${signClass(sum(g.rows))}" style="font-weight:550">${money(sum(g.rows),true,0)}</strong></div><div class="session-track"><div class="session-fill" style="width:${Math.max(0,Math.abs(sum(g.rows))/max*100)}%;background:${sum(g.rows)<0?'#d3b4a5':i===1?'#577b48':'#b2c696'}"></div></div><div class="session-meta"><span>${g.rows.length} trades</span><span>${pct(stats(g.rows).winRate,0)} win rate</span></div></div>`).join('');
}
export
function weekdayBars(rows)
{
  const vals=[1,2,3,4,5].map(day=>sum(rows.filter(t=>new Date(t.date+'T12:00:00Z').getUTCDay()===day))),max=Math.max(1,...vals.map(Math.abs));
  return `<div class="weekday-chart">${vals.map((v,i)=>`<div class="weekday-col"><strong class="${signClass(v)}">${compact(v)}</strong><div class="weekday-bar ${v===Math.max(...vals)?'best':''} ${v<0?'loss':''}" style="height:${Math.max(3,Math.abs(v)/max*100)}%" data-tip="${['Monday','Tuesday','Wednesday','Thursday','Friday'][i]}|${money(v,true)}"></div><small>${['Mon','Tue','Wed','Thu','Fri'][i]}</small></div>`).join('')}</div>`;
}
export
function distribution(rows)
{
  const ranges=[[-Infinity,-1],[-1,-.5],[-.5,0],[0,1],[1,2],[2,3],[3,Infinity]],counts=ranges.map(([a,b])=>rows.filter(t=>t.r>=a&&t.r<b).length),max=Math.max(1,...counts);
  return `<div class="distribution">${counts.map((v,i)=>`<div class="dist-bin"><small>${v}</small><div class="${i<3?'loss':''}" style="height:${v/max*100}%"></div><span>${['< −1R','−1R','−0.5R','0–1R','1–2R','2–3R','3R+'][i]}</span></div>`).join('')}</div>`;
}
