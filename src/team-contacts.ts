import type {TeamContacts} from "./types";
export function validTeamContacts(value:unknown):value is TeamContacts{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const contacts=value as Record<string,unknown>;
 return [contacts.supportEmail,contacts.privacyEmail].every(email=>typeof email==="string"&&email.length<=254&&(email===""||/^[^\s@<>,;()[\]\\"]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)));
}
