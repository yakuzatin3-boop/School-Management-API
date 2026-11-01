import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClassJoinCodes1793500800000
  implements MigrationInterface
{
  name = 'CreateClassJoinCodes1793500800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "class_join_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "class_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_join_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_class_join_codes_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_class_join_codes_class_id"
          FOREIGN KEY ("class_id") REFERENCES "classes"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_class_join_codes_created_by_user_id"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_class_join_codes_class_id"
        ON "class_join_codes" ("class_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_class_join_codes_created_by_user_id"
        ON "class_join_codes" ("created_by_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "public"."IDX_class_join_codes_created_by_user_id"
    `);

    await queryRunner.query(`
      DROP INDEX "public"."IDX_class_join_codes_class_id"
    `);

    await queryRunner.query(`
      DROP TABLE "class_join_codes"
    `);
  }
}
