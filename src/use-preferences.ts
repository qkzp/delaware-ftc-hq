import {useCallback,useEffect,useState} from "react";
import {defaultPreferences,readPreferences,writePreferences,rememberPreferences,type Preferences} from "./preferences";
export function usePreferences(){
 const [preferences,setPreferences]=useState<Preferences>(defaultPreferences),[stored,setStored]=useState(true);
 useEffect(()=>{const refresh=()=>setPreferences(readPreferences());refresh();window.addEventListener("storage",refresh);window.addEventListener("myftc-preferences",refresh);return()=>{window.removeEventListener("storage",refresh);window.removeEventListener("myftc-preferences",refresh);};},[]);
 const update=useCallback((patch:Partial<Preferences>)=>{try{setPreferences(writePreferences(patch));setStored(true);window.dispatchEvent?.(new Event("myftc-preferences"));}catch{setPreferences(previous=>({...previous,...patch}));setStored(false);rememberPreferences(patch);window.dispatchEvent?.(new Event("myftc-preferences"));}},[]);
 return {preferences,update,stored};
}
export function useViewPreference<K extends "taskView"|"calendarView"|"sponsorView"|"fieldView">(key:K):[Preferences[K],(value:Preferences[K])=>void]{
 const {preferences,update}=usePreferences();return [preferences[key],value=>update({[key]:value})];
}
