const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const L=require("../matchup-layout-ocr.js");
const roles=["PG","SG","G","SF","PF","F","C","C","UTIL","UTIL","BN","BN","BN","IL"];
const names=[
 "Damian Lillard","Tyler Herro","Jalen Brunson","Jaime Jaquez Jr.","Miles Bridges",
 "Matas Buzelis","Victor Wembanyama","Zion Williamson","De'Aaron Fox",
 "Domantas Sabonis","Keegan Murray","Ja'Kobe Walter","Walker Kessler","Stephen Curry"
];
const players=names.map((name,i)=>({id:100+i,name,team:"TOR"}));
const abbrev=[
 "D. LILLARD","T. HERRO","J. BRUNSON","J. JAQUEZ JR.","M. BRIDGES",
 "M. BUZELIS","V. WEMBANYAMA","Z. WILLIAMSON","D. FOX","D. SABONIS",
 "K. MURRAY","J. WALTER","W. KESSLER","S. CURRY"
];
const lines=(start,end)=>players.slice(start,end).map((p,j)=>({text:abbrev[start+j],y:.14+j*.062,x:.22}));
const centers=(start,end)=>roles.slice(start,end).map((label,j)=>({text:label,y:.14+j*.062,x:.50}));
let first=L.labeled(players.slice(0,8),lines(0,8),centers(0,8));
let second=L.labeled(players.slice(6,14),lines(6,14),centers(6,14));
assert.deepEqual(first.map(p=>p.label),roles.slice(0,8),"PG-SG-G-SF-PF-F-C-C pills match same player rows");
assert.deepEqual(second.map(p=>p.label),roles.slice(6,14),"second screenshot starts at C and includes Bench and IL");
const resolved=L.resolve([{id:"top",hasHeader:true,rows:first},{id:"bottom",rows:second}]);
assert.equal(resolved.order.length,14,"two scrolled screenshots are deduplicated");
assert.deepEqual(resolved.order.slice(0,10).map(id=>resolved.positions[id]?.slot),
 ["PG:1","SG:1","G:1","SF:1","PF:1","F:1","C:1","C:2","UTIL:1","UTIL:2"]);
assert.equal(resolved.positions[110].slot,"BN");
assert.equal(resolved.positions[113].slot,"IL");
const uncertain=L.resolve([{id:"only",hasHeader:false,rows:[{id:100,label:"",y:.2}]}]);
assert(!uncertain.positions[100],"uncertain single player should stay review");
const allNoPills=L.resolve([{id:"top",hasHeader:true,rows:players.slice(0,8).map((p,i)=>({id:p.id,label:"",y:.1+i*.06}))},
 {id:"bottom",rows:players.slice(6).map((p,i)=>({id:p.id,label:"",y:.1+i*.06}))}]);
assert.equal(Object.keys(allNoPills.positions).length,10,"ten starter roles suggested for a complete Yahoo row order");
assert.equal(allNoPills.positions[100].confidence,"suggested");
assert(!allNoPills.positions[110],"unseen BN/IL boundaries must not be guessed");
const misplaced=L.resolve([{id:"top",hasHeader:true,rows:players.slice(0,11).map((p,i)=>({id:p.id,label:i===2?"SG":"",y:.08+i*.06}))}]);
assert(!misplaced.positions[100],"contradictory visible labels disable broad ordinal fallback");
const once=(s)=>({text:s});
const tsv="level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"+
 "5\t1\t1\t1\t1\t1\t110\t130\t35\t20\t90\tPG\n"+
 "5\t1\t1\t1\t2\t1\t112\t250\t38\t20\t88\tSG\n";
assert.deepEqual(L.roleRows(L.lines({tsv},320,1000)).map(r=>r.label),["PG","SG"]);
const scoreboard=[
 {text:"WOMEN APPRECIATORS",x:.22,y:.20},{text:"1489.00",x:.24,y:.29},
 {text:"0/43",x:.26,y:.38},{text:"ALEX SARR THE GOAT",x:.76,y:.20},
 {text:"1456.73",x:.77,y:.29},{text:"0/45",x:.75,y:.38},{text:"Week 5",x:.5,y:.75}
];
const totals=L.scoreboard(scoreboard);
assert.equal(totals.left.projection,"1489.00");
assert.equal(totals.right.projection,"1456.73");
assert.equal(totals.left.games,"0/43");
assert.equal(totals.right.games,"0/45");
assert.equal(totals.week,"5");
assert.equal(L.yahooWeekDate("5",new Date("2026-11-12T12:00:00-08:00")),"2026-11-16");
const html=fs.readFileSync("hoopiq/index.html","utf8");
assert(html.includes('matchup-layout-ocr.js?v=1'));
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim()).pop();
new vm.Script(inline,{filename:"HoopIQ index"});
const importer=fs.readFileSync("hoopiq/matchup-screenshot.js","utf8");
new vm.Script(importer,{filename:"matchup-screenshot.js"});
assert(importer.includes('s.autoWeek=proposed'),"date proposal updated");
assert(importer.includes('f.centerLines'),"center-pill geometry captured");
assert(importer.includes('"header-"+side'),"split header fallback used when a projection is missed");
assert(importer.includes("f.headerScore=scores"));
console.log("Yahoo lineup geometry and scoreboard passed: 14 players, overlapping roles, 1489 vs 1456.73, week 5 date.");
