/* Identify Yahoo matchup left/right teams by player identities and scoreboard headings.
   Designed for multiple scrolled screenshots in arbitrary order. No network activity. */
(function(root,factory){
 "use strict";const api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.HoopIQMatchupTeams=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const normalize=s=>String(s||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toUpperCase()
  .replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();
 const ignore=/^(TEAM|MATCHUP|PLAYERS|LEAGUE|MATCHUP TOTALS|ALL MATCHUPS|GAMES PLAYED|POINTS|NO GAME|STARTERS|BENCH|IL|UTIL|PG|SG|SF|PF|C|F|G|WEEK|HOME|AWAY|VS|MON|TUE|WED|THU|FRI|SAT|SUN)(?:\s|$)/i;
 const score=/(?:^|\s)(\d{1,2},)?\d{3,4}\.\d{2}(?:\s|$)/;
 function headerLabel(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").map(x=>x.trim()).slice(0,65);
  const pointIndex=lines.findIndex(x=>score.test(x));
  if(pointIndex<0)return "";
  const start=Math.max(0,pointIndex-7);
  for(let i=pointIndex-1;i>=start;i--){
   const raw=lines[i],n=normalize(raw);
   if(!n||n.length<6||n.length>50||ignore.test(n))continue;
   if(/\b(?:PG|SG|PF|SF|UTIL|STARTERS|PROJECTION|GAME|GAMES|SCORE|TOTAL)\b/.test(n))continue;
   if(/^\s*[A-Z]\s*[.'’]\s*[A-Z]/i.test(raw)||/^\d/.test(n))continue;
   const words=n.split(" ");
   if(words.length<2||words.length>8)continue;
   if(!/^[A-Z0-9 &'’.-]+$/.test(raw.toUpperCase()))continue;
   return raw.replace(/\s+/g," ").trim().slice(0,60);
  }
  return "";
 }
 function scoreCandidates(file,matcher,pool,known){
  const left=String(file.leftText??file.homeText??""),right=String(file.rightText??file.awayText??"");
  const leftPlayers=(matcher(left,pool)?.matches||[]),rightPlayers=(matcher(right,pool)?.matches||[]);
  const own=new Set((known?.homeIds||[]).map(Number)),opp=new Set((known?.awayIds||[]).map(Number));
  let leftHome=0,rightHome=0,leftAway=0,rightAway=0;
  for(const p of leftPlayers){
   if(own.has(p.id)&&!opp.has(p.id))leftHome++;
   if(opp.has(p.id)&&!own.has(p.id))leftAway++;
  }
  for(const p of rightPlayers){
   if(own.has(p.id)&&!opp.has(p.id))rightHome++;
   if(opp.has(p.id)&&!own.has(p.id))rightAway++;
  }
  const leftLabel=headerLabel(left),rightLabel=headerLabel(right);
  const same=(a,b)=>normalize(a)&&normalize(a)===normalize(b);
  const knownHome=known?.homeName||"",knownAway=known?.awayName||"";
  let knownLeftHome=same(leftLabel,knownHome),knownRightHome=same(rightLabel,knownHome);
  let knownLeftAway=same(leftLabel,knownAway),knownRightAway=same(rightLabel,knownAway);
  // If a saved name is slightly OCR-imperfect, don't guess. Only exact normalized matches count.
  const leftVotes=leftHome*4+rightAway*4+(knownLeftHome?9:0)+(knownRightAway?9:0);
  const rightVotes=rightHome*4+leftAway*4+(knownRightHome?9:0)+(knownLeftAway?9:0);
  const anchorsLeft=leftHome+rightAway,anchorsRight=rightHome+leftAway;
  const nameAnchorsLeft=Number(knownLeftHome)+Number(knownRightAway);
  const nameAnchorsRight=Number(knownRightHome)+Number(knownLeftAway);
  let orientation="unknown";
  if(leftVotes-rightVotes>=6&&(anchorsLeft>=2||nameAnchorsLeft>=1))orientation="left";
  if(rightVotes-leftVotes>=6&&(anchorsRight>=2||nameAnchorsRight>=1))orientation="right";
  return {id:file.id,orientation,leftVotes,rightVotes,leftLabel,rightLabel,
   counts:{leftHome,rightHome,leftAway,rightAway},
   matchedLeft:leftPlayers.map(p=>Number(p.id)),matchedRight:rightPlayers.map(p=>Number(p.id)),
   confidence:orientation!=="unknown"?Math.min(99,Math.round(60+Math.abs(leftVotes-rightVotes))):0};
 }
 function identify(files,matcher,pool,known={}){
  const analyses=(files||[]).filter(f=>f.status==="done").map(f=>scoreCandidates(f,matcher,pool,known));
  const countLeft=analyses.filter(x=>x.orientation==="left").length;
  const countRight=analyses.filter(x=>x.orientation==="right").length;
  // Only borrow orientation from another screenshot if its evidence is decisive.
  const groupOrientation=countLeft&&!countRight?"left":countRight&&!countLeft?"right":"unknown";
  const resolved=analyses.map(a=>{
   const f=files.find(x=>x.id===a.id);
   const manual=f?.manualSide;
   const orientation=manual==="left"||manual==="right"?manual:
    (a.orientation!=="unknown"?a.orientation:groupOrientation);
   const source=manual==="left"||manual==="right"?"manual":
    a.orientation!=="unknown"?"players or team name":groupOrientation!=="unknown"?"same matchup as other screenshots":"needs confirmation";
   return {...a,orientation,source};
  });
  // Header names and weekly figures are often present in only one screenshot.
  const labels={home:[],away:[]},conflicts=[];
  for(const a of resolved){
   if(a.orientation==="unknown")continue;
   if(a.leftLabel)labels[a.orientation==="left"?"home":"away"].push(a.leftLabel);
   if(a.rightLabel)labels[a.orientation==="left"?"away":"home"].push(a.rightLabel);
  }
  function choose(list){
   const unique=[...new Map(list.map(s=>[normalize(s),s])).values()];
   if(unique.length>1)conflicts.push("Different team names were detected across screenshots: "+unique.join(" / "));
   return unique[0]||"";
  }
  const homeName=choose(labels.home),awayName=choose(labels.away);
  if(homeName&&awayName&&normalize(homeName)===normalize(awayName))conflicts.push("Both sides appear to have the same team name.");
  return {files:resolved,groupOrientation,homeName,awayName,conflicts,
   unresolved:resolved.filter(x=>x.orientation==="unknown").length,
   playerCounts:{home:new Set(resolved.flatMap(a=>a.orientation==="left"?a.matchedLeft:a.orientation==="right"?a.matchedRight:[])).size,
    away:new Set(resolved.flatMap(a=>a.orientation==="left"?a.matchedRight:a.orientation==="right"?a.matchedLeft:[])).size}};
 }
 return {normalize,headerLabel,scoreCandidates,identify};
});