/* Preserve VSync and adjust the verified refresh pair after world readiness. */
(function(root){
  'use strict';
  const numerator=12622824,denominator=12622828,vsync=19447080;
  function apply(memory,hz,expected=60){
    if(![60,75,90,100,120].includes(hz)||![60,75,90,100,120].includes(expected))return {applied:false,reason:'unsupported refresh rate'};
    const buffer=memory.buffer;
    if(buffer.byteLength<vsync+4)return {applied:false,reason:'memory not ready'};
    const refresh=new Uint32Array(buffer,numerator,2),mode=new Int32Array(buffer,vsync,1);
    if(Atomics.load(refresh,1)!==1||Atomics.load(mode,0)!==1)return {applied:false,reason:'unexpected refresh denominator or VSync mode'};
    const previous=Atomics.compareExchange(refresh,0,expected,hz);
    if(previous!==expected)return {applied:false,reason:'unexpected refresh numerator',previous};
    if(Atomics.load(refresh,1)!==1||Atomics.load(mode,0)!==1){Atomics.compareExchange(refresh,0,hz,expected);return {applied:false,reason:'refresh mode changed during transition'};}
    return {applied:true,previous,hz,denominator:1,vsync:1};
  }
  function start(memory,isReady,log,hz=75){
    let polls=0;
    const timer=setInterval(()=>{
      if(++polls>1800){clearInterval(timer);log('[native refresh probe] world-ready timeout; no change');return;}
      if(!isReady())return;
      clearInterval(timer);
      try{log('[native refresh probe] '+JSON.stringify(apply(memory,hz)));}catch(error){log('[native refresh probe] '+String(error));}
    },100);
    return ()=>clearInterval(timer);
  }
  root.GTANativeRefreshProbe={apply,start};if(typeof module!=='undefined')module.exports=root.GTANativeRefreshProbe;
})(typeof self!=='undefined'?self:globalThis);
