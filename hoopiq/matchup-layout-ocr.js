/* Yahoo Matchup geometry helper.
   Tesseract word/line coordinates let lineup slots follow ROWS, not player
   eligibility. Unknown/occluded rows stay unassigned. */
(function(root,factory){
 const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQMatchupLayout=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const START=["PG","SG","G","SF","PF","F","C","C","UTIL","UTIL"];
 const norm=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();
 function lines(data,w,h){
  const out=[];const add=(t,b)=>{
   if(!t||!b)return;const y=(Number(b.y0)+Number(b.y1))/2/Math.max(1,h),x=(Number(b.x0)+Number(b.x1))/2/Math.max(1,w);
   if(Number.isFinite(y)&&y>=0&&y<=1)out.push({text:String(t).trim(),y,x,confidence:1});
  };
  if(Array.isArray(data?.lines)&&data.lines.length){
   for(const l of data.lines)add(l.text,l.bbox);
  }else if(Array.isArray(data?.blocks)&&data.blocks.length){
   for(const b of data.blocks)for(const p of b.paragraphs||[])for(const l of p.lines||[])add(l.text,l.bbox);
  }
  if(out.length)return out.sort((a,b)=>a.y-b.y);
  if(typeof data?.tsv==="string"){
   const groups=new Map();
   for(const line of data.tsv.split(/\r?\n/).slice(1)){
    const v=line.split("\t");if(v[0]!=="5"||v.length<12||!v.slice(11).join("\t").trim())continue;
    const k=[v[1],v[2],v[3],v[4]].join(":");
    const x=Number(v[6]),y=Number(v[7]),width=Number(v[8]),height=Number(v[9]);
    if(![x,y,width,height].every(Number.isFinite))continue;
    if(!groups.has(k))groups.set(k,{words:[],x0:x,y0:y,x1:x+width,y1:y+height});
    const o=groups.get(k);o.words.push(v.slice(11).join("\t"));o.x0=Math.min(o.x0,x);
    o.y0=Math.min(o.y0,y);o.x1=Math.max(o.x1,x+width);o.y1=Math.max(o.y1,y+height);
   }
   for(const g of groups.values())add(g.words.join(" "),g);
  }
  return out.sort((a,b)=>a.y-b.y);
 }
 function roleRows(centerLines){
  const accepted=new Set(["PG","SG","G","SF","PF","F","C","UTIL","BN","IL"]);
  const rows=[];
  for(const l of centerLines||[]){
   const n=norm(l.text).replace(/\s+(2|II)$/,"");
   // Accept standalone pills, not player eligibility or explanatory text.
   const label=n==="UTL"?"UTIL":n==="B N"?"BN":n==="I L"?"IL":n;
   if(accepted.has(label))rows.push({label,y:l.y});
  }
  return rows.sort((a,b)=>a.y-b.y);
 }
 function locate(players,ocrLines){
  const list=(players||[]).map(player=>{
   const n=norm(player.name),rawParts=String(player.name||"").trim().split(/\s+/);
   const suffix=new Set(["JR","JR.","II","III","IV"]);
   const meaningful=rawParts.filter(t=>!suffix.has(String(t).toUpperCase()));
   const last=norm(meaningful[meaningful.length-1]||""),first=norm(meaningful[0]||"");
   const initial=first[0]||"";
   const candidates=[];
   for(const l of ocrLines||[]){
    const text=" "+norm(l.text)+" ";
    const exact=n&&text.includes(" "+n+" ");
    const short=last&&text.includes(" "+initial+" "+last+" ");
    const fullFirst=last&&text.includes(" "+first+" "+last+" ");
    // Last-name-only matching is ambiguous and is deliberately excluded.
    if(exact||short||fullFirst)candidates.push({y:l.y,rank:exact?3:short?2:1});
   }
   candidates.sort((a,b)=>b.rank-a.rank||a.y-b.y);
   return {id:Number(player.id),name:player.name,team:player.team,y:candidates[0]?.y??null};
  });
  return list;
 }
 function labeled(players,playerLines,centerLines,tolerance=.035){
  const positions=roleRows(centerLines),found=locate(players,playerLines);
  const result=[];
  for(const p of found){
   if(p.y==null){result.push({...p,label:"",source:"unlocated"});continue}
   let closest=null,diff=Infinity;
   for(const r of positions){
    const d=Math.abs(p.y-r.y);
    if(d<diff){closest=r;diff=d}
   }
   result.push({...p,label:closest&&diff<=tolerance?closest.label:"",source:closest&&diff<=tolerance?"ocr position pill":"unassigned"});
  }
  return result;
 }
 function mergeOrder(sequences){
  const ordered=[];
  for(const sequence of sequences||[]){
   const ids=(sequence||[]).map(v=>Number(v.id)).filter(Number.isFinite);
   for(let i=0;i<ids.length;i++){
    const id=ids[i];if(ordered.includes(id))continue;
    let before=-1,after=-1;
    for(let j=i-1;j>=0;j--)if(ordered.includes(ids[j])){before=ordered.indexOf(ids[j]);break}
    for(let j=i+1;j<ids.length;j++)if(ordered.includes(ids[j])){after=ordered.indexOf(ids[j]);break}
    if(before>=0&&after>=0&&before<after)ordered.splice(before+1,0,id);
    else if(before>=0)ordered.splice(before+1,0,id);
    else if(after>=0)ordered.splice(after,0,id);
    else ordered.push(id);
   }
  }
  return ordered;
 }
 function resolve(observations,previous={}){
  // A center-pill label is strong evidence. Distinct C and UTIL pills are
  // numbered in cumulative roster order, not independently per screenshot.
  const byId=new Map(),sequences=[];
  for(const observation of observations||[]){
   const rows=(observation.rows||[]).slice().sort((a,b)=>(a.y??999)-(b.y??999));
   sequences.push(rows.map(p=>({id:p.id})));
   for(const p of rows){
    const current=byId.get(Number(p.id))||{id:Number(p.id),labels:[],sources:[]};
    if(p.label)current.labels.push(p.label);
    current.sources.push(observation.id);
    byId.set(current.id,current);
   }
  }
  const order=mergeOrder(sequences),known=new Map(),indexOfStart=new Map();
  const located=new Set((observations||[]).flatMap(o=>(o.rows||[]).filter(p=>p.y!=null).map(p=>Number(p.id))));
  START.forEach((label,i)=>{if(!indexOfStart.has(label))indexOfStart.set(label,[]);indexOfStart.get(label).push(i)});
  // Existing explicitly reviewed positions are retained on rescans.
  const used=new Set();
  for(const id of order){
   const prior=previous[id];
   if(prior&&prior!=="UNASSIGNED"){known.set(id,{slot:prior,confidence:"manual",source:"reviewed"});if(prior.includes(":"))used.add(prior)}
  }
  // Assign unique starting positions (e.g. PG, SG) from center text.
  for(const id of order){
   if(known.has(id))continue;
   const ls=byId.get(id)?.labels||[];
   if(!ls.length)continue;
   const tally=new Map();ls.forEach(v=>tally.set(v,(tally.get(v)||0)+1));
   const labels=[...tally].sort((a,b)=>b[1]-a[1]);
   if(labels.length>1&&labels[0][1]===labels[1][1])continue;
   const label=labels[0][0];
   if(label==="BN"||label==="IL"){known.set(id,{slot:label,confidence:"strong",source:"Yahoo lineup pill"});continue}
   const candidates=(indexOfStart.get(label)||[]).map(i=>label+":"+(START.slice(0,i+1).filter(x=>x===label).length));
   if(candidates.length===1&&!used.has(candidates[0])){
    known.set(id,{slot:candidates[0],confidence:"strong",source:"Yahoo lineup pill"});used.add(candidates[0]);
   }
  }
  // Distinguish duplicate C / UTIL slots only if their order is grounded by
  // the photographed lineup. No guess when a row is missing.
  for(const label of ["C","UTIL"]){
   const ids=order.filter(id=>!known.has(id)&&(byId.get(id)?.labels||[]).includes(label));
   const all=order.filter(id=>(byId.get(id)?.labels||[]).includes(label));
   if(all.length===2){
    for(const id of ids){
     const ordinal=all.indexOf(id)+1,key=label+":"+ordinal;
     if(!used.has(key)){used.add(key);known.set(id,{slot:key,confidence:"strong",source:"Yahoo lineup pill + row order"})}
    }
   }else if(all.length===1){
    const id=all[0],idx=order.indexOf(id);
    const earliest=order.slice(0,idx).some(x=>known.get(x)?.slot==="F:1"||known.get(x)?.slot==="PF:1");
    const later=order.slice(idx+1).some(x=>known.get(x)?.slot==="UTIL:1"||known.get(x)?.slot==="BN");
    // One C alone could be either Yahoo C slot; leave undecided.
    if(earliest&&later&&used.has(label+":1")&&!used.has(label+":2"))known.set(id,{slot:label+":2",confidence:"suggested",source:"surrounding rows"});
   }
  }
  // Fill gaps only when a pair of confirmed roles encloses exactly the
  // corresponding number of detected players; a skipped OCR name won't shift rows.
  const ord=order.map(id=>({id,slot:known.get(id)?.slot||""}));
  const slotIndex=slot=>slot&&slot.includes(":")?START.findIndex((v,i)=>slot===v+":"+(START.slice(0,i+1).filter(x=>x===v).length)):-1;
  for(let a=0;a<ord.length;a++){
   const left=slotIndex(ord[a].slot);if(left<0)continue;
   let b=a+1;for(;b<ord.length;b++)if(slotIndex(ord[b].slot)>=0)break;
   if(b>=ord.length)continue;
   const right=slotIndex(ord[b].slot);
   if(right-left!==b-a||right<=left)continue;
   for(let j=a+1;j<b;j++){
    if(known.has(ord[j].id))continue;
    const index=left+(j-a),name=START[index],key=name+":"+(START.slice(0,index+1).filter(x=>x===name).length);
    if(!used.has(key)){used.add(key);known.set(ord[j].id,{slot:key,confidence:"suggested",source:"between verified Yahoo rows"})}
   }
  }
  // When the first screenshot includes the Yahoo scoreboard and at least
  // five starting rows, the full 10-player ordering is a useful fallback
  // if every OCR-verified starter slot agrees. Mark all fallbacks as
  // "suggested", not verified, so users see exactly what to review.
  const top=(observations||[]).some(o=>o.hasHeader&&(o.rows||[]).length>=5);
  if(top&&order.length>=10&&order.slice(0,10).every(id=>located.has(id))){
   const expected=i=>{
    const label=START[i];
    return label+":"+START.slice(0,i+1).filter(x=>x===label).length;
   };
   const starterOutside=order.slice(10).some(id=>known.get(id)?.slot?.includes(":"));
   const contradiction=order.slice(0,10).some((id,i)=>{
    const value=known.get(id)?.slot;
    return Boolean(value&&value!==expected(i));
   });
   if(!starterOutside&&!contradiction){
    for(let i=0;i<10;i++){
     const id=order[i],key=expected(i);
     if(!known.has(id)&&!used.has(key)){
      known.set(id,{slot:key,confidence:"suggested",source:"Yahoo lineup row order — verify"});
      used.add(key);
     }
    }
   }
  }
  return {order,positions:Object.fromEntries([...known].map(([id,v])=>[id,v]))};
 }
 function scoreboard(rows){
  // Header text is read separately at higher contrast; each half is treated
  // independently. Never treat 0.00 actual fantasy points as a projection.
  const halves={left:[],right:[]};
  for(const row of rows||[]){
   const key=row.x<.5?"left":"right";
   halves[key].push(row.text);
  }
  function from(text){
   const s=text.join("\n").replace(/,/g,""),proj=[...s.matchAll(/\b(\d{3,4}\.\d{2})\b/g)]
    .map(v=>Number(v[1])).find(v=>v>=300&&v<=3500);
   const games=s.match(/\b(\d{1,2})\s*\/\s*(\d{2,3})\b/);
   return {projection:proj==null?"":proj.toFixed(2),games:games?games[1]+"/"+games[2]:""};
  }
  const whole=(rows||[]).map(x=>x.text).join("\n");
  return {left:from(halves.left),right:from(halves.right),
   week:(whole.match(/\bWeek\s*(\d{1,2})\b/i)||[])[1]||""};
 }
 function yahooWeekDate(week,currentDate=new Date()){
  const n=Number(week);if(!Number.isInteger(n)||n<1||n>30)return "";
  // NBA fantasy Week 1 starts Monday October 19 in the 2026-27 season.
  // This is a SUGGESTION shown for confirmation, not Yahoo calendar sync.
  const year=currentDate.getFullYear();
  if(year!==2026&&year!==2027)return "";
  const d=new Date(Date.UTC(2026,9,19+7*(n-1)));
  return d.toISOString().slice(0,10);
 }
 return {START,norm,lines,roleRows,locate,labeled,mergeOrder,resolve,scoreboard,yahooWeekDate};
});