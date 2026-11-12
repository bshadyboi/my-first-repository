/* Yahoo weekly matchup image importer. Local data only; no Yahoo API writes. */
(function(root,factory){
 const x=factory(root);if(typeof module!=="undefined"&&module.exports)module.exports=x;
 if(root)root.HoopIQWeeklyImport=x;
})(typeof window!=="undefined"?window:null,function(root){
 "use strict";
 const slots=["PG:1","SG:1","G:1","SF:1","PF:1","F:1","C:1","C:2","UTIL:1","UTIL:2"];
 const allSlots=["UNASSIGNED",...slots,"BN","IL"];
 const layout=()=>root?.HoopIQMatchupLayout;
 let nextId=0;
 const s={open:false,busy:false,error:"",progress:"",files:[],home:[],away:[],base:{home:[],away:[]},ignored:{home:[],away:[]},
  sideOverride:"auto",identity:null,detectedNames:{home:"",away:""},userEditedNames:{home:false,away:false},
  autoTotals:{homeProjection:"",awayProjection:"",homeGames:"",awayGames:"",weekNumber:""},editedTotals:{},
  manualSlots:{home:{},away:{}},weekEdited:false,autoWeek:"",week:"",weekNumber:"",
  homeName:"",awayName:"",homeProjection:"",awayProjection:"",homeGames:"",awayGames:""};
 const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const validWeek=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||""))&&new Date(x+"T12:00:00Z").getUTCDay()===1;
 const normalize=x=>String(x||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").trim();
 function clear(){
  for(const x of s.files)if(x.preview&&typeof URL!=="undefined")URL.revokeObjectURL(x.preview);
  Object.assign(s,{open:false,busy:false,error:"",progress:"",files:[],home:[],away:[],base:{home:[],away:[]},
    sideOverride:"auto",identity:null,detectedNames:{home:"",away:""},userEditedNames:{home:false,away:false},
    autoTotals:{homeProjection:"",awayProjection:"",homeGames:"",awayGames:"",weekNumber:""},editedTotals:{},
    manualSlots:{home:{},away:{}},weekEdited:false,autoWeek:"",
    ignored:{home:[],away:[]},week:"",weekNumber:"",homeName:"",awayName:"",
    homeProjection:"",awayProjection:"",homeGames:"",awayGames:""});
 }
 const extractTotals=t=>{
  const p=[...String(t||"").replace(/,/g,"").matchAll(/\b(\d{3,4}\.\d\d)\b/g)].map(x=>Number(x[1])).find(x=>x>=300&&x<=3500);
  const g=String(t||"").match(/\b(\d{1,2})\s*\/\s*(\d{2,3})\b/);
  const w=String(t||"").match(/\bweek\s*(\d{1,2})\b/i);
  return {points:p==null?"":p.toFixed(2),games:g?g[1]+"/"+g[2]:"",week:w?w[1]:""};
 };
 function pool(c){return [...c.nbaPlayers,...c.players,...Object.values(c.state.cachePlayers||{})]}
 function detectionContext(c){
  const homeIds=(c.state.manualRoster?(c.state.roster||[]):[]),awayIds=(c.state.opponentManual?(c.state.opponentRoster||[]):[]);
  const saved=(c.state.matchupSnapshots||{})[s.week||c.state.weekStart];
  return {
   homeIds:[...new Set([...homeIds,...(saved?.homePlayers||[]).map(p=>p.id)])],
   awayIds:[...new Set([...awayIds,...(saved?.awayPlayers||[]).map(p=>p.id)])],
   homeName:s.userEditedNames.home?s.homeName:(saved?.homeName||c.state.name||""),
   awayName:s.userEditedNames.away?s.awayName:(saved?.awayName||c.state.opponent||"")
  };
 }
 function identifyScreenshots(c){
  const o=root?.HoopIQMatchupTeams;
  const matcher=root?.HoopIQRosterOCR?.getMatches;
  if(!o||!matcher)return {files:[],unresolved:0,conflicts:[],homeName:"",awayName:""};
  const sources=s.files.map(f=>({
    ...f,
    leftText:f.leftText??f.homeText??"",
    rightText:f.rightText??f.awayText??"",
    manualSide:f.manualSide||(s.sideOverride!=="auto"?s.sideOverride:"")
  }));
  const found=o.identify(sources,matcher,pool(c),detectionContext(c));
  const weeks=[...new Set(s.files.filter(f=>f.status==="done")
    .map(f=>extractTotals((f.leftText||"")+"\n"+(f.rightText||"")).week).filter(Boolean))];
  if(weeks.length>1)found.conflicts.push("Different Yahoo week numbers were found ("+weeks.join(", ")+"). Remove a screenshot from another week.");
  // OCR header names should only prefill untouched fields; manual corrections always win.
  for(const side of ["home","away"]){
   const proposed=String(found[side+"Name"]||"").trim(),was=s.detectedNames[side];
   const generic=side==="home"?c.state.name:c.state.opponent;
   if(proposed&&!s.userEditedNames[side]&&(!s[side+"Name"]||s[side+"Name"]===was||s[side+"Name"]===generic))
    s[side+"Name"]=proposed;
   if(proposed)s.detectedNames[side]=proposed;
  }
  return found;
 }
 function parse(c){
  const matcher=root?.HoopIQRosterOCR?.getMatches;
  if(typeof matcher!=="function")return;
  s.identity=identifyScreenshots(c);
  const sourceMap=new Map(s.identity.files.map(f=>[f.id,f]));
  const totals={homeProjection:"",awayProjection:"",homeGames:"",awayGames:"",weekNumber:""};
  const ordered=s.files.filter(x=>x.status==="done").slice().sort((a,b)=>{
   const header=f=>Number(Boolean((f.leftText+" "+f.rightText+" "+f.headerText).match(/week\s*\d|games played|matchup totals/i)));
   return header(b)-header(a);
  });
  for(const side of ["home","away"]){
   const found=new Map((s.base?.[side]||[]).filter(p=>!s.ignored[side].includes(p.id)).map(p=>[p.id,{...p,sourceCount:1}]));
   const observations=[];
   for(const f of ordered){
    const orientation=sourceMap.get(f.id)?.orientation||"unknown";
    if(orientation==="unknown")continue;
    const rawSide=(side==="home"?(orientation==="left"?"left":"right"):(orientation==="left"?"right":"left"));
    const raw=String(f[rawSide+"Text"]??f[(rawSide==="left"?"home":"away")+"Text"]??"");
    const recognized=matcher(root?.HoopIQMatchupTeams?.stripHeader(raw)||raw,pool(c)).matches||[];
    const keep=[];
    for(const p of recognized){
     if(s.ignored[side].includes(p.id))continue;
     const existing=found.get(p.id);
     if(existing){existing.sourceCount=(existing.sourceCount||1)+1;keep.push(existing);continue}
     const player={id:Number(p.id),name:p.name,team:p.team,slot:"UNASSIGNED",
      confidence:p.confidence||0,sourceCount:1,slotEvidence:""};
     found.set(p.id,player);keep.push(player);
    }
    const positioned=layout()?.labeled(keep,f[rawSide+"Lines"]||[],f.centerLines||[])||[];
    observations.push({id:f.id,rows:positioned});
    const summary=extractTotals(raw);
    const header=f.headerScore?.[rawSide]||{};
    const projection=header.projection||summary.points,games=header.games||summary.games;
    if(!totals[side+"Projection"]&&projection)totals[side+"Projection"]=projection;
    if(!totals[side+"Games"]&&games)totals[side+"Games"]=games;
    if(!totals.weekNumber)totals.weekNumber=f.headerScore?.week||summary.week;
   }
   const positions=layout()?.resolve(observations,s.manualSlots[side]||{})||{order:[],positions:{}};
   for(const player of found.values()){
    const recognized=positions.positions[player.id];
    if(recognized){
     player.slot=recognized.slot;
     player.slotEvidence=recognized.source;
     player.slotConfidence=recognized.confidence;
    }else{
     player.slot="UNASSIGNED";player.slotEvidence="";player.slotConfidence="";
    }
   }
   const ranking=new Map(positions.order.map((id,i)=>[id,i]));
   s[side]=[...found.values()].sort((a,b)=>(ranking.get(a.id)??999)-(ranking.get(b.id)??999));
  }
  for(const key of Object.keys(totals)){
   const lastAuto=s.autoTotals[key]||"";
   const isAuto=!s[key]||s[key]===lastAuto;
   if(!s.editedTotals[key]&&isAuto){
    if(totals[key])s[key]=totals[key];
    else if(lastAuto&&s[key]===lastAuto)s[key]="";
   }
   s.autoTotals[key]=totals[key];
  }
  // The Week number is read from Yahoo; its date is only a proposed calendar
  // mapping and remains editable. Never silently keep an outdated week.
  const proposed=layout()?.yahooWeekDate(s.weekNumber,new Date())||"";
  if(proposed&&!s.weekEdited&&(!s.week||s.week===s.autoWeek||s.week===c.state.weekStart)){
   s.week=proposed;s.autoWeek=proposed;
  }
 } function selectSlots(value){
  return allSlots.map(key=>'<option value="'+key+'" '+(key===value?"selected":"")+'>'+
   (key==="UNASSIGNED"?"Needs review":key==="BN"?"Bench":key==="IL"?"Injured List":key.replace(/:1$/,"").replace(/:2$/," (2)"))+'</option>').join("");
 }
 function row(p,side){
  return '<div class="weekly-import-person"><div><b>'+esc(p.name)+'</b><small>'+esc(p.team)+'</small></div>'+
   '<select class="select" data-weekly-slot="'+side+":"+p.id+'" aria-label="Lineup slot for '+esc(p.name)+'">'+selectSlots(p.slot)+'</select>'+
   '<button class="btn ghost xs" data-action="weeklyRemove" data-side="'+side+'" data-id="'+p.id+'">×</button></div>';
 }
 function stored(c){return (c.state.matchupSnapshots||{})[c.state.weekStart]||null}
 function renderSaved(c){
  const x=stored(c);if(!x)return "";
  const fmt=v=>v==null?"—":Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const side=(team,rows)=>'<div class="weekly-saved-side"><h3>'+esc(team)+'</h3>'+
   (rows||[]).map(p=>'<div><span>'+esc(p.slot==="UNASSIGNED"?"?":p.slot.replace(/:\d+$/,""))+'</span><b>'+esc(p.name)+'</b></div>').join("")+'</div>';
  return c.card("📸 Saved Yahoo matchup · "+esc(x.weekStart),
   '<div class="weekly-versus"><div><small>'+esc(x.homeName)+'</small><strong>'+fmt(x.homeProjection)+'</strong><span>Yahoo projected FP</span><span>'+esc(x.homeGames||"—")+' games</span></div>'+
   '<span class="weekly-vs">VS</span><div><small>'+esc(x.awayName)+'</small><strong>'+fmt(x.awayProjection)+'</strong><span>Yahoo projected FP</span><span>'+esc(x.awayGames||"—")+' games</span></div></div>'+
   (x.incomplete?'<p class="note warn">Partial matchup: some players or positions are not captured. Add screenshots to complete it.</p>':"")+
   '<div class="weekly-saved-grid">'+side(x.homeName,x.homePlayers)+side(x.awayName,x.awayPlayers)+'</div>'+
   '<p class="strategy-note">This snapshot comes from Yahoo screenshots, not live sync. Yahoo projections may change and are not points already scored.</p>'+
   '<div class="buttonrow">'+c.button("weeklyEdit","Edit snapshot","ghost xs")+c.button("weeklyDelete","Delete snapshot","ghost xs")+'</div>');
 }
 function render(c){
  const weeks=Object.keys(c.state.matchupSnapshots||{}).filter(validWeek).sort().reverse();
  let html=renderSaved(c);
  html+='<div class="weekly-import"><div class="row between" style="align-items:flex-start;flex-wrap:wrap;gap:8px"><div><h2>📸 Import Yahoo matchup</h2>'+
   '<p class="small muted">Upload up to six matchup screenshots, including scrolled-down starters, Bench and IL. Save this week separately from My Team.</p></div>'+
   c.button("weeklyToggle",s.open?"Hide importer":"Import screenshots","primary")+'</div>';
  if(weeks.length)html+='<div class="weekly-saved-picker"><label>Saved matchup weeks</label><select class="select" id="weeklySavedWeek"><option value="">Choose a saved week…</option>'+
   weeks.map(w=>'<option value="'+w+'">'+w+'</option>').join("")+'</select></div>';
  if(s.open){
   const recognition=s.identity||{files:[],unresolved:0,conflicts:[],homeName:"",awayName:""};
   const orientations=new Map(recognition.files.map(item=>[item.id,item]));
   html+='<section class="weekly-team-recognition"><div><h3>Who is on each side?</h3>'+
     '<p class="small muted">HoopIQ compares the players with your saved team, checks the Yahoo team headings, and joins overlapping screenshots into one matchup.</p></div>'+
     '<label class="weekly-side-choice">My team appears on<select class="select" id="weeklySideOverride">'+
       '<option value="auto" '+(s.sideOverride==="auto"?"selected":"")+'>Auto-detect each screenshot</option>'+
       '<option value="left" '+(s.sideOverride==="left"?"selected":"")+'>Left side of every screenshot</option>'+
       '<option value="right" '+(s.sideOverride==="right"?"selected":"")+'>Right side of every screenshot</option>'+
     '</select></label>'+
     (s.files.length?'<p class="small muted">Matched '+s.home.length+' unique players for your team and '+s.away.length+' for your opponent. Repeated names from overlapping images are counted once.</p>':"")+
     (recognition.homeName||recognition.awayName?'<p class="weekly-found-names"><b>Yahoo headers:</b> '+esc(recognition.homeName||"Your name not yet detected")+' <b>vs</b> '+esc(recognition.awayName||"Opponent name not yet detected")+'</p>':"")+
     (recognition.unresolved?'<div class="note warn">Could not confidently identify the teams in '+recognition.unresolved+' screenshot(s). Choose the correct left/right orientation below before saving.</div>':"")+
     (recognition.conflicts.length?recognition.conflicts.map(issue=>'<div class="note warn">'+esc(issue)+'</div>').join(""):"")+
     '</section>';
   html+='<input id="weeklyFiles" type="file" accept="image/*" multiple style="display:none">'+
    '<div class="buttonrow">'+c.button("weeklyUpload","＋ Add screenshots","primary",s.busy?"disabled":"")+
    c.button("weeklyClear","Clear unsaved scan","ghost xs",s.busy?"disabled":"")+'</div>';
   if(s.files.length)html+='<div class="weekly-thumbnails">'+s.files.map((f,i)=>{
     const d=orientations.get(f.id),side=d?.orientation||"unknown";
     const label=side==="left"?"My team LEFT · Opponent RIGHT":side==="right"?"My team RIGHT · Opponent LEFT":"Needs team confirmation";
     return '<div class="weekly-thumb"><img src="'+esc(f.preview)+'" alt="Yahoo screenshot '+(i+1)+'" loading="lazy">'+
      '<div class="weekly-thumb-info"><b>'+esc(f.name)+'</b><small>'+esc(f.status)+'</small>'+
      '<span class="weekly-thumb-side '+(side==="unknown"?"down":"up")+'">'+esc(label)+'</span>'+
      (d?'<small>'+esc(d.source)+'</small>':"")+
      '<label class="weekly-thumb-override">Override for this image<select class="select" data-weekly-image-side="'+esc(f.id)+'" '+(s.busy?"disabled":"")+'>'+
       '<option value="auto" '+(!f.manualSide?"selected":"")+'>Auto</option>'+
       '<option value="left" '+(f.manualSide==="left"?"selected":"")+'>My team on left</option>'+
       '<option value="right" '+(f.manualSide==="right"?"selected":"")+'>My team on right</option>'+
      '</select></label></div>'+
      c.button("weeklyRemoveFile","×","ghost xs",'data-file="'+esc(f.id)+'"')+'</div>';
    }).join("")+'</div>';
   if(s.busy)html+='<div class="note blue" id="weeklyOCRProgress" role="status">'+esc(s.progress||"Reading screenshots…")+'</div>';
   if(s.error)html+='<div class="note warn" role="alert">'+esc(s.error)+'</div>';
   const inputs=[["week","Week begins Monday","date"],["weekNumber","Yahoo week number (optional)","number"],
    ["homeName","My Yahoo team","text"],["awayName","Opponent team","text"],
    ["homeProjection","My Yahoo projected FP","number"],["awayProjection","Opponent projected FP","number"],
    ["homeGames","My games (played/total)","text"],["awayGames","Opponent games (played/total)","text"]];
   html+='<div class="weekly-fields">'+inputs.map(([key,label,type])=>
    '<label>'+label+'<input id="weekly-'+key+'" class="textinput" type="'+type+'" '+
    (type==="number"?'step="0.01" min="0" ':"")+'value="'+esc(s[key]||(key==="week"?c.state.weekStart:""))+
    '" placeholder="'+(key.endsWith("Games")?"0/43":"")+'"></label>').join("")+'</div>';
   html+='<div class="weekly-review">'+["home","away"].map(side=>'<div><h3>'+ (side==="home"?"Your team":"Opponent")+' · '+s[side].length+' players</h3>'+
    (s[side].length?s[side].map(p=>row(p,side)).join(""):'<p class="muted small">No player names detected yet. Upload another screenshot or correct OCR text below.</p>')+'</div>').join("")+'</div>';
   html+='<p class="small muted">Review positions carefully. Screenshots taken mid-scroll may not show every slot; unrecognized spots stay marked “Needs review” rather than being guessed.</p>';
   html+='<details class="weekly-ocr-edit"><summary>Correct OCR text / missed names</summary>'+s.files.filter(f=>f.status==="done").map(f=>
    '<div class="weekly-ocr-file"><b>'+esc(f.name)+'</b>'+["home","away"].map(side=>
    '<label>'+(side==="home"?"Screenshot LEFT column":"Screenshot RIGHT column")+'<textarea data-weekly-raw="'+esc(f.id)+":"+side+'">'+esc(f[(side==="home"?"left":"right")+"Text"]||f[side+"Text"]||"")+'</textarea></label>').join("")+
    c.button("weeklyRecheck","Find names again","ghost xs",'data-file="'+esc(f.id)+'"')+'</div>').join("")+'</details>';
   html+='<div class="buttonrow">'+c.button("weeklySave","✓ Save reviewed weekly matchup","primary",s.busy?"disabled":"")+'</div>';
  }
  return html+'</div>';
 }
 function capture(c){
  for(const key of ["week","weekNumber","homeName","awayName","homeProjection","awayProjection","homeGames","awayGames"]){
   const node=c.$("weekly-"+key);if(node)s[key]=String(node.value||"").trim();
  }
 }
 function checkedGames(t){
  if(!t)return "";
  const m=String(t).match(/^(\d{1,2})\s*\/\s*(\d{1,3})$/);
  if(!m||Number(m[1])>Number(m[2])||Number(m[2])>100)return null;
  return Number(m[1])+"/"+Number(m[2]);
 }
 function save(c){
  if(s.busy)return;
  capture(c);
  const week=s.week||c.state.weekStart;
  if(!validWeek(week)){s.error="Choose the Monday of the matchup week.";c.render();return}
  if(s.files.some(f=>f.status==="done")){
   s.identity=identifyScreenshots(c);
   if(s.identity.unresolved){s.error="One or more screenshots could not be assigned to your team or your opponent. Choose the side for each image before saving.";c.render();return}
   if(s.identity.conflicts.length){s.error="The screenshots contain conflicting team names or week numbers. Remove or correct the mismatched image before saving.";c.render();return}
  }
  if(!s.home.length||!s.away.length){s.error="Scan or enter at least one verified player per team.";c.render();return}
  for(const side of ["home","away"]){
   const keys=s[side].map(p=>p.slot).filter(p=>p.includes(":"));
   if(keys.length!==new Set(keys).size){s.error="Two "+(side==="home"?"your":"opponent")+" players have the same starter slot. Correct it before saving.";c.render();return}
  }
  const gamesA=checkedGames(s.homeGames),gamesB=checkedGames(s.awayGames);
  if(gamesA===null||gamesB===null){s.error="Games must use played/total format, for example 0/43.";c.render();return}
  const homeName=(s.homeName||"My Team").slice(0,60),awayName=(s.awayName||"Opponent").slice(0,60);
  if(normalize(homeName)===normalize(awayName)){s.error="Set different team names.";c.render();return}
  const points=k=>{
   if(s[k]==="")return null;
   const v=Number(s[k]);return Number.isFinite(v)&&v>=0&&v<=9999?v:null;
  };
  const homeProj=points("homeProjection"),awayProj=points("awayProjection");
  if((s.homeProjection!==""&&homeProj==null)||(s.awayProjection!==""&&awayProj==null)){s.error="Projected points need a valid number.";c.render();return}
  if(c.state.matchupSnapshots?.[week]&&!confirm("Replace the saved snapshot for "+week+"? Your active rosters will remain unchanged."))return;
  const rows=side=>s[side].map(p=>({id:p.id,name:p.name,team:p.team,slot:p.slot}));
  const snapshot={weekStart:week,weekNumber:s.weekNumber,homeName,awayName,homePlayers:rows("home"),awayPlayers:rows("away"),
   homeProjection:homeProj,awayProjection:awayProj,homeGames:gamesA,awayGames:gamesB,
   incomplete:s.home.length<13||s.away.length<13||s.home.concat(s.away).some(p=>p.slot==="UNASSIGNED"),
   source:"yahoo-screenshot",savedAt:new Date().toISOString()};
  c.state.matchupSnapshots={...(c.state.matchupSnapshots||{}),[week]:snapshot};
  c.state.weekStart=week;c.persist();clear();c.render();c.toast("Yahoo matchup saved for "+week);
  if(c.weekInfo?.start!==week&&c.loadWeek)c.loadWeek();
 }
 async function crop(file,side,contrast){
  if(typeof createImageBitmap!=="function")return file;
  const bmp=await createImageBitmap(file);
  try{
   const x=side==="left"?0:Math.floor(bmp.width*.50),w=side==="left"?Math.ceil(bmp.width*.51):bmp.width-x;
   const y=Math.floor(bmp.height*.11),h=Math.floor(bmp.height*.83);
   const scale=Math.min(2.3,1250/w,3200/h);
   const canvas=document.createElement("canvas");canvas.width=Math.floor(w*scale);canvas.height=Math.floor(h*scale);
   const ctx=canvas.getContext("2d",{willReadFrequently:true});
   ctx.drawImage(bmp,x,y,w,h,0,0,canvas.width,canvas.height);
   if(contrast){
    const image=ctx.getImageData(0,0,canvas.width,canvas.height),v=image.data;
    for(let i=0;i<v.length;i+=4){const lum=v[i]*.299+v[i+1]*.587+v[i+2]*.114;const ink=lum>123?20:255;v[i]=v[i+1]=v[i+2]=ink}
    ctx.putImageData(image,0,0);
   }
   return canvas;
  }finally{bmp.close?.()}
 }
 async function scan(c,list){
  if(s.busy)return;
  const inputs=Array.from(list||[]);
  const files=inputs.slice(0,Math.max(0,6-s.files.length)).filter(f=>f.type?.startsWith("image/")&&f.size<=15*1024*1024);
  if(!files.length){s.open=true;s.error="Choose up to six screenshots, 15 MB or smaller each.";c.render();return}
  const added=files.map(f=>({id:"snap-"+(++nextId),name:f.name||"Screenshot",preview:URL.createObjectURL(f),file:f,leftText:"",rightText:"",manualSide:"",status:"queued"}));
  s.files.push(...added);s.open=true;s.busy=true;s.error="";c.render();
  let worker;
  try{
   if(!root.Tesseract)await new Promise((resolve,reject)=>{
    const el=document.createElement("script");el.async=true;el.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    el.onload=resolve;el.onerror=()=>reject(Error("OCR library unavailable"));document.head.appendChild(el);
   });
   if(c.nbaPlayers.length<200&&c.updateNBA)await c.updateNBA();
   worker=await root.Tesseract.createWorker("eng",1,{logger:m=>{
    const el=c.$("weeklyOCRProgress");if(el&&m.progress!=null)el.textContent=s.progress+" · "+Math.round(m.progress*100)+"%";
   }});
   await worker.setParameters({tessedit_pageseg_mode:"11"});
   for(let i=0;i<added.length;i++){
    const f=added[i];f.status="scanning";
    for(const side of ["left","right"]){
     s.progress="Screenshot "+(i+1)+"/"+added.length+" · reading "+side+" column";c.render();
     const p=await worker.recognize(await crop(f.file,side,true));
     let text=String(p.data?.text||"");
     if((root.HoopIQRosterOCR?.getMatches(text,pool(c))?.matches?.length||0)<2){
      const retry=await worker.recognize(await crop(f.file,side,false));
      text+="\n"+String(retry.data?.text||"");
     }
     f[side+"Text"]=text.slice(0,20000);
    }
    if(c.loadRosterForOCR)await c.loadRosterForOCR(f.leftText+"\n"+f.rightText);
    f.status="done";f.file=null;parse(c);c.render();
   }
  }catch(e){
   s.error="Unable to finish scanning: "+String(e.message||e)+". Correct OCR text or try clearer screenshots.";
   for(const f of added)if(f.status!=="done")f.status="error";
  }finally{
   if(worker)try{await worker.terminate()}catch(e){}
   s.busy=false;s.progress="";parse(c);c.render();
  }
 }
 function onClick(c,action,el){
  if(action==="weeklyToggle"){s.open=!s.open;c.render();return true}
  if(action==="weeklyUpload"){c.$("weeklyFiles")?.click();return true}
  if(action==="weeklyClear"){if(!s.busy){clear();s.open=true;c.render()}return true}
  if(action==="weeklySave"){save(c);return true}
  if(action==="weeklyRemoveFile"){
   if(!s.busy){capture(c);const idx=s.files.findIndex(f=>f.id===el.dataset.file);
    if(idx>=0){const [f]=s.files.splice(idx,1);if(f.preview)URL.revokeObjectURL(f.preview);parse(c);c.render()}}
   return true;
  }
  if(action==="weeklyRecheck"){
   capture(c);const file=s.files.find(f=>f.id===el.dataset.file);
   if(file){
    for(const side of ["home","away"]){
     const element=document.querySelector('[data-weekly-raw="'+file.id+':'+side+'"]');
     if(element)file[(side==="home"?"left":"right")+"Text"]=element.value.slice(0,20000);
    }
    parse(c);c.render();c.toast("Detected names updated");
   }
   return true;
  }
  if(action==="weeklyRemove"){
   const side=el.dataset.side,id=Number(el.dataset.id);
   if(["home","away"].includes(side)){capture(c);s.ignored[side].push(id);s[side]=s[side].filter(p=>p.id!==id);c.render()}
   return true;
  }
  if(action==="weeklyDelete"){
   const week=c.state.weekStart;if(stored(c)&&confirm("Delete saved Yahoo matchup for "+week+"? Current rosters are unaffected.")){
    const next={...(c.state.matchupSnapshots||{})};delete next[week];c.state.matchupSnapshots=next;c.persist();c.render();
   }return true;
  }
  if(action==="weeklyEdit"){
   const saved=stored(c);if(saved){
    clear();s.open=true;s.week=saved.weekStart;s.weekNumber=saved.weekNumber||"";
    s.homeName=saved.homeName;s.awayName=saved.awayName;
    s.homeProjection=saved.homeProjection==null?"":String(saved.homeProjection);
    s.awayProjection=saved.awayProjection==null?"":String(saved.awayProjection);
    s.homeGames=saved.homeGames||"";s.awayGames=saved.awayGames||"";
    s.editedTotals={homeProjection:true,awayProjection:true,homeGames:true,awayGames:true,weekNumber:true};
    s.userEditedNames={home:true,away:true};
    s.home=saved.homePlayers.map(p=>({...p,confidence:100}));
    s.away=saved.awayPlayers.map(p=>({...p,confidence:100}));
    s.base={home:s.home.map(p=>({...p})),away:s.away.map(p=>({...p}))};c.render();
   }return true;
  }
  return false;
 }
 function onChange(c,t){
  if(t.id==="weeklyFiles"&&t.files?.length){capture(c);scan(c,t.files);return true}
  if(t.id==="weeklySideOverride"){
   capture(c);s.sideOverride=t.value==="left"||t.value==="right"?t.value:"auto";
   s.error="";parse(c);c.render();return true;
  }
  if(t.dataset?.weeklyImageSide){
   capture(c);
   const f=s.files.find(x=>x.id===t.dataset.weeklyImageSide);
   if(f){f.manualSide=t.value==="left"||t.value==="right"?t.value:"";s.error="";parse(c);c.render()}
   return true;
  }
  if(t.id==="weekly-homeName"||t.id==="weekly-awayName"){
   const side=t.id==="weekly-homeName"?"home":"away";
   s[side+"Name"]=String(t.value||"").trim();
   s.userEditedNames[side]=true;
   return true;
  }
  if(["weekly-homeProjection","weekly-awayProjection","weekly-homeGames","weekly-awayGames","weekly-weekNumber"].includes(t.id)){
   const key=t.id.slice("weekly-".length);
   s[key]=String(t.value||"").trim();
   s.editedTotals[key]=true;
   return true;
  }
  if(t.id==="weeklySavedWeek"&&validWeek(t.value)){
   c.state.weekStart=t.value;c.persist();c.render();if(c.loadWeek)c.loadWeek();return true;
  }
  if(t.dataset?.weeklySlot){
   const [side,id]=t.dataset.weeklySlot.split(":");
   const row=s[side]?.find(x=>x.id===Number(id));if(row){row.slot=t.value;s.manualSlots[side][Number(id)]=t.value;}return true;
  }
  return false;
 }
 return {render,onClick,onChange,parse,save,extractTotals,validWeek,session:s,clear};
});