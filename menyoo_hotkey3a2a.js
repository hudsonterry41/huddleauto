/* Saved keyboard shortcut shared by the launcher and both game pages. */
(function(root){
 'use strict';
 const key='grandv.menyoo.hotkey.v1';
 function valid(code){return typeof code==='string'&&/^(?:F[1-4]|F[6-9]|F10|Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Insert|Home|End|PageUp|PageDown)$/.test(code);}
 function get(){try{const custom=root.localStorage.getItem(key);if(valid(custom))return custom;const old=JSON.parse(root.localStorage.getItem('menyoo.source.settings.v1')||'{}');if(['F4','F6','F8'].includes(old.hotkey))return old.hotkey;}catch(_){}return 'F4';}
 function label(code){return code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ');}
 function set(code){if(!valid(code))throw Error('Choose a single letter, number, function or punctuation key.');root.localStorage.setItem(key,code);return code;}
 function mount(doc){
  const button=doc.getElementById('menyoo-hotkey-change'),reset=doc.getElementById('menyoo-hotkey-reset'),status=doc.getElementById('menyoo-hotkey-status');
  if(!button||button.dataset.hotkeyMounted)return;button.dataset.hotkeyMounted='1';
  let listening=false;
  function render(){doc.querySelectorAll('[data-menyoo-hotkey]').forEach(el=>{el.textContent=label(get());});button.textContent=listening?'Press a key…':'Change key';}
  function stop(){listening=false;root.removeEventListener('keydown',capture,true);render();}
  function capture(e){
   e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
   if(e.code==='Escape'){stop();status.textContent='Key change cancelled.';return;}
   if(e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||!valid(e.code)){status.textContent='Choose one key without modifiers. Esc cancels. F5, F11 and F12 are reserved for the browser.';return;}
   try{set(e.code);stop();status.textContent='Saved. Use '+label(get())+' to open or close Menyoo.';}catch(error){stop();status.textContent='Could not save shortcut: '+error.message;}
  }
  button.addEventListener('click',()=>{if(listening){stop();return;}listening=true;status.textContent='Press the new key, or Esc to cancel. Choose a key unused by your game controls.';render();root.addEventListener('keydown',capture,true);});
  reset.addEventListener('click',()=>{stop();try{set('F4');render();status.textContent='Restored F4.';}catch(error){status.textContent='Could not save shortcut: '+error.message;}});
  root.addEventListener('blur',()=>{if(listening){stop();status.textContent='Key change cancelled.';}});
  render();
 }
 root.GTAMenyooHotkey={valid,get,set,label,mount};
 if(typeof module!=='undefined')module.exports=root.GTAMenyooHotkey;
 if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>mount(root.document),{once:true});else mount(root.document);}
})(typeof window!=='undefined'?window:globalThis);
