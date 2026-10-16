/** Pure trade aggregation and realized performance calculations. */
export
const sum=(arr,key='pnl')=>arr.reduce((s,t)=>s+(Number(t[key])||0),0);
export
function stats(rows)
{
  const wins=rows.filter(t=>t.pnl>0),loss=rows.filter(t=>t.pnl<0);
  let eq=0,peak=0,dd=0;
  for(
  const t
  of rows)
  {
    eq+=t.pnl;
    peak=Math.max(peak,eq);
    dd=Math.max(dd,peak-eq);
  }
  const grossLoss=-sum(loss);
  return{
    pnl:sum(rows),
    wins:wins.length,
    losses:loss.length,
    total:rows.length,
    winRate:rows.length?wins.length/rows.length*100:0,
    pf:grossLoss?sum(wins)/grossLoss:wins.length?Infinity:0,
    avgWin:wins.length?sum(wins)/wins.length:0,
    avgLoss:loss.length?sum(loss)/loss.length:0,
    expectancy:rows.length?sum(rows)/rows.length:0,
    avgR:rows.length?sum(rows,'r')/rows.length:0,
    commission:sum(rows,'commission'),
    drawdown:dd,
    discipline:rows.length?rows.filter(t=>t.disciplined).length/rows.length*100:0
  };
}
export
function groupBy(rows,key)
{
  const out={
  };
  rows.forEach(t=>
  {
    const k=typeof key==='function'?key(t):t[key];
    (out[k]??=[]).push(t)
  }
  );
  return out;
}
export
function daily(rows)
{
  return Object.entries(groupBy(rows,'date')).sort(([a],[b])=>a.localeCompare(b)).map(([date,trades])=>({
    date,
    pnl:sum(trades),
    trades
  }));
}
