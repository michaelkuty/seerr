import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOidcAccountTable1771296552013 implements MigrationInterface {
  name = 'AddOidcAccountTable1771296552013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6bbafa28411e6046421991ea21"`
    );
    await queryRunner.query(
      `CREATE TABLE "verification" ("id" character varying NOT NULL, "identifier" character varying NOT NULL, "value" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_f7e3a90ca384e71d6e2e93bb340" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier") `
    );
    await queryRunner.query(
      `CREATE TABLE "oidc_account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "issuer" character varying NOT NULL, "sub" character varying NOT NULL, "access_token" character varying, "refresh_token" character varying, "id_token" character varying, "access_token_expires_at" TIMESTAMP WITH TIME ZONE, "refresh_token_expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_441621cc59f8291628cb9342c79" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_issuer_sub_idx" ON "oidc_account" ("issuer", "sub") `
    );
    await queryRunner.query(
      `CREATE INDEX "oidc_account_userId_idx" ON "oidc_account" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_account" ("id" character varying NOT NULL, "account_id" character varying NOT NULL, "provider_id" character varying NOT NULL, "user_id" character varying NOT NULL, "access_token" character varying, "refresh_token" character varying, "id_token" character varying, "access_token_expires_at" TIMESTAMP WITH TIME ZONE, "refresh_token_expires_at" TIMESTAMP WITH TIME ZONE, "scope" character varying, "password" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_785427223fe40c51673bf49526d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_account_userId_idx" ON "auth_account" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_session" ("id" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "token" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ip_address" character varying, "user_agent" character varying, "user_id" character varying NOT NULL, CONSTRAINT "UQ_62cb09e1129f6ec024ef66e1832" UNIQUE ("token"), CONSTRAINT "PK_19354ed146424a728c1112a8cbf" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "auth_session_userId_idx" ON "auth_session" ("user_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "auth_user" ("id" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "email_verified" boolean NOT NULL DEFAULT false, "image" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_3d29d788cd69d1ddf87e88e01eb" UNIQUE ("email"), CONSTRAINT "PK_9922406dc7d70e20423aeffadf3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "oidcSub" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "oidcIssuer" character varying`
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "oidcClaims" text`);
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "blocklist_id_seq" OWNED BY "blocklist"."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('"blocklist_id_seq"')`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_09b94c932e84635c5461f3c0a9" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_356721a49f145aa439c16e6b999" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_account" ADD CONSTRAINT "FK_4e03cf3568a9d7ff93292f07ee5" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "auth_account" ADD CONSTRAINT "FK_05f7ed7b1d8115a247886b2ee06" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "auth_session" ADD CONSTRAINT "FK_b8783d517fab10672700a39cb49" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_session" DROP CONSTRAINT "FK_b8783d517fab10672700a39cb49"`
    );
    await queryRunner.query(
      `ALTER TABLE "auth_account" DROP CONSTRAINT "FK_05f7ed7b1d8115a247886b2ee06"`
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_account" DROP CONSTRAINT "FK_4e03cf3568a9d7ff93292f07ee5"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_5c8af2d0e83b3be6d250eccc19d"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" DROP CONSTRAINT "FK_356721a49f145aa439c16e6b999"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09b94c932e84635c5461f3c0a9"`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" SET DEFAULT nextval('blacklist_id_seq')`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`DROP SEQUENCE "blocklist_id_seq"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "oidcClaims"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "oidcIssuer"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "oidcSub"`);
    await queryRunner.query(`DROP TABLE "auth_user"`);
    await queryRunner.query(`DROP INDEX "public"."auth_session_userId_idx"`);
    await queryRunner.query(`DROP TABLE "auth_session"`);
    await queryRunner.query(`DROP INDEX "public"."auth_account_userId_idx"`);
    await queryRunner.query(`DROP TABLE "auth_account"`);
    await queryRunner.query(`DROP INDEX "public"."oidc_account_userId_idx"`);
    await queryRunner.query(
      `DROP INDEX "public"."oidc_account_issuer_sub_idx"`
    );
    await queryRunner.query(`DROP TABLE "oidc_account"`);
    await queryRunner.query(
      `DROP INDEX "public"."verification_identifier_idx"`
    );
    await queryRunner.query(`DROP TABLE "verification"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbafa28411e6046421991ea21" ON "blocklist" ("tmdbId") `
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_62b7ade94540f9f8d8bede54b99" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "blocklist" ADD CONSTRAINT "FK_53c1ab62c3e5875bc3ac474823e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
