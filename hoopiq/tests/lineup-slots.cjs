const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const L=require("../lineup-slots.js");
const ids=Array.from({length:16},(_,i)=>i+1);
const placements={
 1:"PG:1",2:"SG:1",3:"G:1",4:"SF:1",5:"PF:1",6:"F:1",7:"C:1",
 8:"UTIL:1",9:"UTIL:2",10:"BN",11:"BN",12:"BN",13:"BN",14:"IL",15:"IL",16:"UNASSIGNED"
};
const original=L.normalizeRoster(ids,placements);
assert.equal(original.count,16,"IL players count toward total roster");
assert.equal(original.slots.length,10,"user example has ten starter slots");
assert.equal(original.active,9,"empty second center slot remains visible");
assert.deepEqual(original.slots.filter(s=>s.id==null).map(s=>s.key),["C:2"]);
assert.equal(original.bn.length,4);
assert.equal(original.il.length,2);
assert.equal(original.unassigned.length,1);
assert.deepEqual(L.eligible(ids,placements).length,14,"IL excluded from modeled active candidates");
const fill=L.move(ids,placements,10,"C:2");
assert.equal(fill[10],"C:2","bench player can fill empty C");
assert.equal(fill[14],"IL","unrelated injured players preserved");
const swap=L.move(ids,placements,10,"PG:1");
assert.equal(swap[10],"PG:1","bench player can replace starter");
assert.equal(swap[1],"BN","displaced starter goes to bench");
const directSwap=L.move(ids,placements,1,"SG:1");
assert.equal(directSwap[1],"SG:1");
assert.equal(directSwap[2],"PG:1","starter-to-starter swap preserves both players");
const putOnIL=L.move(ids,placements,3,"IL");
assert.equal(putOnIL[3],"IL");
assert.equal(L.normalizeRoster(ids,putOnIL).il.length,3,"unlimited extra IL beyond two");
assert.equal(L.normalizeRoster(ids,putOnIL).count,16,"moving to IL never drops player");
assert.equal(L.normalizeRoster(ids,putOnIL).active,8);
const returnFromIL=L.move(ids,putOnIL,14,"G:1");
assert.equal(returnFromIL[14],"G:1");
assert.equal(returnFromIL[3],"IL");
const invalid=L.move(ids,placements,11,"C:999");
assert.equal(invalid[11],"UNASSIGNED","invalid slot cannot corrupt lineup");
const changed=L.normalizeRoster(ids,placements,["PG","SG","C"]);
assert.equal(changed.count,16,"changing league slot template does not delete players");
assert.equal(changed.il.length,2);
assert(changed.unassigned.length>=1);
const samplePlayers=[
 {id:1,name:"John Walter"}, {id:7,name:"Walker Kessler"},
 {id:11,name:"Jalen Brunson"}, {id:14,name:"Zion Williamson"},
 {id:15,name:"Keegan Murray"}
];
const screenshot=[
 "Starters","PG","J. WALTER","PG SG TOR",
 "C","Empty","C","W. KESSLER","C LAL",
 "Bench","J. BRUNSON","PG NYK","Injured List",
 "Z. WILLIAMSON","PF C NOP","K. MURRAY","SF PF SAC"
].join("\n");
const hints=L.identify(screenshot,samplePlayers);
assert.equal(hints[1]?.position,"PG:1");
assert.equal(hints[7]?.position,"C:2","first C empty; second C occupied");
assert.equal(hints[11]?.position,"BN");
assert.equal(hints[14]?.position,"IL");
assert.equal(hints[15]?.position,"IL");
const html=fs.readFileSync("hoopiq/index.html","utf8");
const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim()).pop();
new vm.Script(js,{filename:"hoopiq/index.html"});
const opponent=fs.readFileSync("hoopiq/matchup-hq.js","utf8");
new vm.Script(opponent,{filename:"hoopiq/matchup-hq.js"});
assert(html.includes('src="/lineup-slots.js?v=1"'));
for(const marker of ['renderLineup("roster")','data-lineup-team','data-fill-team','data-import-position','rosterPositions:{}','lineupCapacity()','Injured List · IL'])assert(html.includes(marker),marker);
assert(opponent.includes('c.renderLineup("opponent")'));
assert(opponent.includes("opponentPositions"));
assert(opponent.includes('state.opponentPositions=placements'));
assert(!html.includes("state.roster=next.slice(0,30)"));
console.log("Yahoo lineup / bench / IL regression passed: empty slots, swaps, flexible IL and screenshot hints.");
