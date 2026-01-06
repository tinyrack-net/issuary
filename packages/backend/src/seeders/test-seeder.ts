import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { UserEntity } from '@/entities/user.entity.js';

export class TestSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    em.create(UserEntity, {
      id: '1',
      email: 'sample@example.com',
      password_hash: 'hashedpassword123',
      email_verified: true,
      editable: false,
    });
  }
}
