/** Shared HTML escaping, currency, date, and numeric formatting. */
export
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));
export
const money=(n,signed=false,dec=2)=>`${n<0?'−':signed&&n>0?'+':''}$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec})}`;
export
const compact=n=>Math.abs(n)>=1000?`${n<0?'−':''}$${(Math.abs(n)/1000).toFixed(1)}k`:money(n,false,0);
export
const pct=(n,d=1)=>`${Number(n).toFixed(d)}%`;
export
const num=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'∞';
export
const dateLabel=(date,opt={
  month:'short',
  day:'numeric'
})=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{
  ...opt,
  timeZone:'UTC'
});
export
const signClass=n=>n>=0?'positive':'negative';
