import type { EntityManager } from '@mikro-orm/core';
import { BrowserSessionEntitySchema } from '../entities/browser-session.entity.js';
import { UserEntity } from '../entities/user.entity.js';
import type { SessionData } from '../middleware/session.js';

export interface StoredSession {
  id: string;
  data: SessionData;
  revision: number;
  expires_at: Date;
}

export interface SessionStore {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
  load(id: string): Promise<StoredSession | null>;
  save(
    session: StoredSession,
    isNew: boolean,
    previous?: Pick<StoredSession, 'id' | 'revision'>,
  ): Promise<boolean>;
  remove(id: string): Promise<void>;
}

/** All state is authoritative in the database; cookies contain only a locator. */
export class BrowserSessionService implements SessionStore {
  private readonly em: EntityManager;
  constructor(em: EntityManager) {
    this.em = em;
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.em.transactional(operation);
  }

  async load(id: string): Promise<StoredSession | null> {
    const record = await this.em.findOne(BrowserSessionEntitySchema, {
      id,
      expires_at: { $gt: new Date() },
    });
    if (!record) return null;
    const session = { ...record, data: structuredClone(record.data) };
    const original = JSON.stringify(session.data);
    await this.pruneInvalidSubjects(session.data);
    if (JSON.stringify(session.data) !== original) {
      const changed = await this.em.nativeUpdate(
        BrowserSessionEntitySchema,
        { id, revision: session.revision },
        { data: session.data, revision: session.revision + 1 },
      );
      if (changed !== 1) return null;
      session.revision += 1;
    }
    return session;
  }

  private async pruneInvalidSubjects(data: SessionData): Promise<void> {
    const grants = data.security?.grants ?? {};
    const subjects = Object.keys(grants);
    const users = subjects.length
      ? await this.em.find(
          UserEntity,
          { sub: { $in: subjects } },
          { refresh: true },
        )
      : [];
    const validSubjects = new Set(
      users
        .filter((user) => {
          const issued = grants[user.sub];
          return (
            issued !== undefined &&
            !user.deleted_at &&
            issued === user.token_epoch
          );
        })
        .map((user) => user.sub),
    );
    if (data.user && !validSubjects.has(data.user.sub)) delete data.user;
    if (data.pending2FAUser && !validSubjects.has(data.pending2FAUser.sub)) {
      delete data.pending2FAUser;
      delete data.passkey_challenge;
    }
    if (data.pending2FASetup && !validSubjects.has(data.pending2FASetup.sub)) {
      delete data.pending2FASetup;
      delete data.passkey_challenge;
    }
    if (
      data.reauthentication?.sub &&
      !validSubjects.has(data.reauthentication.sub)
    )
      delete data.reauthentication;
    if (data.accounts)
      data.accounts = data.accounts.filter((account) =>
        validSubjects.has(account.sub),
      );
    if (data.accountSelection)
      data.accountSelection.allowed_subs =
        data.accountSelection.allowed_subs.filter((sub) =>
          validSubjects.has(sub),
        );
  }

  async save(
    session: StoredSession,
    isNew: boolean,
    previous?: Pick<StoredSession, 'id' | 'revision'>,
  ): Promise<boolean> {
    const before = JSON.stringify([
      session.data.user,
      session.data.pending2FAUser,
      session.data.pending2FASetup,
    ]);
    await this.pruneInvalidSubjects(session.data);
    // A password reset/deletion during this request must not issue a session.
    if (
      before !==
      JSON.stringify([
        session.data.user,
        session.data.pending2FAUser,
        session.data.pending2FASetup,
      ])
    )
      return false;
    if (previous) {
      return this.em.transactional(async (em) => {
        const removed = await em.nativeDelete(
          BrowserSessionEntitySchema,
          previous,
        );
        if (removed !== 1) return false;
        await em.insert(BrowserSessionEntitySchema, session);
        return true;
      });
    }
    if (isNew) {
      await this.em.insert(BrowserSessionEntitySchema, session);
      return true;
    }
    const changed = await this.em.nativeUpdate(
      BrowserSessionEntitySchema,
      {
        id: session.id,
        revision: session.revision,
        expires_at: { $gt: new Date() },
      },
      { data: session.data, revision: session.revision + 1 },
    );
    return changed === 1;
  }

  async remove(id: string): Promise<void> {
    await this.em.nativeDelete(BrowserSessionEntitySchema, { id });
  }
}
