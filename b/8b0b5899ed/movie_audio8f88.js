(function(root){'use strict';
// Geometry comes from the native audio listener's panning transform, not a
// guessed player/camera location. Volume is native TV dB times engine SFX gain.
function sample(d,c,fake){
 const db=d.getFloat32(fake+48,true),sfx=d.getFloat32(6748144,true),frontend=!!d.getUint8(c+104);
 if(!Number.isFinite(db)||!Number.isFinite(sfx))return null;
 const gain=Math.max(0,Math.min(1,sfx))*Math.pow(10,Math.max(-100,Math.min(0,db))/20);
 if(frontend)return {frontend,gain,position:[0,0,0],distance:0};
 if(d.getUint32(fake+80,true)!==1)return null;
 const position=[d.getFloat32(fake+64,true),d.getFloat32(fake+68,true),d.getFloat32(fake+72,true)];
 if(position.some(v=>!Number.isFinite(v)||Math.abs(v)>100000))return null;
 const distance=Math.hypot(...position);
 // Avoid distant TV leakage. Near-field loudness is handled by inverse falloff.
 const fade=Math.max(0,Math.min(1,(40-distance)/15));
 return {frontend,gain:gain*fade,position,distance};
}
function create(context,video){
 const source=context.createMediaElementSource(video),gain=context.createGain(),panner=context.createPanner(),analyser=context.createAnalyser();let mode=null,lastState=null,lastPlaying=false;
 gain.gain.value=0;panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=1;panner.maxDistance=40;panner.rolloffFactor=1;
 analyser.fftSize=1024;const pcm=new Float32Array(1024);gain.connect(analyser);analyser.connect(context.destination);
 function route(frontend){if(mode===frontend)return;source.disconnect();panner.disconnect();if(frontend)source.connect(gain);else{source.connect(panner);panner.connect(gain)}mode=frontend;}
 return {update(state,playing){lastState=state;lastPlaying=playing;route(!!state?.frontend);const t=context.currentTime;gain.gain.setTargetAtTime(playing&&state?state.gain:0,t,0.03);if(state&&!state.frontend){const [x,y,z]=state.position;panner.positionX.setTargetAtTime(x,t,0.03);panner.positionY.setTargetAtTime(z,t,0.03);panner.positionZ.setTargetAtTime(-y,t,0.03);}},status(){analyser.getFloatTimeDomainData(pcm);const rms=Math.sqrt(pcm.reduce((s,v)=>s+v*v,0)/pcm.length);return {context:context.state,playing:lastPlaying,state:lastState,rms};},close(){source.disconnect();panner.disconnect();gain.disconnect();analyser.disconnect();}};
}
root.GTAMovieAudio={sample,create};
})(typeof window!=='undefined'?window:self);
