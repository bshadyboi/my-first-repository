/* HoopIQ photo import aggregation: pure, testable, and no network calls. */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQBatchImport=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 function isConfident(p){
  return p&&Number(p.confidence)>=80&&p.method!=="initial + surname";
 }
 function reconcile(scans,match,manualMatches,reviewedKeys){
  const found=new Map(),ambiguous=[],unmatched=[];
  const resolved=new Set(reviewedKeys||[]);
  const seenUnknown=new Set(),seenAmbiguous=new Set();
  let duplicates=0,processed=0,failed=0;
  for(const scan of scans||[]){
   if(scan.status==="error"){failed++;continue}
   if(scan.status!=="done")continue;
   processed++;
   const result=match(String(scan.text||""))||{};
   for(const p of result.matches||[]){
    if(!p||!Number.isFinite(Number(p.id)))continue;
    const key=Number(p.id),current=found.get(key);
    if(current)duplicates++;
    const candidate={...p,id:key,needsReview:!isConfident(p)};
    if(!current||Number(candidate.confidence)>Number(current.confidence))found.set(key,candidate);
   }
   for(const a of result.ambiguous||[]){
    const key=String(scan.id)+"|"+String(a.line)+"|"+(a.choices||[]).join(",");
    if(resolved.has(key)||seenAmbiguous.has(key))continue;
    seenAmbiguous.add(key);
    ambiguous.push({...a,key,file:scan.name});
   }
   for(const raw of result.unknown||[]){
    const name=String(raw||"").trim(),key=name.toLowerCase();
    if(!name||seenUnknown.has(key))continue;
    seenUnknown.add(key);
    unmatched.push(name);
   }
  }
  for(const p of manualMatches||[]){
   if(!p?.id)continue;
   found.set(Number(p.id),{...p,id:Number(p.id),needsReview:false,confidence:150,method:"confirmed manually"});
  }
  const matches=[...found.values()];
  return {
   matches,
   needsReview:matches.filter(p=>p.needsReview),
   confident:matches.filter(p=>!p.needsReview),
   ambiguous:ambiguous.slice(0,30),
   unmatched:unmatched.filter(n=>!matches.some(p=>p.name.toLowerCase()===n.toLowerCase())).slice(0,15),
   duplicates,processed,failed
  };
 }
 return {reconcile,isConfident};
});