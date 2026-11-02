import type {RouteObstacle} from "./types";
export type FieldLayout="biobuzz-2026"|"blank";
export const BIOBUZZ_ART="/fields/biobuzz-team16236-2026-v1.png";
export const BIOBUZZ_SOURCE="https://www.reddit.com/r/FTC/comments/1weleaj/biobuzz_custom_field_images_meepmeep_compatible/";
export const BIOBUZZ_OFFICIAL="https://ftc-resources.firstinspires.org/ftc/archive/2027/field";
/** Conservative visual screening around the center structure, not official field geometry. */
export function fieldObstacles(layout:FieldLayout):RouteObstacle[]{
 return layout==="biobuzz-2026"?[{id:"biobuzz-2026-hive-approx",name:"BIOBUZZ HIVE (approximate)",x:45,y:45,width:54,height:54}]:[];
}
