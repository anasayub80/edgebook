import {accounts,TODAY,initialPlaybooks} from '../data/index.js';
/** Edgebook CSV schema, escaping, parser, and import validation. */
function csvCell(v)
{
  let text=typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:String(v??'');
  return /[",\n\r]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text
}
const csvKeys=['date','time','account','symbol','side','source','session','strategy','entry','exit','sl','tp','volume','risk','pnl','commission','swap','duration','mood','disciplined','notes'];
function parseCSV(text)
{
  const records=[];
  let row=[],cell='',quoted=false;
  for(
  let i=0
  ;i<text.length;i++)
  {
    const ch=text[i];
    if(ch==='"')
    {
      if(quoted&&text[i+1]==='"')
      {
        cell+='"';
        i++
      }
      else
      quoted=!quoted
    }
    else
    if(ch===','&&!quoted)
    {
      row.push(cell);
      cell=''
    }
    else
    if((ch==='\n'||ch==='\r')&&!quoted)
    {
      if(ch==='\r'&&text[i+1]==='\n')
      i++;
      row.push(cell);
      if(row.some(c=>c.trim()))
      records.push(row);
      row=[];
      cell=''
    }
    else
    cell+=ch
  }
  if(quoted)
  throw Error('Unclosed quote in CSV file.');
  row.push(cell);
  if(row.some(c=>c.trim()))
  records.push(row);
  return records
}
function parseImport(text, playbooks = initialPlaybooks)
{
  const csv=parseCSV(text.replace(/^\uFEFF/,''));
  if(csv.length<2)
  throw Error('The file needs a header row and at least one trade.');
  if(csv.length>2001)
  throw Error('Import up to 2,000 trades at a time.');
  const header=csv[0].map(h=>h.trim().toLowerCase()),required=['date','time','account','symbol','side','pnl','risk'];
  for(
  const k
  of required)
  if(!header.includes(k))
  throw Error(`Missing required column: ${k}`);
  const result=[];
  for(
  let i=1
  ;i<csv.length;i++)
  {
    const t=Object.fromEntries(header.map((k,j)=>[k,csv[i][j]?.trim()||''])),line=i+1;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!Number.isFinite(Date.parse(t.date+'T00:00:00Z'))||new Date(t.date+'T00:00:00Z').toISOString().slice(0,10)!==t.date||t.date>TODAY)
    throw Error(`Row ${line}: use a valid date on or before ${TODAY}.`);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))
    throw Error(`Row ${line}: time must use UTC HH:mm.`);
    if(!accounts.some(a=>a.id===t.account))
    throw Error(`Row ${line}: account must be funded, nova, or personal.`);
    if(!t.symbol||!/^[A-Za-z0-9._-]{1,15}$/.test(t.symbol))
    throw Error(`Row ${line}: invalid instrument symbol.`);
    if(!['long','short'].includes(t.side.toLowerCase()))
    throw Error(`Row ${line}: side must be Long or Short.`);
    if(!t.pnl||!Number.isFinite(+t.pnl)||!(+t.risk>0))
    throw Error(`Row ${line}: P&L must be a number and risk must be positive.`);
    for(
    const k
    of ['entry','exit','sl','tp','volume','commission','swap','duration'])
    if(t[k]&&!Number.isFinite(+t[k]))
    throw Error(`Row ${line}: ${k} must be a number.`);
    const hour=+t.time.slice(0,2),commission=Math.max(0,+t.commission||0),swap=+t.swap||0,pnl=+t.pnl;
    result.push({
      ...t,
      id:'import-'+Date.now()+'-'+i,
      symbol:t.symbol.toUpperCase(),
      side:t.side.toLowerCase()==='long'?'Long':'Short',
      pnl,
      risk:+t.risk,
      r:+(pnl/+t.risk).toFixed(2),
      commission,
      swap,
      gross:pnl+commission-swap,
      entry:+t.entry||0,
      exit:+t.exit||0,
      sl:+t.sl||0,
      tp:+t.tp||0,
      volume:Math.max(0,+t.volume||0),
      duration:Math.max(0,+t.duration||0),
      session:hour<8?'Asia':hour<13?'London':hour<22?'New York':'Off session',
      strategy:playbooks.some(p=>p.id===t.strategy)?t.strategy:'sweep',
      source:['Manual','Bot'].includes(t.source)?t.source:'Manual',
      mood:['Focused','Calm','Anxious','FOMO','Frustrated'].includes(t.mood)?t.mood:'Calm',
      disciplined:String(t.disciplined||'true').toLowerCase()!=='false',
      rating:3,
      tags:['Imported'],
      reviewed:false,
      notes:(t.notes||'').replace(/^'(?=[=+@-])/,'')
    })
  }
  return result
}
export {csvCell,csvKeys,parseCSV,parseImport};
