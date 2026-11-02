import type {ActuatorStats} from "./types";
import type {RobotHardware} from "./robot-lab";

const limits:Record<string,number>={voltage:60,ratedRpm:100000,measuredRpm:100000,ticksPerRev:1000000,gearRatio:10000,wheelDiameter:12,travelDegrees:3600,speedSec60:60,torqueKgCm:1000};
export function validActuatorStats(value:unknown):value is ActuatorStats {
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return ["motor","servo"].includes(v.kind as string)&&["Installed","Spare","Retired"].includes(v.status as string)&&["Positional","Continuous rotation"].includes(v.servoType as string)&&["model","purpose","configName","port"].every(key=>typeof v[key]==="string"&&(v[key] as string).length<=500)&&Object.entries(limits).every(([key,max])=>v[key]===undefined||(typeof v[key]==="number"&&Number.isFinite(v[key])&&(v[key] as number)>0&&(v[key] as number)<=max));
}
export function actuatorSummary(stats:ActuatorStats){
 const rpm=stats.measuredRpm??stats.ratedRpm;
 return {rpm,rpmSource:stats.measuredRpm!==undefined?"measured":"rated",ticksPerSecond:stats.kind==="motor"&&rpm&&stats.ticksPerRev?rpm*stats.ticksPerRev/60:undefined,wheelInchesPerSecond:stats.kind==="motor"&&rpm&&stats.gearRatio&&stats.wheelDiameter?rpm/stats.gearRatio*Math.PI*stats.wheelDiameter/60:undefined,travelSeconds:stats.kind==="servo"&&stats.servoType==="Positional"&&stats.travelDegrees&&stats.speedSec60?stats.travelDegrees/60*stats.speedSec60:undefined};
}
export function hardwareFromActuator(hardware:RobotHardware,stats:ActuatorStats):RobotHardware {
 if(!validActuatorStats(stats)||stats.kind!=="motor"||stats.status!=="Installed"||!stats.ticksPerRev||!stats.gearRatio||!stats.wheelDiameter||!(stats.measuredRpm??stats.ratedRpm))throw new Error("Use an installed motor with output-shaft RPM, encoder ticks/revolution, external gear ratio and wheel diameter.");
 return {...hardware,ticksPerRev:stats.ticksPerRev,gearRatio:stats.gearRatio,wheelDiameter:stats.wheelDiameter,ratedRpm:stats.measuredRpm??stats.ratedRpm};
}
