CREATE TABLE native_auth_used_flows (
  flow_hash TEXT PRIMARY KEY NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX native_auth_used_flows_expires_idx ON native_auth_used_flows(expires);
CREATE TABLE native_auth_tickets (
  ticket_hash TEXT PRIMARY KEY NOT NULL,
  challenge TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX native_auth_tickets_expires_idx ON native_auth_tickets(expires);
CREATE TABLE native_auth_rate (
  rate_key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX native_auth_rate_expires_idx ON native_auth_rate(expires);
