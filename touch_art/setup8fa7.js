(()=>{
 'use strict';
 const $=id=>document.getElementById(id),viewport=GTAGameViewport,dialog=$('viewport-dialog');
 let controls,draft,editOrientation;
 new ResizeObserver(()=>document.documentElement.style.setProperty('--setup-bar-bottom',($('setup-bar').getBoundingClientRect().bottom+8)+'px')).observe($('setup-bar'));
 $('return').onclick=()=>{
  const target=new URL(new URLSearchParams(location.search).get('return')||'/launcher.html',location.origin);
  location.href=target.origin===location.origin&&target.pathname==='/launcher.html'?target.href:'/launcher.html';
 };
 const busy=()=>{document.body.classList.toggle('editing',!!document.querySelector('#pad.editing'));};
 new MutationObserver(busy).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 function paint(){
  const v=draft[editOrientation];
  for(const id of ['mode','scale','x','y'])$(id).value=v[id];
  for(const id of ['scale','x','y']){$(id+'-value').textContent=v[id]+'%';$(id).disabled=v.mode==='full'||id==='scale'&&v.mode!=='custom';}
  const bounds=$('screen-fit').getBoundingClientRect();
  const scale=Math.min(Math.max(0,bounds.width-4)/innerWidth,Math.max(0,bounds.height-4)/innerHeight);
  $('screen-preview').style.width=innerWidth*scale+'px';
  $('screen-preview').style.height=innerHeight*scale+'px';
  const r=viewport.rect(innerWidth,innerHeight,v);
  for(const key of ['left','top','width','height'])$('screen-viewport').style[key]=r[key]*scale+'px';
  $('orientation').textContent='Editing '+editOrientation+' · portrait and landscape are saved separately.';
 }
 $('viewport').onclick=()=>{draft=viewport.load();editOrientation=viewport.orientation();document.body.classList.add('viewport-editing');dialog.showModal();paint();};
 new ResizeObserver(()=>{if(dialog.open)paint();}).observe($('screen-fit'));
 for(const id of ['mode','scale','x','y'])$(id).oninput=()=>{draft[editOrientation][id]=id==='mode'?$(id).value:+$(id).value;paint();};
 $('cancel').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{document.body.classList.remove('viewport-editing');viewport.apply();});
 $('save').onclick=()=>{try{viewport.save(draft);dialog.close();$('status').textContent='Viewport saved';}catch(e){$('status').textContent='Could not save viewport: '+e.message;}};
 addEventListener('resize',()=>{if(dialog.open){editOrientation=viewport.orientation();paint();}});
 $('controls').disabled=$('layout').disabled=true;
 GTATouchControls.prepareLauncher().then(value=>{
  controls=value;$('controls').disabled=$('layout').disabled=false;
  $('controls').onclick=()=>controls.openPanel();$('layout').onclick=()=>controls.startEdit();
  $('status').textContent='Blank setup workspace · touch settings save automatically; layout saves with Done.';
  controls.openPanel();
 }).catch(e=>{$('status').textContent='Touch editor could not start: '+e.message;});
})();
