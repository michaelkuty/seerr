import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOidcAccountTable1771296361326 implements MigrationInterface {
  name = 'AddOidcAccountTable1771296361326';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_6bbafa28411e6046421991ea21"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_6bbafa28411e6046421991ea21"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "verification" ("id" varchar PRIMARY KEY NOT NULL, "identifier" varchar NOT NULL, "value" varchar NOT NULL, "expires_at" datetime NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL)`
    );
    await queryRunner.query(
      `CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier") `
    );
    await queryRunner.query(
      `CREATE TABLE "oidc_account" ("id" varchar PRIMARY KEY NOT NULL, "user_id" integer NOT NULL, "issuer" varchar NOT NULL, "sub" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL)`
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_issuer_sub_idx" ON "oidc_account" ("issuer", "sub") `
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_userId_idx" ON "oidc_account" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_account" ("id" varchar PRIMARY KEY NOT NULL, "account_id" varchar NOT NULL, "provider_id" varchar NOT NULL, "user_id" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "scope" varchar, "password" varchar, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL)`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_account_userId_idx" ON "auth_account" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_session" ("id" varchar PRIMARY KEY NOT NULL, "expires_at" datetime NOT NULL, "token" varchar NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ip_address" varchar, "user_agent" varchar, "user_id" varchar NOT NULL, CONSTRAINT "UQ_62cb09e1129f6ec024ef66e1832" UNIQUE ("token"))`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_session_userId_idx" ON "auth_session" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_user" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "email" varchar NOT NULL, "email_verified" boolean NOT NULL DEFAULT (0), "image" varchar, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, CONSTRAINT "UQ_3d29d788cd69d1ddf87e88e01eb" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" date, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "jellyfinUsername" varchar, "jellyfinAuthToken" varchar, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "avatarETag" varchar, "avatarVersion" varchar, "oidcSub" varchar, "oidcIssuer" varchar, "oidcClaims" text, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion" FROM "user"`
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "user_push_subscription"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_user_push_subscription" RENAME TO "user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "blocklist"`
    );
    await queryRunner.query(`DROP TABLE "blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_blocklist" RENAME TO "blocklist"`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "oidc_account_issuer_sub_idx"`);
    await queryRunner.query(`DROP INDEX "oidc_account_userId_idx"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_oidc_account" ("id" varchar PRIMARY KEY NOT NULL, "user_id" integer NOT NULL, "issuer" varchar NOT NULL, "sub" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, CONSTRAINT "FK_4e03cf3568a9d7ff93292f07ee5" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_oidc_account"("id", "user_id", "issuer", "sub", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "created_at", "updated_at") SELECT "id", "user_id", "issuer", "sub", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "created_at", "updated_at" FROM "oidc_account"`
    );
    await queryRunner.query(`DROP TABLE "oidc_account"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_oidc_account" RENAME TO "oidc_account"`
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_issuer_sub_idx" ON "oidc_account" ("issuer", "sub") `
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_userId_idx" ON "oidc_account" ("user_id") `
    );
    await queryRunner.query(`DROP INDEX "auth_account_userId_idx"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_auth_account" ("id" varchar PRIMARY KEY NOT NULL, "account_id" varchar NOT NULL, "provider_id" varchar NOT NULL, "user_id" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "scope" varchar, "password" varchar, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, CONSTRAINT "FK_05f7ed7b1d8115a247886b2ee06" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_auth_account"("id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at") SELECT "id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at" FROM "auth_account"`
    );
    await queryRunner.query(`DROP TABLE "auth_account"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_auth_account" RENAME TO "auth_account"`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_account_userId_idx" ON "auth_account" ("user_id") `
    );
    await queryRunner.query(`DROP INDEX "auth_session_userId_idx"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_auth_session" ("id" varchar PRIMARY KEY NOT NULL, "expires_at" datetime NOT NULL, "token" varchar NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ip_address" varchar, "user_agent" varchar, "user_id" varchar NOT NULL, CONSTRAINT "UQ_62cb09e1129f6ec024ef66e1832" UNIQUE ("token"), CONSTRAINT "FK_b8783d517fab10672700a39cb49" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_auth_session"("id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id") SELECT "id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id" FROM "auth_session"`
    );
    await queryRunner.query(`DROP TABLE "auth_session"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_auth_session" RENAME TO "auth_session"`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_session_userId_idx" ON "auth_session" ("user_id") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "auth_session_userId_idx"`);
    await queryRunner.query(
      `ALTER TABLE "auth_session" RENAME TO "temporary_auth_session"`
    );
    await queryRunner.query(
      `CREATE TABLE "auth_session" ("id" varchar PRIMARY KEY NOT NULL, "expires_at" datetime NOT NULL, "token" varchar NOT NULL, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL, "ip_address" varchar, "user_agent" varchar, "user_id" varchar NOT NULL, CONSTRAINT "UQ_62cb09e1129f6ec024ef66e1832" UNIQUE ("token"))`
    );
    await queryRunner.query(
      `INSERT INTO "auth_session"("id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id") SELECT "id", "expires_at", "token", "created_at", "updated_at", "ip_address", "user_agent", "user_id" FROM "temporary_auth_session"`
    );
    await queryRunner.query(`DROP TABLE "temporary_auth_session"`);
    await queryRunner.query(
      `CREATE INDEX "auth_session_userId_idx" ON "auth_session" ("user_id") `
    );
    await queryRunner.query(`DROP INDEX "auth_account_userId_idx"`);
    await queryRunner.query(
      `ALTER TABLE "auth_account" RENAME TO "temporary_auth_account"`
    );
    await queryRunner.query(
      `CREATE TABLE "auth_account" ("id" varchar PRIMARY KEY NOT NULL, "account_id" varchar NOT NULL, "provider_id" varchar NOT NULL, "user_id" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "scope" varchar, "password" varchar, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL)`
    );
    await queryRunner.query(
      `INSERT INTO "auth_account"("id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at") SELECT "id", "account_id", "provider_id", "user_id", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "scope", "password", "created_at", "updated_at" FROM "temporary_auth_account"`
    );
    await queryRunner.query(`DROP TABLE "temporary_auth_account"`);
    await queryRunner.query(
      `CREATE INDEX "auth_account_userId_idx" ON "auth_account" ("user_id") `
    );
    await queryRunner.query(`DROP INDEX "oidc_account_userId_idx"`);
    await queryRunner.query(`DROP INDEX "oidc_account_issuer_sub_idx"`);
    await queryRunner.query(
      `ALTER TABLE "oidc_account" RENAME TO "temporary_oidc_account"`
    );
    await queryRunner.query(
      `CREATE TABLE "oidc_account" ("id" varchar PRIMARY KEY NOT NULL, "user_id" integer NOT NULL, "issuer" varchar NOT NULL, "sub" varchar NOT NULL, "access_token" varchar, "refresh_token" varchar, "id_token" varchar, "access_token_expires_at" datetime, "refresh_token_expires_at" datetime, "created_at" datetime NOT NULL, "updated_at" datetime NOT NULL)`
    );
    await queryRunner.query(
      `INSERT INTO "oidc_account"("id", "user_id", "issuer", "sub", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "created_at", "updated_at") SELECT "id", "user_id", "issuer", "sub", "access_token", "refresh_token", "id_token", "access_token_expires_at", "refresh_token_expires_at", "created_at", "updated_at" FROM "temporary_oidc_account"`
    );
    await queryRunner.query(`DROP TABLE "temporary_oidc_account"`);
    await queryRunner.query(
      `CREATE INDEX "oidc_account_userId_idx" ON "oidc_account" ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_issuer_sub_idx" ON "oidc_account" ("issuer", "sub") `
    );
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_09b94c932e84635c5461f3c0a9"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"))`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
    await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
    await queryRunner.query(
      `CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "email" varchar NOT NULL, "username" varchar, "plexId" integer, "plexToken" varchar, "permissions" integer NOT NULL DEFAULT (0), "avatar" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "password" varchar, "userType" integer NOT NULL DEFAULT (1), "plexUsername" varchar, "resetPasswordGuid" varchar, "recoveryLinkExpirationDate" date, "movieQuotaLimit" integer, "movieQuotaDays" integer, "tvQuotaLimit" integer, "tvQuotaDays" integer, "jellyfinUsername" varchar, "jellyfinAuthToken" varchar, "jellyfinUserId" varchar, "jellyfinDeviceId" varchar, "avatarETag" varchar, "avatarVersion" varchar, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `INSERT INTO "user"("id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion") SELECT "id", "email", "username", "plexId", "plexToken", "permissions", "avatar", "createdAt", "updatedAt", "password", "userType", "plexUsername", "resetPasswordGuid", "recoveryLinkExpirationDate", "movieQuotaLimit", "movieQuotaDays", "tvQuotaLimit", "tvQuotaDays", "jellyfinUsername", "jellyfinAuthToken", "jellyfinUserId", "jellyfinDeviceId", "avatarETag", "avatarVersion" FROM "temporary_user"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user"`);
    await queryRunner.query(`DROP TABLE "auth_user"`);
    await queryRunner.query(`DROP INDEX "auth_session_userId_idx"`);
    await queryRunner.query(`DROP TABLE "auth_session"`);
    await queryRunner.query(`DROP INDEX "auth_account_userId_idx"`);
    await queryRunner.query(`DROP TABLE "auth_account"`);
    await queryRunner.query(`DROP INDEX "oidc_account_userId_idx"`);
    await queryRunner.query(`DROP INDEX "oidc_account_issuer_sub_idx"`);
    await queryRunner.query(`DROP TABLE "oidc_account"`);
    await queryRunner.query(`DROP INDEX "verification_identifier_idx"`);
    await queryRunner.query(`DROP TABLE "verification"`);
    await queryRunner.query(
      `ALTER TABLE "user_push_subscription" RENAME TO "temporary_user_push_subscription"`
    );
    await queryRunner.query(
      `CREATE TABLE "user_push_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "endpoint" varchar NOT NULL, "p256dh" varchar NOT NULL, "auth" varchar NOT NULL, "userId" integer, "userAgent" varchar, "createdAt" datetime DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_6427d07d9a171a3a1ab87480005" UNIQUE ("endpoint", "userId"), CONSTRAINT "UQ_f90ab5a4ed54905a4bb51a7148b" UNIQUE ("auth"), CONSTRAINT "FK_03f7958328e311761b0de675fbe" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "user_push_subscription"("id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt") SELECT "id", "endpoint", "p256dh", "auth", "userId", "userAgent", "createdAt" FROM "temporary_user_push_subscription"`
    );
    await queryRunner.query(`DROP TABLE "temporary_user_push_subscription"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(`DROP INDEX "IDX_6bbafa28411e6046421991ea21"`);
    await queryRunner.query(
      `ALTER TABLE "blocklist" RENAME TO "temporary_blocklist"`
    );
    await queryRunner.query(
      `CREATE TABLE "blocklist" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "title" varchar, "tmdbId" integer NOT NULL, "blocklistedTags" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" integer, "mediaId" integer, CONSTRAINT "REL_62b7ade94540f9f8d8bede54b9" UNIQUE ("mediaId"), CONSTRAINT "UQ_6bbafa28411e6046421991ea21c" UNIQUE ("tmdbId"), CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `INSERT INTO "blocklist"("id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId") SELECT "id", "mediaType", "title", "tmdbId", "blocklistedTags", "createdAt", "userId", "mediaId" FROM "temporary_blocklist"`
    );
    await queryRunner.query(`DROP TABLE "temporary_blocklist"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId") `
    );
  }
}
