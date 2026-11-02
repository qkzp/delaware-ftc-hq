CREATE TABLE `auth_accounts` (
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`provider`, `provider_account_id`)
);
--> statement-breakpoint
CREATE TABLE `auth_email_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_hash` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_email_rate_window` ON `auth_email_rate` (`recipient_hash`,`created`);--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_email_unique` ON `auth_users` (`email`);--> statement-breakpoint
CREATE TABLE `auth_verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE TABLE `chat_blocks` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`, `blocked_user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	`removed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_channel_created` ON `chat_messages` (`team_id`,`recipient_id`,`created`);--> statement-breakpoint
CREATE INDEX `chat_sender_created` ON `chat_messages` (`team_id`,`sender_id`,`created`);--> statement-breakpoint
CREATE TABLE `chat_settings` (
	`team_id` text PRIMARY KEY NOT NULL,
	`dm_enabled` integer DEFAULT 0 NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`updated` text NOT NULL
);
