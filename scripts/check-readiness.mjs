import {readFileSync} from "node:fs";
import {assessReadiness} from "../server/readiness.ts";
const file=process.argv[2];
if(!file)throw new Error("Usage: node scripts/check-readiness.mjs <review-record.json>");
const result=assessReadiness({MYFTC_DATA_ENABLED:"true",MYFTC_READINESS_RECORD:readFileSync(file,"utf8")});
process.stdout.write(JSON.stringify({enabled:result.enabled,releaseId:result.releaseId,issues:result.issues},null,2)+"\n");
if(!result.enabled)process.exitCode=1;
