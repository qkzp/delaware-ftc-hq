// Concise planning prompts based on the BIOBUZZ Competition Manual, section 6.3.
// Keep required items distinct from encouraged items; these do not decide awards.
export type AwardCriterion = {id:string;kind:"Required"|"Encouraged";text:string};
export type AwardGuide = {id:string;name:string;criteria:AwardCriterion[]};
const required=(id:string,text:string):AwardCriterion=>({id,kind:"Required",text});
const encouraged=(id:string,text:string):AwardCriterion=>({id,kind:"Encouraged",text});
export const awardManualUrl="https://ftc-resources.firstinspires.org/ftc/game/manual-06";
export const awardGuides:AwardGuide[]=[
 {id:"inspire",name:"Inspire",criteria:[
  required("r1","Submit a portfolio."),
  required("r2","Be a strong contender for at least one Machine, Creativity and Innovation award, one Team Attributes award, and the Think Award."),
  required("r3","Build a positive, inclusive team where every member contributes."),
  required("r4","Share the team's experiences and knowledge with judges.")]},
 {id:"think",name:"Think",criteria:[
  required("r1","Submit a portfolio containing at least one: the engineering process, lessons applied to robot design, comparisons behind a choice, or math used in robot or programming decisions."),
  encouraged("e2","Make portfolio information easy to read and find.")]},
 {id:"connect",name:"Connect",criteria:[
  required("r1","Explain a skills-development plan with both learning goals and steps taken or planned to reach them."),
  encouraged("e2","Build and maintain meaningful relationships with STEM professionals."),
  encouraged("e3","Collaborate with the engineering community through mentoring, shared knowledge, technical guidance or joint activities.")]},
 {id:"reach",name:"Reach",criteria:[
  required("r1","Explain outreach objectives, the strategy behind the activities, and how they grow the FIRST community."),
  required("r2","Show successful recruitment of new teams, coaches, mentors or volunteers who had not previously participated in FIRST."),
  encouraged("e3","Represent FIRST and increase public awareness through outreach and communication."),
  encouraged("e4","Create and improve promotional materials introducing the team and FIRST to the public.")]},
 {id:"sustain",name:"Sustain",criteria:[
  required("r1","Explain plans for long-term success, including at least one of finances, season planning or long-term sustainability objectives."),
  required("r2","Explain how the team measures, reviews and tracks progress toward those plans."),
  encouraged("e3","Define team roles and intentionally prepare future student leaders."),
  encouraged("e4","Identify constraints, reduce risks and adapt plans when challenges arise.")]},
 {id:"innovate",name:"Innovate",criteria:[
  required("r1","Show engineering work that explains how the design was developed."),
  required("r2","Create a unique or creative robot or mechanism design."),
  required("r3","Make the design stable and reliable enough to help reach game goals most of the time."),
  encouraged("e4","Explain how design risks were reduced.")]},
 {id:"control",name:"Control",criteria:[
  required("r1","Submit a portfolio identifying robot control hardware or software, the challenges each solves, and how each works."),
  required("r2","Use at least one hardware or software solution with external feedback to control and improve robot performance."),
  encouraged("e3","Make control solutions work consistently during most matches."),
  encouraged("e4","Demonstrate or explain reliability and possible improvements."),
  encouraged("e5","Describe lessons from developing control solutions through the engineering process.")]},
 {id:"design",name:"Design",criteria:[
  required("r1","Describe or demonstrate an elegant, efficient robot and/or one that is practical to maintain."),
  required("r2","Consider the entire robot design or its detailed design process, not just one part."),
  encouraged("e3","Make the robot stand out in appearance and function."),
  encouraged("e4","Explain the reasons behind design choices."),
  encouraged("e5","Make the design work consistently and align with the team's game strategy.")]},
];
export const awardTaskId=(awardId:string,criterionId:string)=>`award-biobuzz-${awardId}-${criterionId}`;
