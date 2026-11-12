const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const mod=(src,root={})=>{
 const module={exports:{}};
 const f=new Function("window","module","exports",src);
 f(root,module,module.exports);
 return module.exports;
};
const root={};
const ocr=mod(fs.readFileSync("hoopiq/roster-ocr.js","utf8"),root);
const detect=mod(fs.readFileSync("hoopiq/matchup-team-detection.js","utf8"),root);
const imported=mod(fs.readFileSync("hoopiq/matchup-screenshot.js","utf8"),root);
const pool=[
 ["Stephen Curry","GSW"],["Victor Wembanyama","SAS"],["Jalen Brunson","NYK"],
 ["Damian Lillard","POR"],["Alex Sarr","WAS"],["Trae Young","WAS"],
 ["Donovan Mitchell","CLE"],["Cade Cunningham","DET"],["Tyler Herro","MIL"]
].map(([name,team],i)=>({id:100+i,name,team}));
const own=[100,101,102,103,108],opp=[104,105,106,107];
const known={homeIds:own,awayIds:opp,homeName:"My Fantasy Team",awayName:"Last Week Rival"};
const screenshotLower={id:"lower",status:"done",leftText:"V. WEMBANYAMA\nC SAS\nD. LILLARD\nPG POR",
 rightText:"A. SARR\nC WAS\nC. CUNNINGHAM\nPG DET"};
const screenshotTop={id:"top",status:"done",
 leftText:"Strictly BBLs\nTeam Matchup Players League\nWOMEN APPRECIATORS\n1489.00\n0/43\nWeek 5\nD. LILLARD\nPG POR\nT. HERRO\nSG MIL\nJ. BRUNSON\nPG NYK",
 rightText:"ALEX SARR THE GOAT\n1456.73\n0/45\nT. YOUNG\nPG WAS\nD. MITCHELL\nPG CLE"};
const check=detect.identify([screenshotLower,screenshotTop],ocr.getMatches,pool,known);
assert.equal(check.unresolved,0);
assert.equal(check.groupOrientation,"left");
assert(check.files.every(x=>x.orientation==="left"),"screenshots grouped in arbitrary order");
assert.equal(check.homeName,"WOMEN APPRECIATORS");
assert.equal(check.awayName,"ALEX SARR THE GOAT");
assert.equal(check.conflicts.length,0);
assert.equal(check.playerCounts.home,4);
assert.equal(check.playerCounts.away,4);
assert(!check.files.find(x=>x.id==="top").matchedRight.includes(104),"Header name must not hallucinate Alex Sarr as a rostered player");
assert(!ocr.getMatches(detect.stripHeader(screenshotTop.rightText),pool).matches.some(p=>p.name==="Alex Sarr"));
const reversed={...screenshotLower,id:"reversed",leftText:screenshotLower.rightText,rightText:screenshotLower.leftText};
const split=detect.identify([screenshotTop,reversed],ocr.getMatches,pool,known);
assert.equal(split.files.find(x=>x.id==="top").orientation,"left");
assert.equal(split.files.find(x=>x.id==="reversed").orientation,"right","a reversed screenshot is identified independently");
const unknown={id:"unknown",status:"done",leftText:"C. WALLACE\nPG OKC",rightText:"A. BAILEY\nSF UTA"};
const inherited=detect.identify([screenshotTop,unknown],ocr.getMatches,pool,known);
assert.equal(inherited.files.find(x=>x.id==="unknown").orientation,"left");
assert.equal(inherited.files.find(x=>x.id==="unknown").source,"same matchup as other screenshots");
const unidentified=detect.identify([unknown],ocr.getMatches,pool,known);
assert.equal(unidentified.unresolved,1,"insufficient evidence prompts confirmation");
assert.equal(detect.identify([{...unknown,manualSide:"right"}],ocr.getMatches,pool,known).unresolved,0,"manual override works");
const named=detect.identify([screenshotTop],ocr.getMatches,pool,{homeName:"WOMEN APPRECIATORS",awayName:"ALEX SARR THE GOAT",homeIds:[],awayIds:[]});
assert.equal(named.unresolved,0,"header exact match can identify teams without roster data");
const session=imported.session;
const c={
 state:{manualRoster:true,roster:own,opponentManual:true,opponentRoster:opp,
  name:"My Fantasy Team",opponent:"Last Week Rival",cachePlayers:{},matchupSnapshots:{},weekStart:"2026-11-16",scoring:{pts:1}},
 nbaPlayers:pool,players:[],render:()=>{},persist:()=>{},toast:()=>{},$:()=>null
};
session.files=[screenshotLower,screenshotTop];
session.week="2026-11-16";
imported.parse(c);
assert.deepEqual(session.home.map(p=>p.name).sort(),["Damian Lillard","Jalen Brunson","Tyler Herro","Victor Wembanyama"].sort());
assert.deepEqual(session.away.map(p=>p.name).sort(),["Alex Sarr","Cade Cunningham","Donovan Mitchell","Trae Young"].sort());
assert.equal(session.home.find(p=>p.name==="Damian Lillard").sourceCount,2,"overlapping screenshots deduplicated");
assert.equal(session.homeProjection,"1489.00");
assert.equal(session.awayProjection,"1456.73");
assert.equal(session.homeGames,"0/43");
assert.equal(session.awayGames,"0/45");
assert.equal(session.homeName,"WOMEN APPRECIATORS");
assert.equal(session.awayName,"ALEX SARR THE GOAT");
assert(session.identity.unresolved===0);
const review=imported.render({...c,card:(name,body)=>"<div>"+body+"</div>",button:(action,label)=>"<button>"+label+"</button>"});
session.open=true;
const open=imported.render({...c,card:(name,body)=>"<div>"+body+"</div>",button:(action,label)=>"<button>"+label+"</button>"});
assert(open.includes("Who is on each side?"));
assert(open.includes("data-weekly-image-side"),"each image can be corrected separately");
assert(open.includes("My team LEFT · Opponent RIGHT"));
assert(open.includes("Matched 4 unique players"),"merged count visible");
const html=fs.readFileSync("hoopiq/index.html","utf8");
assert(html.includes("matchup-team-detection.js?v=1"));
assert(html.includes("matchup-screenshot.js?v=2"));
const mainScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim()).pop();
new vm.Script(mainScript,{filename:"index.html"});
new vm.Script(fs.readFileSync("hoopiq/matchup-screenshot.js","utf8"),{filename:"matchup-screenshot.js"});
session.files=[unknown];session.home=[];session.away=[];session.base={home:[],away:[]};
session.homeName="";session.awayName="";session.homeProjection="";session.awayProjection="";
session.homeGames="";session.awayGames="";session.weekNumber="";
session.userEditedNames={home:false,away:false};session.detectedNames={home:"",away:""};
imported.parse(c);
assert.equal(session.identity.unresolved,1);
imported.save(c);
assert.match(session.error,/could not be assigned/i);
assert.deepEqual(c.state.matchupSnapshots,{},"unknown screenshot must not be saved");
console.log("Two-screen Yahoo matchup detection passed: unordered images, overlap, swap, headers, review and save guard.");
