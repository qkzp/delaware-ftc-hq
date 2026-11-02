import test from "node:test";
import assert from "node:assert/strict";
import {simulateThermal,speedAssessment} from "../src/thermal.ts";
const base={ambientC:25,startC:25,thresholdC:55,heatWatts:40,resistanceCPerWatt:2,capacityJPerC:120,durationSeconds:180};
test("speed flags use the selected target and never invent a universal safe speed",()=>{
 assert.equal(speedAssessment(7,6).aboveTarget,true);assert.equal(speedAssessment(7,8).aboveTarget,false);assert.equal(speedAssessment(6,6).aboveTarget,false);assert.equal(speedAssessment(0,6).excessFeetPerSecond,0);
 for(const [speed,target]of [[NaN,6],[-1,6],[4,0],[4,Infinity],[4,1001]])assert.throws(()=>speedAssessment(speed,target));
});
test("the thermal model starts at the entered temperature and obeys its one-node energy balance",()=>{
 const a=simulateThermal({...base,durationSeconds:240});assert.equal(a.samples.length,241);assert.equal(a.samples[0].temperatureC,25);assert.equal(a.tauSeconds,240);assert.equal(a.equilibriumC,105);assert.ok(Math.abs(a.endC-(25+80*(1-Math.exp(-1))))<1e-10);assert.ok(a.samples.every((p,i)=>!i||p.temperatureC>=a.samples[i-1].temperatureC));
 const cooling=simulateThermal({...base,startC:60,heatWatts:0});assert.ok(cooling.endC<60&&cooling.endC>25);assert.equal(cooling.thresholdSeconds,0);
});
test("threshold markers solve the crossing time and greater assumed losses reach the threshold earlier",()=>{
 const a=simulateThermal(base),b=simulateThermal({...base,heatWatts:50});assert.ok(a.thresholdSeconds>b.thresholdSeconds&&b.thresholdSeconds>0);assert.ok(b.endC>a.endC);
 for(const result of [a,b]){const temperature=25+result.input.heatWatts*2*(1-Math.exp(-result.thresholdSeconds/240));assert.ok(Math.abs(temperature-55)<1e-10);}
});
test("unreached, asymptotic and already-exceeded thresholds are reported without false cutoff claims",()=>{
 assert.equal(simulateThermal({...base,durationSeconds:10}).thresholdSeconds,null);assert.equal(simulateThermal({...base,heatWatts:15}).thresholdSeconds,null);assert.equal(simulateThermal({...base,heatWatts:0}).thresholdSeconds,null);assert.equal(simulateThermal({...base,startC:55}).thresholdSeconds,0);assert.equal(simulateThermal({...base,startC:70}).thresholdSeconds,0);
});
test("invalid thermal inputs cannot produce fabricated curves or unbounded sampling",()=>{
 for(const changes of [{heatWatts:-1},{heatWatts:NaN},{resistanceCPerWatt:0},{capacityJPerC:0},{durationSeconds:0},{durationSeconds:3601},{startC:Infinity},{thresholdC:251}])assert.throws(()=>simulateThermal({...base,...changes}));assert.equal(simulateThermal({...base,durationSeconds:3600}).samples.length,241);
});
