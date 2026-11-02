/** Illustrative one-node thermal model, not a motor-specific protection controller. */
export interface ThermalInputs {
 ambientC:number; startC:number; thresholdC:number; heatWatts:number;
 resistanceCPerWatt:number; capacityJPerC:number; durationSeconds:number;
}
export function speedAssessment(feetPerSecond:number,target:number){
 if(!Number.isFinite(feetPerSecond)||feetPerSecond<0||!Number.isFinite(target)||target<=0||target>1000)throw new Error("Enter a speed target above 0 and at most 1000 ft/s.");
 return {aboveTarget:feetPerSecond>target,excessFeetPerSecond:Math.max(0,feetPerSecond-target)};
}
export function simulateThermal(input:ThermalInputs){
 const ranges:Record<keyof ThermalInputs,[number,number]>={ambientC:[-50,250],startC:[-50,250],thresholdC:[-50,250],heatWatts:[0,2000],resistanceCPerWatt:[.001,1000],capacityJPerC:[.1,100000],durationSeconds:[1,3600]};
 for(const key of Object.keys(ranges) as (keyof ThermalInputs)[]){const [min,max]=ranges[key];if(!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw new Error("Check the thermal inputs and the limits shown in the model settings.");}
 const {ambientC,startC,thresholdC,heatWatts,resistanceCPerWatt,capacityJPerC,durationSeconds}=input;
 const equilibriumC=ambientC+heatWatts*resistanceCPerWatt,tauSeconds=resistanceCPerWatt*capacityJPerC;
 const temperatureAt=(seconds:number)=>startC+(equilibriumC-startC)*(-Math.expm1(-seconds/tauSeconds));
 let crossing:number|null=null;
 if(startC>=thresholdC)crossing=0;
 else if(equilibriumC>thresholdC){const time=-tauSeconds*Math.log((equilibriumC-thresholdC)/(equilibriumC-startC));if(time<=durationSeconds)crossing=time;}
 const samples=Array.from({length:241},(_,i)=>{const seconds=durationSeconds*i/240;return {seconds,temperatureC:temperatureAt(seconds)};});
 return {input:{...input},equilibriumC,tauSeconds,thresholdSeconds:crossing,endC:temperatureAt(durationSeconds),samples};
}
