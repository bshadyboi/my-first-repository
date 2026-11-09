/* Generic, user-supplied private roster-link decoder. No user's roster is stored in this source file. */
(function(root, factory){
 "use strict";
 const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQPersonalLink=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const PREFIX="#hoopiq-roster=";
 function validate(data){
  if(!data||data.v!==1||!Array.isArray(data.players)||data.players.length<1||data.players.length>60)return null;
  const players=[],ids=new Set(),slots=new Set();
  for(const item of data.players){
   if(!Array.isArray(item)||item.length!==4)return null;
   const [i,n,t,p]=item,id=Number(i),name=String(n||"").trim(),team=String(t||"").toUpperCase(),slot=String(p||"").toUpperCase();
   if(!Number.isSafeInteger(id)||id<1||id>999999999||ids.has(id))return null;
   if(name.length<3||name.length>110||!(/^[A-Za-z0-9 .,'’\-]+$/).test(name))return null;
   if(!/^[A-Z]{2,4}$/.test(team))return null;
   if(!/^(?:PG|SG|G|SF|PF|F|C|UTIL):[1-6]$|^BN$|^IL$|^UNASSIGNED$/.test(slot))return null;
   if(slot.includes(":")&&slots.has(slot))return null;
   ids.add(id);if(slot.includes(":"))slots.add(slot);
   players.push({id,name,team,slot});
  }
  return {v:1,players};
 }
 function fromHash(hash){
  if(typeof hash!=="string"||!hash.startsWith(PREFIX))return null;
  const token=hash.slice(PREFIX.length);
  if(token.length<8||token.length>9500||!/^[A-Za-z0-9_-]+={0,2}$/.test(token))return null;
  try{
   const input=token.replace(/-/g,"+").replace(/_/g,"/");
   const decoder=typeof atob==="function"?atob:(s)=>Buffer.from(s,"base64").toString("binary");
   const raw=decoder(input);
   return validate(JSON.parse(raw));
  }catch(e){return null}
 }
 function label(slot){return slot==="BN"?"Bench":slot==="IL"?"Injured List":slot==="UNASSIGNED"?"Unassigned":slot.replace(":", " · ")}
 return {PREFIX,validate,fromHash,label};
});