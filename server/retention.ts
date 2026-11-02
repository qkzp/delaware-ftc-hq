export async function runScheduledRetention(db:D1Database,now=Date.now()){
 await db.batch([db.prepare("DELETE FROM auth_verification_tokens WHERE expires<=?").bind(now),db.prepare("DELETE FROM auth_email_rate WHERE created<?").bind(now-86400000),db.prepare("DELETE FROM chat_messages WHERE created<strftime('%Y-%m-%dT%H:%M:%fZ',?,'unixepoch','-'||MIN(30,MAX(1,COALESCE((SELECT retention_days FROM chat_settings WHERE chat_settings.team_id=chat_messages.team_id),30)))||' days')").bind(now/1000)]);
}
