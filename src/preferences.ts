export const PREFERENCE_KEY="myftcspace:preferences";
export type Preferences={theme:"system"|"light"|"dark";textScale:1|1.125|1.25|1.5|2;motion:"system"|"reduced";taskView:"board"|"list"|"plan";calendarView:"Month"|"Agenda"|"Season"|"Map";sponsorView:"list"|"board";fieldView:"biobuzz-2026"|"blank"};
let memory:Partial<Preferences>={};
export function rememberPreferences(patch:Partial<Preferences>){memory={...memory,...patch};}
export const defaultPreferences:Preferences={theme:"system",textScale:1,motion:"system",taskView:"board",calendarView:"Agenda",sponsorView:"list",fieldView:"biobuzz-2026"};
export function readPreferences(storage?:Pick<Storage,"getItem">):Preferences{
 let value:any={};try{const raw=(storage??globalThis.localStorage)?.getItem(PREFERENCE_KEY);if(raw)value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))value={};}catch{/* Use defaults without clearing stored preferences. */}
 const p={...defaultPreferences};
 for(const [key,choices] of Object.entries({theme:["system","light","dark"],textScale:[1,1.125,1.25,1.5,2],motion:["system","reduced"],taskView:["board","list","plan"],calendarView:["Month","Agenda","Season","Map"],sponsorView:["list","board"],fieldView:["biobuzz-2026","blank"]}))if((choices as unknown[]).includes(value[key]))(p as any)[key]=value[key];
 return storage?p:{...p,...memory};
}
export function writePreferences(patch:Partial<Preferences>,storage?:Pick<Storage,"getItem"|"setItem">){
 const target=storage??globalThis.localStorage;let previous:any={};try{previous=JSON.parse(target.getItem(PREFERENCE_KEY)||"{}");if(!previous||typeof previous!=="object"||Array.isArray(previous))previous={};}catch{}
 const next={...readPreferences(target),...patch};target.setItem(PREFERENCE_KEY,JSON.stringify({...previous,...next}));return next;
}
// Runs before paint. Values are constrained; storage is never treated as executable code.
export const preferenceBootstrap=`try{var p=JSON.parse(localStorage.getItem('${PREFERENCE_KEY}')||'{}'),r=document.documentElement,t=['light','dark'].includes(p.theme)?p.theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');r.dataset.theme=t;r.style.colorScheme=t;r.style.fontSize=(100*([1,1.125,1.25,1.5,2].includes(p.textScale)?p.textScale:1))+'%';if(p.motion==='reduced')r.dataset.motion='reduced';}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}`;
