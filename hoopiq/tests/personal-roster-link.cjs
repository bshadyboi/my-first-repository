const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const link=require("../personal-roster-link.js");
const fixture={
 v:2,
 players:[[101,"First Player","OKC","PG:1"],[102,"Second Player","SAC","C:1"],[103,"Third Player","TOR","BN"],[104,"Fourth Player","SAS","IL"]],
 opponentPlayers:[[201,"Fifth Player","ATL","G:1"],[202,"Sixth Player","CHI","C:2"]],
 opponentName:"Strictly BBLs",
 opponentIncomplete:true
};
const token=Buffer.from(JSON.stringify(fixture),"utf8").toString("base64url");
const parsed=link.fromHash("#hoopiq-roster="+token);
assert(parsed&&parsed.v===2);
assert.equal(parsed.players.length,4);
assert.equal(parsed.opponentPlayers.length,2);
assert.equal(parsed.opponentName,"Strictly BBLs");
assert(parsed.opponentIncomplete);
assert.deepEqual(parsed.players.map(p=>p.slot),["PG:1","C:1","BN","IL"]);
assert.equal(link.fromHash("#other="+token),null,"unrelated hashes ignored");
assert.equal(link.fromHash("#hoopiq-roster=invalid---"),null,"corrupt data rejected");
assert.equal(link.validate({...fixture,players:[...fixture.players,fixture.players[0]]}),null,"duplicate player IDs rejected");
assert.equal(link.validate({...fixture,opponentPlayers:[[201,"One","ATL","C:1"],[202,"Two","CHI","C:1"]]}),null,"duplicate starter slots rejected");
assert.equal(link.validate({...fixture,opponentName:"<script>bad</script>"}),null,"unsafe team names rejected");
assert.equal(link.validate({...fixture,opponentPlayers:[]}),null,"incomplete team arrays not accepted");
const legacy={v:1,players:[[100,"Legacy Player","MIL","SG:1"]]};
assert.equal(link.validate(legacy).players.length,1,"v1 still supported");
assert.equal(link.validate(legacy).opponentPlayers.length,0);
const html=fs.readFileSync("hoopiq/index.html","utf8");
assert(html.includes('src="/personal-roster-link.js?v=1"'));
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim()).pop();
new vm.Script(inline,{filename:"hoopiq/index.html"});
assert(html.includes('function personalRosterPreview()'));
assert(html.includes('function applyPersonalRosterLink()')||html.includes('async function applyPersonalRosterLink()'));
assert(html.includes('state.opponentRoster=next'),"opponent merged into existing rather than cleared");
assert(html.includes('state.opponentPositions=assignments'));
assert(html.includes('state.roster=own.map(p=>p.id)'));
assert(html.includes('const notFound=imported.filter(item=>!matched.has(item.id))'));
assert(html.indexOf('if(notFound.length)throw Error')<html.indexOf('state.roster=own.map(p=>p.id)'),"atomic verification before saved writes");
assert(html.includes('opponentIncomplete'));
console.log("Private two-team lineup link validated: safe payload, old v1, opponent merge and atomic review.");
