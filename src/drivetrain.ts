export type TransmissionStage={kind:"gear"|"chain"|"timing-belt"|"belt"|"ratio";driver:number;driven:number};
export function calculateDrivetrain(motorRpm:number,wheelDiameterInches:number,stages:TransmissionStage[]){
 if(!Number.isFinite(motorRpm)||motorRpm<0||motorRpm>100000)throw new Error("Motor RPM must be between 0 and 100000.");
 if(!Number.isFinite(wheelDiameterInches)||wheelDiameterInches<=0||wheelDiameterInches>12)throw new Error("Wheel diameter must be greater than zero and at most 12 inches (304.8 mm).");
 if(stages.length>10)throw new Error("Use at most 10 transmission stages.");
 let reduction=1,rpm=motorRpm;
 const results=stages.map((stage,index)=>{
  if(!["gear","chain","timing-belt","belt","ratio"].includes(stage.kind)||![stage.driver,stage.driven].every(value=>Number.isFinite(value)&&value>0&&value<=10000))throw new Error(`Check the positive driver and driven values in stage ${index+1}.`);
  if(["gear","chain","timing-belt"].includes(stage.kind)&&![stage.driver,stage.driven].every(Number.isInteger))throw new Error(`Tooth counts in stage ${index+1} must be whole numbers.`);
  if(stage.kind==="ratio"&&stage.driver!==1)throw new Error("A known ratio uses one output revolution as its reference.");
  const ratio=stage.driven/stage.driver,inputRpm=rpm;reduction*=ratio;rpm/=ratio;
  if(reduction<.0001||reduction>10000)throw new Error("Cumulative input/output ratio must stay between 0.0001 and 10000.");
  return {...stage,ratio,inputRpm,outputRpm:rpm};
 });
 const inchesPerSecond=rpm*Math.PI*wheelDiameterInches/60;
 return {motorRpm,wheelDiameterInches,reduction,wheelRpm:rpm,inchesPerSecond,feetPerSecond:inchesPerSecond/12,metersPerSecond:inchesPerSecond*.0254,mph:inchesPerSecond/17.6,kph:inchesPerSecond*.09144,stages:results};
}
