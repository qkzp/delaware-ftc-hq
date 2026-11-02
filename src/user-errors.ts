const technical=/(?:TypeError|SyntaxError|ReferenceError|RangeError|Cannot read properties|is not defined|stack trace|Traceback|Unhandled exception|\bat\s+\w+.*:\d+|\b(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\b(?:FROM|INTO|SET|WHERE)\b|SQLITE|D1_ERROR|ECONN|ENOENT|fetch failed|Failed to fetch|Unexpected token|JSON\.parse|node_modules|\.tsx?:\d+|Bearer\s|<html|<!doctype|C:\\|https?:\/\/[^\s]+\?[^\s]*(?:token|secret)=)/i;
export function userError(value:unknown,fallback="We couldn’t complete that action. Your saved work is still available. Check your connection and try again."){
 const raw=typeof value==="string"?value:value instanceof Error?value.message:"";
 if(!raw||raw.length>500||technical.test(raw)||/[{}<>]/.test(raw))return fallback;
 return raw;
}
