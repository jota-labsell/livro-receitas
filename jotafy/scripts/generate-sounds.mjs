import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory=new URL('../android/app/src/main/res/raw/',import.meta.url);await mkdir(directory,{recursive:true});
function wave(duration,notes,gain) {
 const rate=32000,count=Math.floor(duration*rate),buffer=Buffer.alloc(44+count*2);
 buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++) {
  const time=i/rate;let sample=0;
  for(const [start,freq,length,level] of notes){const t=time-start;if(t<0||t>length)continue;const envelope=Math.min(1,t/.008)*Math.exp(-t*7/length)*Math.min(1,(length-t)/.02);sample+=(Math.sin(2*Math.PI*freq*t)+.18*Math.sin(2*Math.PI*2*freq*t))*envelope*level;}
  buffer.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,sample*gain))*32767),44+i*2);
 }return buffer;
}
const sale=wave(.62,[[0,659.25,.22,.5],[.11,830.61,.24,.45],[.22,987.77,.34,.42],[.24,1318.51,.34,.18]],.5);
const pix=wave(.3,[[0,523.25,.2,.45],[.11,659.25,.18,.3]],.35);
for(const [name,data] of [['sale',sale],['pix',pix]]){await writeFile(new URL(name+'.wav',directory),data);console.log(name+': original synthesis, SHA-256 '+createHash('sha256').update(data).digest('hex'));}
