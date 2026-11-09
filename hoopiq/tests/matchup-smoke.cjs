const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("hoopiq/index.html","utf8");
const match = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert(match.length >= 1, "Main inline app script missing");
for(const m of match) if(m[1].trim()) new vm.Script(m[1],{filename:"hoopiq/index-inline.js"});
const source = fs.readFileSync("hoopiq/matchup-hq.js","utf8");
new vm.Script(source,{filename:"hoopiq/matchup-hq.js"});
const window = {HoopIQLineup:require("../lineup-slots.js")};
vm.runInNewContext(source,{window});
const api = window.HoopIQMatchup;
assert(api && typeof api.renderOpponent==="function" && typeof api.renderMatchup==="function");
for(const name of ["onClick","onChange","onInput"])assert.equal(typeof api[name],"function");
assert(/src="\/matchup-hq\.js\?v=\d+"/.test(html));
assert(/href="\/matchup-hq\.css\?v=\d+"/.test(html));
assert(html.includes('opponentRoster:[]'),"Opponent must have separate persistent roster");
assert(html.includes('opponent:()=>window.HoopIQMatchup.renderOpponent'));
assert(html.includes('matchup:()=>window.HoopIQMatchup.renderMatchup'));
const athlete=(id,name,team)=>({id,name,team,pos:"G",pts:20,reb:4,ast:6,stl:1,blk:0,tov:2,threes:2,source:"real"});
const athletes=[athlete(1,"One Player","LAL"),athlete(2,"Two Player","ATL")];
let updated=0;
const state={opponent:"Rival",opponentRoster:[],opponentManual:false,opponentQuery:"",opponentImportOpen:false,opponentPasteOpen:false,opponentManualAddOpen:false,
  manualRoster:true,name:"My Team",roster:[1],lineupCount:6,weekStart:"2026-11-09",cachePlayers:{},scoring:{}};
const review={target:"opponent",names:[{id:2,name:"Two Player",team:"ATL"}],selected:new Set([2]),replaceRoster:false,error:"",preview:"",busy:false};
const button=(action,label)=>'<button data-action="'+action+'">'+label+'</button>';
const card=(title,inner)=>'<section><h2>'+title+'</h2>'+inner+'</section>';
const ctx={state,imageReview:review,renderLineup:()=>card("Saved opponent roster","Lineup slots"),lineupCapacity:()=>10,currentLineupSlots:()=>window.HoopIQLineup.DEFAULT,nbaPlayers:athletes,players:athletes,P:id=>athletes.find(p=>p.id===Number(id)),
  normalizeName:name=>name.toLowerCase().replace(/\s+/g,""),esc:value=>String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;"),
  button,card,icon:p=>'<span>'+p.name+'</span>',f:(x,n=1)=>Number(x).toFixed(n),
  fp:p=>p.pts+p.reb*1.2+p.ast*1.5+p.stl*3-p.tov,weekDate:(s,n)=>new Date(Date.parse(s+"T12:00:00Z")+n*86400000).toISOString().slice(0,10),
  weekGame:(p,date)=>date==="2026-11-09"?[{}]:[],weekControls:()=>"",scheduleReady:()=>true,scheduleNotice:()=>"",
  sampleRoster:()=>[athletes[0]],addDropSuggestions:()=>[],suggestionCards:()=>"",weekInfo:{partial:false},
  persist:()=>updated++,render:()=>updated++,toast:()=>{},scanYahooPhoto:()=>{},suggestPhotoNames:()=>{},
  clearImageReview:()=>{review.names=[];review.selected=new Set()},route:()=>{},$:()=>null};
assert(api.renderOpponent(ctx).includes("Opponent roster"));
assert(api.renderMatchup(ctx).includes("Import both rosters"));
assert(api.onClick(ctx,"opponentApprove",{}));
assert.deepEqual(Array.from(state.opponentRoster),[2]);
assert(state.opponentManual);
assert(updated>0);
const hq=api.renderMatchup(ctx);
assert(hq.includes("Matchup HQ")&&hq.includes("Rival")&&hq.includes("Scheduled games"),"Versus page failed");
assert(hq.includes("not verified future projections"),"Missing projection caveat");
assert(api.onChange(ctx,{dataset:{reviewopponent:"2"},checked:true}));
assert(review.selected.has(2));
console.log("HoopIQ Matchup HQ smoke checks passed.");
