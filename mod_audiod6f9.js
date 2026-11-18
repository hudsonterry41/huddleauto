/* Bounded legacy custom-audio metadata adapters. Wave payloads are never transcoded. */
function fail(message){const e=new Error(message);e.code='AUDIO_FORMAT';throw e;}
function reader(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return at=>{if(!Number.isSafeInteger(at)||at<0||at+4>bytes.length)fail('Truncated audio metadata');return v.getUint32(at,true);};}
export function audioHash(name){let h=0;for(const c of new TextEncoder().encode(name.toLowerCase())){h=(h+c)>>>0;h=(h+(h<<10))>>>0;h^=h>>>6;}h=(h+(h<<3))>>>0;h^=h>>>11;return(h+(h<<15))>>>0;}
export function audioIndex(bytes,type){
 if(!(bytes instanceof Uint8Array)||bytes.length>4*1048576)fail('Audio metadata exceeds 4 MiB');const u=reader(bytes);if(u(0)!==type)fail('Expected DAT'+type);
 const length=u(4),end=8+length,index=end+4+u(end),count=u(index);if(length<4||count>65536||index+4+count*12>bytes.length)fail('Invalid audio object index');
 const rows=Array.from({length:count},(_,i)=>{const at=index+4+i*12;return{hash:u(at),offset:u(at+4),size:u(at+8)};});let previous=4;const hashes=new Set();
 for(const r of [...rows].sort((a,b)=>a.offset-b.offset)){if(r.offset<previous||r.size<4||r.offset+r.size>length||hashes.has(r.hash))fail('Invalid or overlapping audio object');previous=r.offset+r.size;hashes.add(r.hash);}
 return{u,length,end,index,rows};
}
export function adaptSoundMetadata(bytes){
 const {u,length,end,index,rows}=audioIndex(bytes,54),ordered=[...rows].sort((a,b)=>a.offset-b.offset),insertions=ordered.map(r=>r.offset+1);if(!rows.length||rows.some(r=>r.size<5))fail('Empty or truncated sound graph');
 const move=relative=>{let lo=0,hi=insertions.length;while(lo<hi){const mid=(lo+hi)>>>1;if(insertions[mid]<=relative)lo=mid+1;else hi=mid;}return relative+3*lo;};
 const out=new Uint8Array(bytes.length+3*rows.length),v=new DataView(out.buffer);let source=8,destination=8;
 for(const relative of insertions){const stop=8+relative;out.set(bytes.subarray(source,stop),destination);destination+=stop-source+3;source=stop;}out.set(bytes.subarray(source,end),destination);
 v.setUint32(0,54,true);v.setUint32(4,length+3*rows.length,true);let normalized=0;
 for(const r of rows){const at=8+move(r.offset)+4;for(let j=0;j<4;j++)if(out[at+j]===0xaa){out[at+j]=0;normalized++;}}
 let at=end+3*rows.length;out.set(bytes.subarray(end,index+4),at);at+=index+4-end;
 for(const r of rows){v.setUint32(at,r.hash,true);v.setUint32(at+4,move(r.offset),true);v.setUint32(at+8,r.size+3,true);at+=12;}
 let cursor=index+4+rows.length*12;
 for(let t=0;t<2;t++){const count=u(cursor);cursor+=4;if(count>65536||cursor+count*4>bytes.length)fail('Invalid sound relocation table');v.setUint32(at,count,true);at+=4;for(let i=0;i<count;i++){const absolute=u(cursor);cursor+=4;if(absolute<8||absolute>end-4||insertions.some(p=>p>absolute-8&&p<absolute-8+4))fail('Invalid sound relocation');v.setUint32(at,8+move(absolute-8),true);at+=4;}}
 if(cursor!==bytes.length||at!==out.length)fail('Unsupported sound metadata trailer');return{bytes:out,objects:rows.length,normalized};
}
export function adaptGameMetadata(bytes,path){
 const {u,rows}=audioIndex(bytes,151),out=bytes.slice(),v=new DataView(out.buffer);let marked=0;
 for(const r of rows)if(bytes[8+r.offset]===88){if(r.size!==244)fail('Unsupported granular engine schema');const flags=u(12+r.offset),upper=flags>>>16;if(upper!==0&&upper!==0xaaaa&&upper!==0x4756)fail('Unknown granular flags schema');v.setUint32(12+r.offset,(flags&65535)|0x47560000,true);marked++;}
 const name=path.split('/').pop().replace(/_game\.dat151(?:\.rel)?$/i,'').toLowerCase();const sources=/^[a-z0-9_]{1,32}$/.test(name)&&rows.some(r=>r.hash===audioHash(name)&&bytes[8+r.offset]===3)?[name]:[];
 return{bytes:out,marked,sources};
}
export function inspectWaveBank(bytes){
 const u=reader(bytes);if(u(0)!==0x54414441)fail('Expected unencrypted ADAT wave bank');const flags=u(4),count=u(8),header=u(12);if((flags&65535)!==1||(flags&(1<<19))||!count||count>65536||header>bytes.length)fail('Unsupported or encrypted AWC header');
 const start=16+((flags&(1<<16))?count*2:0),infos=Array.from({length:count},(_,i)=>u(start+i*4));let cursor=start+count*4;const waves=[];
 for(const info of infos){let format=null,pcmBytes=null;for(let j=0;j<(info>>>29);j++){if(cursor+8>header)fail('Truncated AWC chunk table');const lo=u(cursor),hi=u(cursor+4),offset=lo&0xfffffff,size=(lo>>>28)|((hi&0xffffff)<<4),kind=hi>>>24;cursor+=8;if(kind===0x55){if(pcmBytes!==null)fail('Duplicate PCM chunk');pcmBytes=size;}if(offset<header||offset+size>bytes.length)fail('AWC chunk outside bank');if(kind===0xfa){if(size!==20&&size!==24)fail('Unsupported AWC format schema');const rate=bytes[offset+8]|bytes[offset+9]<<8,codec=bytes[offset+19];if(codec!==0||rate<8000||rate>192000||!u(offset))fail('Only validated PCM16LE custom banks are currently supported');format={samples:u(offset),rate,codec};}}
 if(!format)fail('Streaming or multichannel AWC needs a separate adapter');if(pcmBytes!==format.samples*2)fail('PCM size does not match declared sample count');waves.push({hash:info&0x1fffffff,...format});}
 return{waves:count,formats:waves};
}
