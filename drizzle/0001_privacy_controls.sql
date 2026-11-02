CREATE TABLE `evidence_erasures` (
	`team_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`job_id` text NOT NULL,
	`actor_hash` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`completed` text,
	PRIMARY KEY(`team_id`, `evidence_id`)
);
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`status` text NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`reviewer` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_erasures` (
	`team_id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`actor_hash` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`completed` text
);
--> statement-breakpoint
CREATE TABLE `team_privacy` (
	`team_id` text PRIMARY KEY NOT NULL,
	`paused` integer DEFAULT 0 NOT NULL,
	`uploads_enabled` integer DEFAULT 0 NOT NULL,
	`revision_retention_days` integer DEFAULT 30 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `files` ADD `upload_state` text DEFAULT 'ready' NOT NULL;