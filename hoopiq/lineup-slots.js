/* HoopIQ lineup slots: keeps NBA roster membership separate from Yahoo lineup placement. */
(function(root, factory) {
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQLineup=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const DEFAULT=["PG","SG","G","SF","PF","F","C","C","UTIL","UTIL"];
 const LABELS=["PG","SG","G","SF","PF","F","C","UTIL"];
 const EMPTY="UNASSIGNED";
 function slotList(definition=DEFAULT){
  const counts=new Map();
  return (Array.isArray(definition)?definition:DEFAULT).filter(x=>LABELS.includes(x)).slice(0,30).map(label=>{
   const occurrence=(counts.get(label)||0)+1;counts.set(label,occurrence);
   return {key:label+":"+occurrence,label,occurrence};
  });
 }
 function normalizeRoster(ids,placements={},definition=DEFAULT){
  const selected=new Set((Array.isArray(ids)?ids:[]).map(Number).filter(Number.isFinite));
  const slots=slotList(definition).map(slot=>({...slot,id:null}));
  const positionMap={},bn=[],il=[],unassigned=[];
  const occupied=new Set();
  for(const id of selected){
   const raw=String(placements?.[id]||EMPTY);
   const slot=slots.find(s=>s.key===raw);
   if(slot&&!occupied.has(slot.key)){slot.id=id;occupied.add(slot.key);positionMap[id]=slot.key}
   else if(raw==="IL"){il.push(id);positionMap[id]="IL"}
   else if(raw==="BN"){bn.push(id);positionMap[id]="BN"}
   else{unassigned.push(id);positionMap[id]=EMPTY}
  }
  return {slots,bn,il,unassigned,positionMap,count:selected.size,active:slots.filter(s=>s.id).length};
 }
 function place(ids, placements, playerId, target, definition=DEFAULT){
  const base=normalizeRoster(ids,placements,definition);
  const id=Number(playerId),validKeys=new Set(slotList(definition).map(s=>s.key));
  if(!base.positionMap.hasOwnProperty(id))return {...base.positionMap};
  const destination=validKeys.has(target)||["BN","IL",EMPTY].includes(target)?target:EMPTY;
  const next={...base.positionMap};
  if(validKeys.has(destination)){
   for(const [other,value] of Object.entries(next))
    if(Number(other)!==id&&value===destination)next[other]="BN";
  }
  next[id]=destination;
  return next;
 }
 function eligible(ids, placements={}){
  return (Array.isArray(ids)?ids:[]).map(Number).filter(id=>String(placements?.[id]||EMPTY)!=="IL");
 }
 const plain=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[’']/g,"").replace(/[^A-Z0-9 ]+/g," ").replace(/\s+/g," ").trim();
 function identify(raw,matches,definition=DEFAULT){
  const lines=String(raw||"").split(/\r?\n/).map(plain);
  const starters=new Set(LABELS);
  const slots=slotList(definition);
  const used=new Set(),hints={};
  let section="UNKNOWN",pending=null;
  const remaining=slots.map(s=>({...s}));
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(!line)continue;
   if(line==="STARTERS"||line==="STARTING LINEUP"){section="STARTERS";pending=null;continue}
   if(line==="BENCH"){section="BENCH";pending=null;continue}
   if(/^(INJURED|INJURY|INJURED LIST|IL\+?|IL SLOT)$/.test(line)){section="IL";pending=null;continue}
   // Yahoo labels are in the left column; require a standalone slot or a prefix
   // preceding a recognized player's name, not a position-eligibility list.
   const m=line.match(/^(PG|SG|G|SF|PF|F|C|UTIL|BN|IL)\b(?:\s+(.*))?$/);
   let recognized=null;
   if(m&&(!m[2]||!(/^(PG|SG|SF|PF|C|G)\s+/.test(m[2])))){
    const label=m[1];
    // A row showing "C Empty" still consumes the first available C slot.
    if(m[2]==="EMPTY"||m[2]==="EMPTY SLOT"){
     if(starters.has(label)){const slot=remaining.find(s=>s.label===label);if(slot)remaining.splice(remaining.indexOf(slot),1)}
     pending=null;continue
    }
    if(label==="BN"||label==="IL"){pending={kind:label,at:i}}
    else if(starters.has(label)){
     const slot=remaining.find(s=>s.label===label);
     if(slot){remaining.splice(remaining.indexOf(slot),1);pending={kind:slot.key,at:i}}
     else pending=null;
    }
   }
   const matching=(matches||[]).filter(p=>{
    const n=plain(p.name);
    const names=n.split(" ");
    if(names.length<2)return false;
    const suffix=names.slice(1).filter(t=>!["JR","II","III","IV"].includes(t)).join(" ");
    const initial=names[0][0]+" "+suffix;
    const variants=[n,initial,initial+" JR",initial+" JR "];
    return variants.some(v=>(" "+line+" ").includes(" "+v+" "));
   });
   if(matching.length===1){
    const id=Number(matching[0].id);
    if(used.has(id))continue;
    const near=pending&&i-pending.at<=3?pending.kind:null;
    const target=near|| (section==="IL"?"IL":section==="BENCH"?"BN":null);
    if(target){hints[id]={position:target,confidence:near?"slot label":"section label"};used.add(id)}
    pending=null;
   } else if(pending&&i-pending.at>3){pending=null}
  }
  return hints;
 }
 function combineHints(scans,matches,definition=DEFAULT){
  const all={};
  for(const scan of scans||[]){
   if(scan.status!=="done")continue;
   const hints=identify(scan.text||"",matches,definition);
   for(const [id,hint] of Object.entries(hints)){
    const old=all[id];
    if(!old||(old.confidence!=="slot label"&&hint.confidence==="slot label"))all[id]=hint;
   }
  }
  return all;
 }
 return {DEFAULT,LABELS,EMPTY,slotList,normalizeRoster,place,eligible,identify,combineHints};
});