/** Illustrative one-node thermal model, not a motor-specific protection controller. */
export interface ThermalInputs {
 ambientC:number; startC:number; thresholdC:number; heatWatts:number;
 resistanceCPerWatt:number; capacityJPerC:number; durationSeconds:number;
}
export function speedAssessment(feetPerSecond:number,target:number){
 if(!Number.isFinite(feetPerSecond)||feetPerSecond<0||!Number.isFinite(target)||target<=0||target>1000)throw new Error("Enter a speed target above 0 and at most 1000 ft/s.");
 return {aboveTarget:feetPerSecond>target,excessFeetPerSecond:Math.max(0,feetPerSecond-target)};
}
export interface ThermalSimulation {input:ThermalInputs;equilibriumC:number|null;tauSeconds:number;thresholdSeconds:number|null;endC:number;samples:{seconds:number;temperatureC:number}[];electrical?:{algorithm:string;motor:MotorElectricalInputs;windingOhmsAt25C:number;initialCurrentAmps:number;initialHeatWatts:number;endCurrentAmps:number;endHeatWatts:number;integrationSteps:number};}
export interface MotorElectricalInputs {ratedVoltage:number;stallCurrentAmps:number;supplyVoltage:number;currentLimitAmps:number;temperatureCoefficientPerC:number;}
export function simulateThermal(input:ThermalInputs):ThermalSimulation{
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

/** Brushed DC, zero-speed stall, ideal motor-side current clamp. No hardware control. */
export function simulateMotorThermal(input:Omit<ThermalInputs,"heatWatts">,motor:MotorElectricalInputs,options:{maxStepSeconds?:number}={}):ThermalSimulation{
 const ranges:Record<keyof MotorElectricalInputs,[number,number]>={ratedVoltage:[.1,48],stallCurrentAmps:[.01,200],supplyVoltage:[0,48],currentLimitAmps:[0,200],temperatureCoefficientPerC:[0,.005]};
 for(const key of Object.keys(ranges) as (keyof MotorElectricalInputs)[]){const [low,high]=ranges[key];if(!Number.isFinite(motor[key])||motor[key]<low||motor[key]>high)throw new Error("Check motor voltage, stall current, current limit and temperature coefficient.");}
 // The datasheet stall-current reference is approximated at 25 C.
 const windingOhmsAt25C=motor.ratedVoltage/motor.stallCurrentAmps;
 const electricalAt=(temperature:number)=>{const ohms=windingOhmsAt25C*(1+motor.temperatureCoefficientPerC*(temperature-25));if(ohms<=0)throw new Error("The winding resistance model is outside its valid range.");const amps=Math.min(motor.supplyVoltage/ohms,motor.currentLimitAmps);return {amps,heat:amps*amps*ohms};};
 const initial=electricalAt(input.startC),reference=simulateThermal({...input,heatWatts:initial.heat}),tau=reference.tauSeconds;
 const maxStep=options.maxStepSeconds??.1;if(!Number.isFinite(maxStep)||maxStep<=0||maxStep>.1)throw new Error("Use a numerical step above zero and at most 0.1 seconds.");
 // Bound both cooling and temperature-dependent electrical feedback rates.
 const heatSlopeBound=motor.supplyVoltage*motor.currentLimitAmps*motor.temperatureCoefficientPerC/.625;
 const feedbackStep=heatSlopeBound>0?input.capacityJPerC/(20*heatSlopeBound):Infinity;
 const subdivisions=Math.ceil((input.durationSeconds/240)/Math.min(maxStep,tau/20,feedbackStep)),steps=subdivisions*240;
 if(steps>200000)throw new Error("This thermal response needs more resolution than the model supports. Check resistance, capacity and duration.");
 const dt=input.durationSeconds/steps,samples=[{seconds:0,temperatureC:input.startC}];let temperature=input.startC,thresholdSeconds:number|null=temperature>=input.thresholdC?0:null;
 for(let index=0;index<steps;index++){
  const {heat}=electricalAt(temperature);if(heat>2000)throw new Error("Calculated heat exceeds the 2000 W model limit.");
  const equilibrium=input.ambientC+heat*input.resistanceCPerWatt,next=temperature+(equilibrium-temperature)*(-Math.expm1(-dt/tau));
  if(thresholdSeconds===null&&temperature<input.thresholdC&&next>=input.thresholdC&&equilibrium>input.thresholdC){const fraction=(equilibrium-input.thresholdC)/(equilibrium-temperature);thresholdSeconds=index*dt-tau*Math.log(fraction);}
  temperature=next;if(!Number.isFinite(temperature))throw new Error("The motor model could not produce a finite temperature.");
  if((index+1)%subdivisions===0)samples.push({seconds:(index+1)*dt,temperatureC:temperature});
 }
 const end=electricalAt(temperature);
 return {input:{...input,heatWatts:initial.heat},equilibriumC:null,tauSeconds:tau,thresholdSeconds,endC:temperature,samples,electrical:{algorithm:"dc-stall-i2r-temperature-feedback-v1",motor:{...motor},windingOhmsAt25C,initialCurrentAmps:initial.amps,initialHeatWatts:initial.heat,endCurrentAmps:end.amps,endHeatWatts:end.heat,integrationSteps:steps}};
}
