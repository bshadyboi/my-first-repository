/* Shared Yahoo-style roster OCR name matching; deliberately conservative about initials. */
(function(root,factory){
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQRosterOCR=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const teams=["ATL","BOS","BKN","CHA","CHI","CLE","DAL","DEN","DET","GS","GSW","HOU","IND","LAC","LAL","MEM","MIA","MIL","MIN","NO","NOP","NY","NYK","OKC","ORL","PHI","PHX","POR","SAC","SA","SAS","TOR","UTA","UTAH","WAS","WSH"];
 const corrections={GSW:"GS",SAS:"SA",NOP:"NO",NYK:"NY",WAS:"WSH",UTAH:"UT",UTA:"UT",WSH:"WSH"};
 function clean(s){
  return String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
 }
 function team(s){const t=String(s||"").trim().toUpperCase();return corrections[t]||t}
 const teamRe=new RegExp("\\b("+teams.join("|")+")\\b","gi");
 function teamCodes(text){
  const out=new Set();for(const m of String(text||"").matchAll(teamRe))out.add(team(m[1]));
  return [...out];
 }
 function pieces(name){
  const n=clean(name).split(" ");if(n.length<2)return null;
  const last=n.slice(1).filter(x=>!["jr","ii","iii","iv"].includes(x)).join(" ");
  return {full:clean(name),initial:n[0][0],last,alias:n[0][0]+" "+last};
 }
 const boundary=(str,needle)=>(" "+str+" ").includes(" "+needle+" ");
 function rank(c, line, near, anchor){
  const pn=pieces(c.name);if(!pn)return null;
  const direct=boundary(line,pn.full)||boundary(near,pn.full);
  const alias=boundary(line,pn.alias)||boundary(near,pn.alias);
  if(!direct&&!alias)return null;
  const local=teamCodes(line+" "+near);
  const roster=team(c.team);
  const teamHit=local.includes(roster);
  const mismatch=local.length>0&&!teamHit;
  return {p:c,full:direct,alias,teamHit,mismatch,score:(direct?100:50)+(teamHit?30:0)-(mismatch?55:0),anchor};
 }
 function getMatches(raw, pool){
  const lines=String(raw||"").replace(/\r/g,"").split(/\n|\t|;/).map(clean).filter(Boolean).slice(0,220);
  const dict=new Map();
  for(const p of pool||[]){if(p?.id&&p?.name&&pieces(p.name)&&!dict.has(clean(p.name)))dict.set(clean(p.name),p)}
  const found=new Map(),ambiguous=[],unknown=[];
  for(let i=0;i<lines.length;i++){
   const line=lines[i];
   const near=lines.slice(i+1,i+3).join(" ");
   const context=line+" "+near;
   const matching=[];
   for(const p of dict.values()){const hit=rank(p,line,near,i);if(hit)matching.push(hit)}
   const evidence=matching.sort((a,b)=>b.score-a.score);
   if(!evidence.length)continue;
   // A different player can share an initial and surname; never silently choose one.
   const best=evidence[0],same=evidence.filter(x=>x.score===best.score);
   if(best.mismatch&&!best.full)continue;
   if(same.length>1){
    const ids=same.map(x=>x.p.name).slice(0,6);
    if(!ambiguous.some(a=>a.line===line))ambiguous.push({line,choices:ids});
    continue;
   }
   if(best.score<50)continue;
   const prev=found.get(best.p.id);
   if(!prev||best.score>prev.confidence)found.set(best.p.id,{id:best.p.id,name:best.p.name,team:best.p.team,confidence:best.score,method:best.full?"full name":best.teamHit?"initial + team":"initial + surname"});
  }
  // Report likely unidentified abbreviated Yahoo names for manual review.
  for(const line of lines){
   const m=line.match(/(?:^|\s)([a-z])\s+([a-z][a-z]{2,}(?:\s+[a-z]{3,})?)(?:\s|$)/);
   if(!m)continue;
   const maybe=m[1]+" "+m[2];
   if(/^(pg|sg|sf|pf|no|vs|at|g |c )/.test(maybe))continue;
   if(![...found.values()].some(p=>pieces(p.name)?.alias===maybe)&&!unknown.includes(maybe)&&unknown.length<15)unknown.push(maybe);
  }
  return {matches:[...found.values()],ambiguous,unknown};
 }
 return {clean,team,teamCodes,getMatches};
});