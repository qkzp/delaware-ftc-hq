CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hash` text NOT NULL,
	`role` text NOT NULL,
	`expires` text NOT NULL,
	`used_by` text,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_hash_unique` ON `invitations` (`hash`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`version` integer NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
