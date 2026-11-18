/* Read-only voice-pressure snapshots for the verified 8b0b5899ed runtime layout. */
(function(root){'use strict';
 const layout=Object.freeze({limit:12124988,budget:12124976,target:12124968,reserve:12124992,list:12140944,cpuLimited:12141973,end:12141974}),running=new WeakMap();
 function snapshot(memory){
  const buffer=memory?.buffer;if(!buffer||buffer.byteLength<layout.end)return{status:'unavailable'};
  const v=new DataView(buffer),limit=v.getInt32(layout.limit,true),budget=v.getInt32(layout.budget,true),target=v.getInt32(layout.target,true),reserve=v.getInt32(layout.reserve,true);
  if(limit===0)return{status:'initializing'};
  if(limit<1||limit>128||target<0||target>limit||reserve<0||reserve>limit||budget<0||budget>20000)return{status:'layout-mismatch'};
  let physicalActive=0;for(let i=0;i<limit;i++)if(v.getBigUint64(layout.list+i*8,true)!==0n)physicalActive++;
  return{status:'ready',physicalActive,physicalLimit:limit,physicalTarget:target,newVoiceReserve:reserve,mixingBudget:budget,cpuLimited:!!v.getUint8(layout.cpuLimited),atPhysicalLimit:physicalActive>=limit,atPhysicalTarget:target>0&&physicalActive>=target,approximate:true};
 }
 function start(memory,report){
  if(running.has(memory))return running.get(memory);let timer,stopped=false;
  const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);running.delete(memory);};
  const sample=()=>{try{const data=snapshot(memory);report(data);if(data.status==='layout-mismatch'||data.status==='unavailable')stop();}catch(error){report({status:'snapshot-error',error:String(error).slice(0,160)});stop();}};
  timer=setInterval(sample,5000);running.set(memory,stop);root.addEventListener?.('pagehide',stop,{once:true});sample();return stop;
 }
 root.GTAAudioPressure={snapshot,start,layout};if(typeof module!=='undefined')module.exports=root.GTAAudioPressure;
})(typeof self!=='undefined'?self:globalThis);
