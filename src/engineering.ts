import type {MaintenanceItem,MotorObservation,MotorTest,RobotLabData,RobotProfile,RouteObstacle,ServoCalibration} from "./types";
import {fitMotorModel,planRoute,type MotorModel,type RobotHardware,type Waypoint} from "./robot-lab";
export const emptyRobotLab=():RobotLabData=>({profiles:[],tests:[],calibrations:[],maintenance:[]});
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const finite=(v:unknown,min:number,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v:unknown,max=2000):v is string=>typeof v==="string"&&v.length<=max;
const day=(v:unknown,empty=false)=>typeof v==="string"&&(empty&&v===""||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v);
const list=(v:unknown,max:number,predicate:(row:any)=>boolean)=>Array.isArray(v)&&v.length<=max&&v.every(row=>obj(row)&&text(row.id,100)&&!!row.id&&predicate(row))&&new Set(v.map(row=>row.id)).size===v.length;
export function validModel(v:unknown):v is MotorModel{return obj(v)&&v.source==="telemetry"&&finite(v.a,.000001,.99999999)&&finite(v.b,.000001,1e9)&&finite(v.dt,.005,.2)&&finite(v.maxVelocity,.000001,1e10)&&finite(v.tau,.000001,1e6)&&finite(v.validationError,0,1e6)&&Number.isInteger(v.samples)&&finite(v.samples,50,10000);}
export function validObstacles(v:unknown):v is RouteObstacle[]{return list(v,30,row=>text(row.name,100)&&[row.x,row.y].every(n=>finite(n,0,144))&&[row.width,row.height].every(n=>finite(n,.1,144))&&row.x+row.width<=144&&row.y+row.height<=144);}
export function validProfile(v:unknown):v is RobotProfile {if(!obj(v)||!text(v.id,100)||!v.id||!text(v.name,100)||!v.name.trim()||!text(v.robotName,100)||!text(v.season,100)||typeof v.archived!=="boolean"||!validObstacles(v.obstacles))return false;try{planRoute(v.hardware,v.route);return true;}catch{return false;}}
export function validRobotLab(v:unknown):v is RobotLabData {
 if(!obj(v)||!list(v.profiles,30,validProfile))return false;
 const ids=new Set(v.profiles.map((p:RobotProfile)=>p.id));
 if(!list(v.tests,50,row=>ids.has(row.profileId)&&text(row.partId,100)&&!!row.partId&&text(row.name,100)&&!!row.name&&text(row.notes)&&["manual","csv"].includes(row.source)&&typeof row.recordedAt==="string"&&Number.isFinite(Date.parse(row.recordedAt))&&Array.isArray(row.samples)&&row.samples.length>0&&row.samples.length<=200&&row.samples.every((s:unknown)=>obj(s)&&finite(s.time,0,86400)&&finite(s.rpm,-100000,100000)&&(s.current===undefined||finite(s.current,0,1000))&&(s.temperature===undefined||finite(s.temperature,-100,300))&&(s.power===undefined||finite(s.power,-1,1))&&(s.velocity===undefined||finite(s.velocity,-1e9,1e9)))&&(row.encoderTicksPerRev===undefined||finite(row.encoderTicksPerRev,1,1000000))&&(row.model===undefined||row.source==="csv"&&validModel(row.model))))return false;
 if(!list(v.calibrations,100,row=>ids.has(row.profileId)&&text(row.partId,100)&&!!row.partId&&["Positional","Continuous rotation"].includes(row.servoType)&&(row.servoType==="Continuous rotation"||row.minimum>=0)&&["Forward","Reverse"].includes(row.direction)&&[row.minimum,row.maximum,row.neutral].every(n=>finite(n,-1,1))&&row.minimum<=row.neutral&&row.neutral<=row.maximum&&row.minimum<row.maximum&&day(row.reviewedAt,true)&&text(row.notes)&&Array.isArray(row.presets)&&row.presets.length<=20&&row.presets.every((p:unknown)=>obj(p)&&text(p.name,100)&&!!p.name&&finite(p.command,row.minimum,row.maximum))))return false;
 return list(v.maintenance,100,row=>ids.has(row.profileId)&&text(row.partId,100)&&text(row.title,120)&&!!row.title&&day(row.due)&&Number.isInteger(row.intervalDays)&&finite(row.intervalDays,0,3650)&&text(row.owner,100)&&text(row.notes)&&day(row.lastCompleted,true)&&typeof row.done==="boolean");
}
export function completeMaintenance(item:MaintenanceItem,today:string):MaintenanceItem{
 if(!day(today))throw new Error("Use a valid completion date.");
 return {...item,lastCompleted:today,done:item.intervalDays===0,due:item.intervalDays?new Date(Date.parse(today+"T12:00:00Z")+item.intervalDays*86400000).toISOString().slice(0,10):item.due};
}
export function summarizeMotorSamples(samples:MotorObservation[]){return {count:samples.length,meanRpm:samples.reduce((sum,s)=>sum+s.rpm,0)/samples.length,peakRpm:Math.max(...samples.map(s=>Math.abs(s.rpm))),peakCurrent:Math.max(0,...samples.flatMap(s=>s.current===undefined?[]:[s.current])),peakTemperature:samples.some(s=>s.temperature!==undefined)?Math.max(...samples.flatMap(s=>s.temperature===undefined?[]:[s.temperature])):undefined};}
export function parseTelemetryCSV(csv:string,ticksPerRev:number){
 if(csv.length>1000000||!finite(ticksPerRev,1,1000000))throw new Error("Use a CSV under 1 MB and a recorded encoder ticks/revolution value for this motor.");
 const lines=csv.trim().split(/\r?\n/),headers=lines.shift()!.trim().toLowerCase().split(",").map(s=>s.trim());
 if(!["time","power","velocity"].every(h=>headers.includes(h))||headers.some(h=>!["time","power","velocity","current","temperature"].includes(h))||new Set(headers).size!==headers.length||lines.length<1||lines.length>10000)throw new Error("Use time,power,velocity with optional current,temperature columns; 1–10000 observations. Units: seconds, power -1..1, ticks/s, amps, Celsius.");
 const samples=lines.map((line,index)=>{const values=line.split(",");if(values.length!==headers.length||values.some(v=>!v.trim()||!Number.isFinite(Number(v))))throw new Error(`Invalid numeric telemetry on row ${index+2}.`);const row=Object.fromEntries(headers.map((key,i)=>[key,Number(values[i])])) as Record<string,number>;if(!finite(row.time,0,86400)||!finite(row.power,-1,1)||!finite(row.velocity,-1e9,1e9)||(row.current!==undefined&&!finite(row.current,0,1000))||(row.temperature!==undefined&&!finite(row.temperature,-100,300)))throw new Error(`Telemetry outside supported units on row ${index+2}.`);return {...row,time:row.time,rpm:row.velocity*60/ticksPerRev} as MotorObservation;});
 if(samples.some((s,i)=>!finite(s.rpm,-100000,100000)||i>0&&s.time<=samples[i-1].time))throw new Error("Use increasing timestamps and check encoder units; output-shaft RPM must stay within ±100000.");
 let model:MotorModel|undefined,modelError="";try{model=fitMotorModel(samples.map(s=>({time:s.time,power:s.power!,velocity:s.velocity!})),"telemetry");}catch(e){modelError=(e as Error).message;}
 return {samples,model,modelError};
}
export function retainedSamples(samples:MotorObservation[]){if(samples.length<=200)return samples;const peaks=[samples.reduce((a,b)=>Math.abs(a.rpm)>Math.abs(b.rpm)?a:b),samples.reduce((a,b)=>(a.current??-Infinity)>(b.current??-Infinity)?a:b),samples.reduce((a,b)=>(a.temperature??-Infinity)>(b.temperature??-Infinity)?a:b)];return [...new Set([...Array.from({length:197},(_,i)=>samples[Math.round(i*(samples.length-1)/196)]),...peaks])].sort((a,b)=>a.time-b.time);}
/** Conservative swept circular footprint versus axis-aligned obstacles. Includes turns. */
export function routeCollisions(hardware:RobotHardware,route:Waypoint[],obstacles:RouteObstacle[]):string[]{
 const radius=Math.hypot(hardware.width,hardware.length)/2,hits=new Set<string>();
 for(const box of obstacles)for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i];let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-(box.x-radius)],[dx,box.x+box.width+radius-a.x],[-dy,a.y-(box.y-radius)],[dy,box.y+box.height+radius-a.y]]){if(p===0){if(q<0){hi=-1;break;}}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);}
  if(lo<=hi)hits.add(box.name||"Unnamed obstacle");
 }
 return [...hits];
}
