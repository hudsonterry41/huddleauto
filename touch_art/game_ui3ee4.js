/* Page controls share one touch-friendly toolbar and one FPS state. */
(function(root){
 'use strict';
 let toolbar,counter,channel,visible=false,lastFps=null;
 function button({id,label,title,onClick}){
  mount();
  const el=document.createElement('button');el.type='button';
  if(id)el.id=id;el.textContent=label;if(title)el.title=title;
  if(onClick)el.addEventListener('click',onClick);
  toolbar.append(el);return el;
 }
 function toggleFps(){
  mount();visible=!visible;counter.hidden=!visible;
  counter.textContent=lastFps===null?'-- FPS':lastFps+' FPS';
 }
 function mount(){
  if(toolbar)return toolbar;
  const style=document.createElement('style');style.textContent=`
   #game-page-actions {position:fixed;left:50%;right:auto;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);z-index:35;display:flex;flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;width:max-content;max-width:calc(100vw - 200px);pointer-events:none;}
   #game-page-actions button {box-sizing:border-box;min-height:40px;padding:7px 12px;border:2px solid rgba(255,255,255,.5);border-radius:20px;background:rgba(20,20,20,.7);color:#fff;font:600 12px/1.2 system-ui,sans-serif;touch-action:manipulation;pointer-events:auto;cursor:pointer;}
   #game-page-actions button:active {background:rgba(255,255,255,.2);}
   #game-page-actions button:focus-visible {outline:2px solid var(--accent,#88b85b);outline-offset:2px;}
   #game-page-actions #touch-toolbar {display:contents;}
   #game-page-actions #fps {position:static;display:block;padding:6px 10px;border-radius:16px;background:#000b;color:#fff;font:600 14px/1.2 monospace;pointer-events:none;}
   #game-page-actions [hidden] {display:none!important;}
   @media(max-width:360px){#game-page-actions {max-width:calc(100vw - 140px);}#game-page-actions button {padding:6px 8px;font-size:11px;}}
  `;document.head.append(style);
  toolbar=document.createElement('div');toolbar.id='game-page-actions';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Game page controls');
  toolbar.addEventListener('pointerdown',e=>e.stopPropagation());toolbar.addEventListener('click',e=>e.stopPropagation());document.body.append(toolbar);
  counter=document.createElement('output');counter.id='fps';counter.hidden=true;counter.textContent='-- FPS';counter.setAttribute('aria-label','Presented frames per second');
  toolbar.append(counter);
  channel=new BroadcastChannel('game-fps');channel.onmessage=e=>{const value=Number(e.data?.fps);if(Number.isFinite(value)&&value>=0){lastFps=Math.round(value);if(visible)counter.textContent=lastFps+' FPS';}};
  root.addEventListener('tc-action',e=>{if(e.detail==='fps')toggleFps();});
  const isToggle=e=>e.code==='Equal'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  root.addEventListener('keydown',e=>{if(!isToggle(e))return;e.stopImmediatePropagation();e.preventDefault();if(!e.repeat)toggleFps();},{capture:true});
  root.addEventListener('keyup',e=>{if(isToggle(e)){e.stopImmediatePropagation();e.preventDefault();}},{capture:true});
  root.addEventListener('pagehide',()=>channel.close(),{once:true});
  if(new URLSearchParams(location.search).get('colordiag')==='1'){
   const requests=new BroadcastChannel('game-colour-capture'),results=new BroadcastChannel('game-progress');
   let seq=0,pending=null,timer;
   const capture=button({id:'capture-colours',label:'Capture colours',title:'Capture the next composite draw for colour diagnosis',onClick:()=>{
    pending='colour-'+Date.now()+'-'+(++seq);capture.disabled=true;capture.textContent='Capturing colours…';requests.postMessage({request:true,id:pending});
    timer=setTimeout(()=>{pending=null;capture.disabled=false;capture.textContent='Capture colours (retry)';},12000);
   }});
   results.onmessage=e=>{const d=e.data?.colourDiagnostic;if(!pending||d?.id!==pending)return;if(['complete','error','timeout'].includes(d.state)){clearTimeout(timer);pending=null;capture.disabled=false;capture.textContent=d.state==='complete'?'Colours captured':'Capture colours (retry)';}};
   root.addEventListener('pagehide',()=>{clearTimeout(timer);requests.close();results.close();},{once:true});
  }
  return toolbar;
 }
 root.GTAGameUI={mount,button,toggleFps};
})(typeof self!=='undefined'?self:globalThis);
