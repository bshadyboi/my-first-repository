const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const matcher=require("../roster-ocr.js");
const batch=require("../import-batch.js");
const people=[
 ["Ajay Mitchell","OKC"],["Jrue Holiday","POR"],["Nickeil Alexander-Walker","ATL"],
 ["Scottie Barnes","TOR"],["Anthony Davis","WSH"],["Anthony Black","ORL"],
 ["Aaron Gordon","DEN"],["Nic Claxton","CHI"],["Dylan Harper","SA"],
 ["Payton Pritchard","BOS"],["Aaron Mitchell","CLE"]
].map(([name,team],i)=>({id:100+i,name,team}));
const match=text=>matcher.getMatches(text,people);
const scans=[
 {id:"1",name:"Starters.jpg",status:"done",text:"A. MITCHELL\nPG SG OKC\nJ. HOLIDAY\nPG SG POR\nN. ALEXANDER-WALKER\nPG SG ATL\nS. BARNES\nTOR"},
 {id:"2",name:"Bench.jpg",status:"done",text:"S. BARNES\nTOR\nA. DAVIS\nPF C WAS\nA. BLACK\nORL\nA. GORDON\nDEN\nN. CLAXTON\nCHI\nD. HARPER\nSAS\nP. PRITCHARD\nBOS"},
 {id:"3",name:"Overlap.jpg",status:"done",text:"J. HOLIDAY\nPG SG POR"},
 {id:"4",name:"Unreadable.jpg",status:"error",error:"No readable text"}
];
const merged=batch.reconcile(scans,match,[],new Set());
assert.equal(merged.matches.length,10,"ten unique starters across multiple images");
assert.equal(new Set(merged.matches.map(x=>x.id)).size,10,"deduplicated by player ID");
assert(merged.duplicates>=2,"overlap counted");
assert.equal(merged.processed,3);
assert.equal(merged.failed,1);
assert.equal(merged.matches.find(x=>x.name==="Ajay Mitchell").needsReview,false);
assert.equal(merged.matches.find(x=>x.name==="Nic Claxton").needsReview,false);
const unknown=batch.reconcile([{id:"5",name:"Unclear",status:"done",text:"A. MITCHELL"}],match,[],new Set());
assert.equal(unknown.matches.length,0,"ambiguous initials are not guessed");
assert(unknown.ambiguous.length>0,"ambiguous candidates surfaced");
const low=batch.reconcile([{id:"6",name:"One match",status:"done",text:"J. HOLIDAY"}],match,[],new Set());
assert.equal(low.matches.length,1);
assert.equal(low.needsReview.length,1,"without team, initials need explicit confirmation");
assert.equal(batch.isConfident(low.matches[0]),false);
const selected=people.find(x=>x.name==="Ajay Mitchell");
const chosen=batch.reconcile([{id:"5",name:"Unclear",status:"done",text:"A. MITCHELL"}],match,[selected],new Set([unknown.ambiguous[0].key]));
assert.equal(chosen.matches[0].id,selected.id);
assert.equal(chosen.needsReview.length,0,"manual confirmation trusted");
assert.equal(chosen.ambiguous.length,0,"resolved ambiguity disappears");
const html=fs.readFileSync("hoopiq/index.html","utf8");
const addon=fs.readFileSync("hoopiq/matchup-hq.js","utf8");
const mainScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(t=>t.trim()).pop();
new vm.Script(mainScript,{filename:"hoopiq/index.html"});
new vm.Script(addon,{filename:"hoopiq/matchup-hq.js"});
for(const field of ["rosterFile","waiverFile","opponentFile"]){
 const source=field==="opponentFile"?addon:html;
 const re=new RegExp('<input id="'+field+'"[^>]*\\bmultiple\\b');
 assert(re.test(source),field+" allows multiple files");
}
assert(html.includes('src="/import-batch.js?v=1"'),"module included before main app");
assert(html.includes('scanYahooPhotos(t.files,"roster")'));
assert(html.includes('scanYahooPhotos(t.files,"waiver")'));
assert(addon.includes('scanYahooPhotos(t.files,"opponent")'));
assert(html.includes('data-scanid'),"scan removal and OCR correction wired");
console.log("Multi-image import regression tests passed: 10 unique players, dedup, ambiguity and review.");
