import type {TeamContacts} from "../types";
import {validTeamContacts} from "../team-contacts";
export default function TeamContactDetails({contacts}:{contacts?:TeamContacts|null}){
 if(contacts===undefined)return <p className="muted">Team contact details are not available in this view. Use your established coach or school channel while they are checked.</p>;
 if(!contacts||!validTeamContacts(contacts)||!contacts.supportEmail&&!contacts.privacyEmail)return <p className="muted">Your adult team operators have not recorded a monitored contact yet. Use your existing coach or school channel; privacy requests can also be recorded in this workspace.</p>;
 const privacy=contacts.privacyEmail||contacts.supportEmail;
 return <dl className="actuator-stats">{contacts.supportEmail&&<div><dt>Team support</dt><dd><a href={`mailto:${encodeURIComponent(contacts.supportEmail)}`}>{contacts.supportEmail}</a></dd></div>}{privacy&&<div><dt>Team privacy and data requests</dt><dd><a href={`mailto:${encodeURIComponent(privacy)}`}>{privacy}</a></dd></div>}</dl>;
}
