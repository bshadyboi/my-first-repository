/* HoopIQ Matchup HQ — companion to the existing app; local-only opponent roster. */
(function(){
"use strict";
function opponentPlayers(c){
 const {state,P,nbaPlayers,normalizeName}=c;
 return (Array.isArray(state.opponentRoster)?state.opponentRoster:[]).map(id=>P(id)).filter(Boolean).map(p=>nbaPlayers.find(q=>normalizeName(q.name)===normalizeName(p.name))||p);
}
function review(c){
 const {imageReview:r,esc,button,state,importBatchPanel}=c;
 let body='<section class="card pad"><div class="cardhead"><h2>Import opponent screenshots</h2><span class="pill blue">Multi-image upload</span></div>'+
 '<div class="import-intro"><div class="import-icon">📸</div><div><h3>Scan their entire Yahoo roster</h3><p>Select screenshots showing starters, bench and IL together, or add more images later. We combine results, remove duplicates and show uncertain names for review.</p></div></div>'+
 '<div class="import-actions">'+button("opponentPhoto","📷 Upload screenshots","primary")+
 button("opponentPasteToggle","Paste names","ghost")+button("opponentManualToggle","Add manually","ghost")+'</div>'+
 '<input id="opponentFile" type="file" accept="image/*" multiple style="display:none" aria-label="Choose multiple opponent roster screenshots">'+
 (importBatchPanel?importBatchPanel("opponent"):"");
 if(state.opponentPasteOpen)body+='<div style="margin-top:15px"><label class="muted small" for="opponentPaste">Paste player names (one per line)</label><textarea class="textinput" id="opponentPaste" style="width:100%;min-height:115px;display:block;margin:8px 0" placeholder="Jalen Brunson&#10;Mikal Bridges"></textarea>'+
 button("opponentParsePaste","Add pasted names to review","primary xs")+'</div>';
 body+='<p class="import-helper">Images are scanned locally on your device. Confirm names before saving; HoopIQ does not write to Yahoo.</p></section>';
 return body;
}
function renderOpponent(c){
 const {state,esc,button,card,icon,fp,f,nbaPlayers,players}=c;
 const rr=opponentPlayers(c),query=String(state.opponentQuery||"").trim().toLowerCase();
 let html='<div class="pagehead"><div><div class="eyebrow">MATCHUP SETUP · STEP 2 OF 3</div><h1>Opponent roster</h1><p>Add the team you face this week to unlock matchup comparisons and personalized waiver options.</p></div>'+
 '<div class="buttonrow">'+button("opponentImportToggle",state.opponentImportOpen?"Hide uploader":"📷 Import opponent","primary")+'</div></div>'+
 '<div class="hq-steps"><span class="'+(state.manualRoster?"done":"")+'">1 · My Team</span><span class="'+(rr.length?"done":"")+'">2 · Opponent</span><span>3 · Matchup HQ</span></div>';
 html+=card("Who are you playing?",'<div class="row" style="flex-wrap:wrap"><input id="opponentNameInput" class="textinput grow" value="'+esc(state.opponent||"Opponent")+'" maxlength="48" placeholder="Opponent team name">'+button("opponentSaveName","Save","ghost")+'</div>')+'<div style="height:14px"></div>';
 if(!rr.length||state.opponentImportOpen)html+=review(c)+'<div style="height:14px"></div>';
 if(state.opponentManualAddOpen){
  const choices=(nbaPlayers.length?nbaPlayers:players).filter(p=>!(state.opponentRoster||[]).includes(p.id)&&(!query||(p.name+" "+p.team).toLowerCase().includes(query))).slice(0,80);
  html+=card("Add a player manually",'<label class="muted small" for="opponentQuery">Search NBA players</label><input id="opponentQuery" class="textinput" autocomplete="off" placeholder="Find a player…" style="display:block;width:100%;margin:8px 0" value="'+esc(state.opponentQuery||"")+'"><select id="addopponent" class="select" style="width:100%"><option value="">Select player to add…</option>'+choices.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+esc(p.team)+'</option>').join("")+'</select>')+'<div style="height:14px"></div>';
 }
 html+=c.renderLineup("opponent");
 html+='<div class="hq-cta">'+button("matchup","⚔ Compare our teams","primary")+button("league","Edit my team","ghost")+'</div>';
 return html;
}
function snapshot(c,list){
 const {state,weekDate,weekGame,fp}=c;
 const cap=c.lineupCapacity(),categories={pts:0,reb:0,ast:0,stl:0,blk:0,tov:0};
 let games=0,starts=0,blocked=0,points=0;
 const daily=[];
 for(let i=0;i<7;i++){
  const date=weekDate(state.weekStart,i);
  const all=list.flatMap(p=>weekGame(p,date).map(g=>p)).sort((a,b)=>fp(b)-fp(a));
  const active=all.slice(0,cap),value=active.reduce((sum,p)=>sum+fp(p),0);
  games+=all.length;starts+=active.length;blocked+=Math.max(0,all.length-cap);points+=value;
  for(const p of active)for(const key in categories)categories[key]+=Number(p[key])||0;
  daily.push({date,starts:active.length,scheduled:all.length});
 }
 return {games,starts,blocked,points,daily,categories};
}
function renderMatchup(c){
 const {state,esc,button,card,sampleRoster,scheduleReady,scheduleNotice,weekControls,f,weekInfo,addDropSuggestions,suggestionCards}=c;
 const own=state.manualRoster?sampleRoster().filter(p=>(state.rosterPositions||{})[p.id]!=="IL"):[],opp=state.opponentManual?opponentPlayers(c).filter(p=>(state.opponentPositions||{})[p.id]!=="IL"):[];
 const haveOwn=own.length>0,haveOpp=opp.length>0;
 const header='<div class="pagehead"><div><div class="eyebrow">YOUR WEEKLY GAME PLAN</div><h1>⚔ Matchup HQ</h1><p>Both teams, weekly points, lineup conflicts, and the waiver move that fits your schedule.</p></div><div class="buttonrow">'+weekControls()+'</div></div>'+(window.HoopIQWeeklyImport?.render(c)||"");
 if(!haveOwn||!haveOpp)return header+'<div class="hq-steps"><span class="'+(haveOwn?"done":"")+'">1 · My Team</span><span class="'+(haveOpp?"done":"")+'">2 · Opponent</span><span>3 · Matchup HQ</span></div>'+
  card("Set up your matchup",'<div class="note blue">Import both rosters first. We never pretend example players are your real fantasy team.</div><div class="grid two" style="margin-top:15px">'+
  '<div class="hq-setup"><b>♙ Your team</b><p>'+(haveOwn?own.length+' confirmed players':'Your real roster is missing')+'</p>'+button("league",haveOwn?"Review my roster":"📸 Import my roster",haveOwn?"ghost":"primary")+'</div>'+
  '<div class="hq-setup"><b>♧ Opponent</b><p>'+(haveOpp?opp.length+' confirmed players':'Their roster is missing')+'</p>'+button("opponent",haveOpp?"Review opponent":"📸 Import opponent",haveOpp?"ghost":"primary")+'</div></div>')+
  '<div class="hq-cta">'+button("waivers","Browse waiver candidates","ghost")+'</div>';
 if(!scheduleReady())return header+scheduleNotice()+card("Rosters saved","The game schedule must load before we calculate a weekly matchup. No calendar or point totals are invented.");
 const missingStats=[...own,...opp].filter(p=>p.statsUnavailable);
 if(missingStats.length){
   return header+card("Some players do not have current-season statistics",
    '<div class="note warn">The following players appear on an NBA roster but lack current-season averages: <b>'+missingStats.map(p=>esc(p.name)).join(", ")+'</b>. HoopIQ will not treat missing numbers as zero or invent projections. Review those players before relying on matchup totals.</div>'+
    '<div class="buttonrow" style="margin-top:15px">'+button("opponent","Edit opponent","ghost")+button("league","Review my roster","ghost")+button("matchups","See games this week","primary")+'</div>');
 }
 const mine=snapshot(c,own),other=snapshot(c,opp),diff=mine.points-other.points,nm=esc(state.name||"My Team"),oppName=esc(state.opponent||"Opponent");
 const margin=(diff>=0?"You lead by ":"You trail by ")+f(Math.abs(diff))+" modeled FP";
 const kpi=(k,v,n)=>'<div class="overview-kpi"><span>'+k+'</span><b>'+v+'</b><span>'+n+'</span></div>';
 let html=header+'<div class="hq-versus"><div><small>♛ '+nm+'</small><strong>'+f(mine.points)+'</strong><span>'+mine.starts+' usable starts</span></div>'+
 '<div class="hq-vs"><b>VS</b><span class="'+(diff>=0?"up":"down")+'">'+margin+'</span></div>'+
 '<div><small>♧ '+oppName+'</small><strong>'+f(other.points)+'</strong><span>'+other.starts+' usable starts</span></div></div>';
 html+='<div class="overview-kpis hq-kpis">'+kpi("Scheduled games",mine.games+' vs '+other.games,"Both teams")+kpi("Usable starts",mine.starts+' vs '+other.starts,"Daily active limit")+kpi("Bench conflicts",mine.blocked+' vs '+other.blocked,"Blocked by crowded days")+'</div>';
 const dayName=date=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(date+"T12:00:00Z").getUTCDay()];
 const map='<div class="hq-map"><div></div>'+mine.daily.map(d=>'<b>'+dayName(d.date)+'</b>').join("")+
 '<span>My team</span>'+mine.daily.map(d=>'<em class="'+(d.starts?"hq-play":"")+'">'+d.starts+'</em>').join("")+
 '<span>'+oppName+'</span>'+other.daily.map(d=>'<em class="'+(d.starts?"hq-opp":"")+'">'+d.starts+'</em>').join("")+'</div><p class="strategy-note">Number of usable games after applying your daily lineup capacity.</p>';
 const cats=Object.entries({pts:"Points",reb:"Rebounds",ast:"Assists",stl:"Steals",blk:"Blocks",tov:"Turnovers"}).map(([key,label])=>{
  const a=mine.categories[key],b=other.categories[key],total=Math.max(1,a+b);
  return '<div class="hq-category"><span>'+label+'</span><div class="hq-bars"><i style="width:'+Math.max(2,a/total*100)+'%"></i><i style="width:'+Math.max(2,b/total*100)+'%"></i></div><strong>'+f(a,0)+' / '+f(b,0)+'</strong></div>';
 }).join("")+'<p class="strategy-note">Modeled stat totals for context; points league scoring uses your custom FP weights.</p>';
 html+='<div class="grid two" style="margin-top:15px">'+card("📅 Seven-day schedule",map)+card("Stat contribution",cats)+'</div>';
 const adds=addDropSuggestions(3);
 html+='<div class="grid two" style="margin-top:15px">'+
 card("⚡ What move helps me win this week?",adds.length?suggestionCards(adds,true):
 '<div class="empty">Import players you confirmed are available in Yahoo to generate add/drop comparisons. We won\'t assume everyone is on waivers.</div><div class="hq-cta">'+button("waivers","Import available players","primary")+'</div>')+
 card("Matchup opportunities",'<div class="statrow"><span>Scheduled games advantage</span><b>'+((mine.games-other.games)>=0?"+":"")+(mine.games-other.games)+'</b></div>'+
 '<div class="statrow"><span>Your bench conflicts</span><b>'+mine.blocked+'</b></div>'+
 '<div class="statrow"><span>Your open weekly starter slots</span><b>'+mine.daily.reduce((n,d)=>n+Math.max(0,c.lineupCapacity()-d.starts),0)+'</b></div>'+
 '<div class="statrow"><span>Modeled weekly margin</span><b class="'+(diff>=0?"up":"down")+'">'+(diff>=0?"+":"")+f(diff)+' FP</b></div>'+
 '<div class="buttonrow" style="margin-top:15px">'+button("matchups","Full weekly heatmap","ghost xs")+button("opponent","Edit opponent","ghost xs")+'</div>')+'</div>';
 html+='<p class="strategy-note" style="margin:18px 0">* These are estimates from season per-game averages and scheduled games, not verified future projections or win odds. IL players are excluded. Detailed Yahoo slot eligibility, acquisition rules and lineup locks are not yet modeled. '+(weekInfo.partial?"The schedule feed is partial; projections may be incomplete.":"")+'</p>';
 return html;
}
function onClick(c,a,el){
 if(window.HoopIQWeeklyImport?.onClick(c,a,el))return true;
 const {state,imageReview:r,render,persist,toast,button,P,nbaPlayers,players,scanYahooPhoto,suggestPhotoNames,clearImageReview,$}=c;
 if(a==="opponentImportToggle"){state.opponentImportOpen=!state.opponentImportOpen;persist();render();return true}
 if(a==="opponentManualToggle"){state.opponentManualAddOpen=!state.opponentManualAddOpen;persist();render();return true}
 if(a==="opponentPasteToggle"){state.opponentPasteOpen=!state.opponentPasteOpen;render();return true}
 if(a==="opponentSaveName"){state.opponent=($("opponentNameInput")?.value||"Opponent").trim().slice(0,48)||"Opponent";persist();render();toast("Opponent updated");return true}
 if(a==="opponentPhoto"){r.replaceRoster=false;$("opponentFile")?.click();return true}
 if(a==="opponentParsePaste"){r.replaceRoster=false;suggestPhotoNames($("opponentPaste")?.value||"","opponent");return true}
 if(a==="opponentCancel"){clearImageReview();render();return true}
 if(a==="opponentApprove"){
  if(r.target!=="opponent"||r.busy)return true;
  const ids=[...r.selected].filter(id=>r.names.some(p=>p.id===id));
  if(!ids.length){toast("Select at least one player");return true}
  if(r.replaceRoster&&(state.opponentRoster||[]).length&&!confirm("Replace all saved opponent players?"))return true;
  const next=r.replaceRoster?[]:[...(state.opponentRoster||[])];
  let placements=r.replaceRoster?{}:{...(state.opponentPositions||{})};
  for(const id of ids){
   const player=nbaPlayers.find(p=>p.id===id)||players.find(p=>p.id===id)||state.cachePlayers?.[id];
   if(!player)continue;
   if(!next.includes(id))next.push(id);
   state.cachePlayers={...(state.cachePlayers||{}),[id]:player};
   const target=r.positions?.[id];
   if(target&&(r.positionEdited?.has(id)||!placements[id])){
    placements=window.HoopIQLineup.move(next,placements,id,target,c.currentLineupSlots());
   }else if(!placements[id])placements[id]="UNASSIGNED";
  }
  state.opponentRoster=next;state.opponentPositions=placements;state.opponentManual=true;
  state.opponentImportOpen=false;clearImageReview();persist();render();toast(ids.length+" opponent players imported. Review their slots.");return true
 }
 if(a==="opponentRemove"){const id=Number(el.dataset.id);state.opponentRoster=(state.opponentRoster||[]).filter(x=>Number(x)!==id);delete state.opponentPositions?.[id];persist();render();return true}
 return false;
}
function onChange(c,t){
 if(window.HoopIQWeeklyImport?.onChange(c,t))return true;
 const {state,imageReview:r,scanYahooPhotos,nbaPlayers,players,persist,render,toast}=c;
 if(t.dataset.reviewopponent){const id=Number(t.dataset.reviewopponent);if(t.checked)r.selected.add(id);else r.selected.delete(id);return true}
 if(t.id==="opponentImportMode"){r.replaceRoster=t.value==="replace";return true}
 if(t.id==="opponentFile"&&t.files?.length){scanYahooPhotos(t.files,"opponent");return true}
 if(t.id==="addopponent"&&t.value){
  const id=Number(t.value),p=nbaPlayers.find(x=>x.id===id)||players.find(x=>x.id===id);
  if(p){state.opponentRoster=[...new Set([...(state.opponentRoster||[]),id])].slice(0,30);state.opponentManual=true;state.opponentPositions={...(state.opponentPositions||{}),[id]:"BN"};state.cachePlayers={...(state.cachePlayers||{}),[id]:p};state.opponentQuery="";persist();render();toast(p.name+" added to opponent")}
  return true;
 }
 return false;
}
function onInput(c,t){
 if(t.id!=="opponentQuery")return false;
 const caret=t.selectionStart;c.state.opponentQuery=t.value;c.render();
 const field=c.$("opponentQuery");if(field){field.focus();field.setSelectionRange(caret,caret)}
 return true;
}
window.HoopIQMatchup={renderOpponent,renderMatchup,onClick,onChange,onInput};
})();