type D1Result<T = unknown> = { success:boolean; results:T[]; meta:{changes:number;last_row_id?:number} };

// Cloudflare documents optional per-statement fields; result cardinality and read
// rows still have to be present before we can treat a response as complete.
export function validateD1Response<T=unknown>(payload:unknown,requireRows:boolean[]):D1Result<T>[] {
 const invalid=()=>{throw new Error("The D1 storage provider returned an incomplete response.");};
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return invalid();
 const envelope=payload as {success?:unknown;result?:unknown};
 if(envelope.success!==true||!Array.isArray(envelope.result)||envelope.result.length!==requireRows.length)return invalid();
 return envelope.result.map((value,index)=>{
  if(!value||typeof value!=="object"||Array.isArray(value))return invalid();
  const item=value as {success?:unknown;results?:unknown;meta?:unknown};
  if(item.success!==undefined&&item.success!==true)return invalid();
  if(item.results!==undefined&&!Array.isArray(item.results))return invalid();
  if(Array.isArray(item.results)&&item.results.some(row=>!row||typeof row!=="object"||Array.isArray(row)))return invalid();
  if(requireRows[index]&&!Array.isArray(item.results))return invalid();
  if(item.meta!==undefined&&(!item.meta||typeof item.meta!=="object"||Array.isArray(item.meta)))return invalid();
  if(item.success===undefined&&item.results===undefined&&item.meta===undefined)return invalid();
  const meta=(item.meta??{}) as {changes?:unknown;last_row_id?:unknown};
  if(meta.changes!==undefined&&(typeof meta.changes!=="number"||!Number.isFinite(meta.changes)||meta.changes<0))return invalid();
  if(meta.last_row_id!==undefined&&(typeof meta.last_row_id!=="number"||!Number.isFinite(meta.last_row_id)))return invalid();
  return {success:true,results:(item.results??[]) as T[],meta:{changes:(meta.changes??0) as number,last_row_id:meta.last_row_id as number|undefined}};
 });
}
