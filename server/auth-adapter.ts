import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";

export function normalizeLoginEmail(value: string) {
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^[^\s@<>,;()[\]\\"]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email))throw new Error("Enter one valid email address.");
  return email;
}
type UserRow={id:string;email:string;email_verified:number|null};
const user=(row:UserRow|null):AdapterUser|null=>row?{id:row.id,email:row.email,emailVerified:row.email_verified?new Date(row.email_verified):null,name:null,image:null}:null;

export function d1AuthAdapter(db:D1Database):Adapter {
  const getUser=async(id:string)=>user(await db.prepare("SELECT id,email,email_verified FROM auth_users WHERE id=?").bind(id).first<UserRow>());
  return {
    getUser,
    async getUserByEmail(email){return user(await db.prepare("SELECT id,email,email_verified FROM auth_users WHERE email=?").bind(normalizeLoginEmail(email)).first<UserRow>());},
    async getUserByAccount({provider,providerAccountId}){return user(await db.prepare("SELECT u.id,u.email,u.email_verified FROM auth_users u JOIN auth_accounts a ON a.user_id=u.id WHERE a.provider=? AND a.provider_account_id=?").bind(provider,providerAccountId).first<UserRow>());},
    async createUser(input:Omit<AdapterUser,"id">){
      const id=crypto.randomUUID(),email=normalizeLoginEmail(input.email);
      await db.prepare("INSERT INTO auth_users(id,email,email_verified,created) VALUES(?,?,?,?)").bind(id,email,input.emailVerified?.getTime()||0,Date.now()).run();
      return {id,email,emailVerified:input.emailVerified||null,name:null,image:null};
    },
    async updateUser(input){
      if(input.emailVerified)await db.prepare("UPDATE auth_users SET email_verified=? WHERE id=?").bind(input.emailVerified.getTime(),input.id).run();
      const result=await getUser(input.id);if(!result)throw new Error("Authentication account is unavailable.");return result;
    },
    async linkAccount(account:AdapterAccount){
      await db.prepare("INSERT INTO auth_accounts(provider,provider_account_id,user_id) VALUES(?,?,?) ON CONFLICT(provider,provider_account_id) DO NOTHING").bind(account.provider,account.providerAccountId,account.userId).run();
      const linked=await db.prepare("SELECT user_id FROM auth_accounts WHERE provider=? AND provider_account_id=?").bind(account.provider,account.providerAccountId).first<{user_id:string}>();
      if(linked?.user_id!==account.userId)throw new Error("This identity is already linked to another authentication account.");
    },
    async createVerificationToken(input){
      await db.prepare("DELETE FROM auth_verification_tokens WHERE expires<=?").bind(Date.now()).run();
      await db.prepare("INSERT INTO auth_verification_tokens(identifier,token,expires) VALUES(?,?,?)").bind(normalizeLoginEmail(input.identifier),input.token,input.expires.getTime()).run();return input;
    },
    async useVerificationToken({identifier,token}){
      const result=await db.prepare("DELETE FROM auth_verification_tokens WHERE identifier=? AND token=? RETURNING identifier,token,expires").bind(normalizeLoginEmail(identifier),token).all<{identifier:string;token:string;expires:number}>();
      const row=result.results[0];return row&&row.expires>Date.now()?{identifier:row.identifier,token:row.token,expires:new Date(row.expires)}:null;
    },
  };
}
