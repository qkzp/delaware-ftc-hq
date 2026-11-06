/** The native flow is available only on the explicitly configured HTTPS host. */
export function nativeCanonicalOrigin(value:string|undefined):string|null {
 try{
  const url=new URL(value||"");
  return url.protocol==="https:"&&!url.username&&!url.password&&(url.pathname==="/"||url.pathname==="")&&!url.search&&!url.hash?url.origin:null;
 }catch{return null;}
}
export function matchesNativeOrigin(headers:Headers,origin:string,requireOrigin=false):boolean {
 const host=headers.get("x-forwarded-host")||headers.get("host");
 const proto=headers.get("x-forwarded-proto")||"https";
 if(!host||!/^[a-z0-9.:-]+$/i.test(host)||proto.toLowerCase()!=="https")return false;
 try{if(new URL("https://"+host).origin!==origin)return false;}catch{return false;}
 if(!requireOrigin)return true;
 const fetchSite=headers.get("sec-fetch-site");
 return headers.get("origin")===origin&&(!fetchSite||fetchSite==="same-origin");
}
