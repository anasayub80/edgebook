/** Deterministic sample accounts, trades, playbooks, and reflections for the UI preview. */
export
const TODAY = '2026-10-16';
export
const accounts = [
{
  id:'funded',
  name:'Funded account',
  short:'Funded · 25K',
  broker:'FundingPips · MT5',
  balance:25000,
  type:'Manual',
  color:'#294e43',
  number:'88024192'
},
{
  id:'nova',
  name:'NOVA Swing Bot',
  short:'NOVA · 10K',
  broker:'MetaTrader 5 · Demo',
  balance:10000,
  type:'Bot',
  color:'#a0ad7c',
  number:'51039482'
},
{
  id:'personal',
  name:'Personal account',
  short:'Personal · 5K',
  broker:'Exness · MT5 Demo',
  balance:5000,
  type:'Manual',
  color:'#c9a984',
  number:'97208513'
}
];
export
const initialPlaybooks = [
{
  id:'sweep',
  name:'Liquidity sweep + OB',
  type:'Manual',
  color:'#d8ebc5',
  description:'Trade the return to a fresh order block after a liquidity sweep and displacement.',
  symbols:'XAUUSD, GBPUSD, EURJPY',
  timeframe:'1H → 5M',
  risk:0.5,
  rules:['Higher timeframe bias is aligned','Liquidity has been swept','Displacement confirms a structure shift','Entry at a fresh order block','Minimum 1:2 risk-to-reward','No high-impact news within 15 minutes']
},
{
  id:'london',
  name:'London opening range',
  type:'Manual',
  color:'#f0e5cd',
  description:'The first 15-minute London range, followed by a clean break and retest with the trend.',
  symbols:'EURUSD, XAUUSD',
  timeframe:'15M → 5M',
  risk:0.5,
  rules:['First 15-minute London range is complete','50 EMA and 200 EMA agree with direction','Candle closes outside the range','Retest holds the breakout level','Stop beyond structural swing','Maximum two attempts per session']
},
{
  id:'nova',
  name:'NOVA continuation',
  type:'Bot',
  color:'#dfe5f2',
  description:'Systematic trend continuation after a confirmed structural pullback.',
  symbols:'GBPUSD, EURJPY, BTCUSD',
  timeframe:'4H → 1H',
  risk:0.5,
  rules:['4H trend is established','Valid break of structure','Pullback reaches the value area','Risk stays within account limits','Spread filter passes','Weekend exit is enabled']
}
];
let seed=2817;
const random=()=>
{
  seed=(seed*16807)%2147483647;
  return (seed-1)/2147483646;
}
;
const instruments=[['XAUUSD',2650,2],['EURUSD',1.09,5],['GBPUSD',1.3,5],['EURJPY',161,3],['BTCUSD',62000,2]];
export
function generateTrades()
{
  const rows=[];
  let id=1000;
  for(
  let d=new Date('2026-07-20T00:00:00Z')
  ;d<=new Date(TODAY+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1))
  {
    if([0,6].includes(d.getUTCDay()))
    continue;
    const count=2+Math.floor(random()*4);
    for(
    let n=0
    ;n<count;n++)
    {
      const a=accounts[Math.floor(random()*accounts.length)];
      const ins=instruments[Math.floor(random()*instruments.length)];
      const si=Math.floor(random()*3);
      const session=['Asia','London','New York'][si];
      const strategy=a.type==='Bot'?'nova':(random()>.35?'sweep':'london');
      const disciplined=random()>.17;
      const win=random()<(si===1?.68:si===2?.55:.43)-(disciplined?0:.28);
      const risk=+(a.balance*(disciplined?.005:.008)).toFixed(2);
      const r=win?+(1.05+random()*2.05).toFixed(2):-(.6+random()*.43);
      const commission=+(2+random()*4).toFixed(2);
      const swap=random()>.8?-(random()*4):0;
      const gross=+(risk*r).toFixed(2);
      const pnl=+(gross-commission+swap).toFixed(2);
      const side=random()>.48?'Long':'Short';
      const entry=+(ins[1]*(.97+random()*.07)).toFixed(ins[2]);
      const volume=a.id==='funded'?.25:.1;
      const contract=ins[0]==='XAUUSD'?100:ins[0]==='BTCUSD'?1:ins[0]==='EURJPY'?100000/ins[1]:100000;
      const distance=risk/(volume*contract);
      const exit=+(entry+(side==='Long'?1:-1)*distance*r).toFixed(ins[2]);
      const date=d.toISOString().slice(0,10);
      const hour=[2,8,14][si]+Math.floor(random()*3);
      const duration=12+Math.floor(random()*190);
      rows.push({
        id:String(id++),
        date,
        time:String(hour).padStart(2,'0')+':'+String(Math.floor(random()*60)).padStart(2,'0'),
        account:a.id,
        symbol:ins[0],
        side,
        session,
        strategy,
        source:a.type,
        risk,
        r:+(pnl/risk).toFixed(2),
        gross,
        commission,
        swap:+swap.toFixed(2),
        pnl,
        entry,
        exit,
        sl:+(entry-(side==='Long'?1:-1)*distance).toFixed(ins[2]),
        tp:+(entry+(side==='Long'?1:-1)*distance*2).toFixed(ins[2]),
        volume,
        duration,
        disciplined,
        mood:disciplined?['Focused','Calm'][Math.floor(random()*2)]:['Anxious','FOMO','Frustrated'][Math.floor(random()*3)],
        rating:disciplined?4:2,
        tags:disciplined?['Plan followed']:['Early entry'],
        notes:disciplined?'Patient entry after confirmation. Risk stayed within the plan.':'Entered before full confirmation. Review the trigger before the next session.',
        reviewed:random()>.33
      });
    }
  }
  return rows.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
export
const initialEntries=[
{
  id:'j1',
  date:'2026-10-16',
  title:'Patience is part of the setup.',
  mood:'Focused',
  energy:4,
  content:'Waited for the London range to form before looking for an entry. The best trade was the one I didn’t chase. Tomorrow: define invalidation before placing the order.',
  tags:['London','Process'],
  checks:[true,true,true,false]
},
{
  id:'j2',
  date:'2026-10-15',
  title:'A small loss. A good decision.',
  mood:'Calm',
  energy:4,
  content:'Took the planned stop without moving it. Stepped away for 20 minutes instead of re-entering. A losing trade can still be well executed.',
  tags:['Risk discipline'],
  checks:[true,true,true,true]
},
{
  id:'j3',
  date:'2026-10-14',
  title:'Let the plan do the work.',
  mood:'Focused',
  energy:5,
  content:'The sweep was clean and the retest held. Managed the trade according to the playbook. No changes based on the floating P&L.',
  tags:['Plan followed','Review'],
  checks:[true,true,true,true]
}
];
