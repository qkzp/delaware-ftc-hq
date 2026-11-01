import type { AppData, Resource } from "./types";

/** Real workspaces begin empty. These links are references, not team records. */
export function createWorkspaceData({teamId="pending-team",teamName="",county="Statewide"}:{teamId?:string;teamName?:string;county?:string}={}): AppData {
  const seasonId="2026-27";
  const reference=(id:string,title:string,category:string,kind:Resource["kind"],description:string,url:string,official=true):Resource=>({
    id,teamId,seasonId,demo:false,title,category,kind,description,url,content:"",owner:"Official source",reviewed:"2026-10-31",official,visibility:"team",approved:true,level:"Beginner",tags:[category],
  });
  return {
    schemaVersion:1,teamId,seasonId,teamName,teamNumber:"",county,seasonName:"2026–27 season",
    tasks:[],events:[],sponsors:[],grants:[],announcements:[],evidence:[],parts:[],onboarding:[],skills:[],pitChecklist:[],pitNotes:[],
    robot:{purpose:"",cad:"",code:"",wiring:"",setup:"",test:"",issues:"",repairs:""},coachInstructions:"",
    resources:[
      reference("first-start","Your first steps in FTC","Getting started","Guide","Official FTC documentation for students and mentors.","https://ftc-docs.firstinspires.org/en/latest/"),
      {...reference("code","FTC Robot Controller repository","Programming","Code","Official controller code and setup documentation. Add your team’s repository as a separate resource.","https://github.com/FIRST-Tech-Challenge/FtcRobotController"),level:"Intermediate"},
      reference("wiring","Control system documentation","Electrical","Wiring","Official control system documentation. Add your robot’s wiring and port map separately.","https://ftc-docs.firstinspires.org/en/latest/"),
      reference("local-first","FIRST Delaware program hub","Delaware","Guide","Regional program information and event sources. Confirm individual dates with the organizer.","https://firstdelaware.org/first-tech-challenge",false),
      reference("maker","University of Delaware MakerSpace","Delaware","Guide","Confirm youth access, training requirements, and availability before arranging a visit.","https://www.udel.edu/research-innovation/maker/spaces/makerspace/",false),
      reference("fundraising","FIRST team management resources","Fundraising","Guide","Official starting points for team organization and fundraising.","https://www.firstinspires.org/resources/library/ftc/team-management-resources"),
    ],
  };
}
