import { RequestContext } from '@mikro-orm/core';
import { z } from 'zod';
import { BackgroundJobEntitySchema } from '../entities/background-job.entity.js';
import { DatabaseBackgroundJobStore } from '../entrypoints/scheduler/database.js';
import {
  DistributedBackgroundJobRunner,
  PermanentBackgroundJobError,
} from '../entrypoints/scheduler/distributed-runner.js';
import type {
  IssuaryRuntimeConfig,
  SchedulerHandle,
} from '../lib/config/index.js';
import type { Locale } from '../lib/locale.js';
import type { Logger } from '../lib/logger.js';
import { e } from '../schemas/error.js';
import type { EmailService } from './email.service.js';
import type { MikroService } from './mikro.service.js';
import type { SecurityService } from './security.service.js';
import { withUserSecurity } from './user-security.service.js';

const JOB_ID = 'security.mail';
const Envelope = z.object({ id: z.uuid(), sealed: z.string() });
const MailRequest = z.object({
  kind: z.enum(['verification', 'password-reset']),
  email: z.email(),
  requestedAt: z.number(),
  locale: z.enum(['ko', 'en', 'ja']).optional(),
  userSub: z.string().optional(),
  token: z.string().optional(),
  userEpoch: z.string().optional(),
});

export class MailQueueService {
  private readonly instanceId = `mail:${crypto.randomUUID()}`;
  private runner: DistributedBackgroundJobRunner | undefined;
  private handle: SchedulerHandle | undefined;
  private readonly config: IssuaryRuntimeConfig;
  private readonly mikro: MikroService;
  private readonly emailService: EmailService;
  private readonly security: SecurityService;
  private readonly logger: Logger;
  constructor(
    config: IssuaryRuntimeConfig,
    mikro: MikroService,
    emailService: EmailService,
    security: SecurityService,
    logger: Logger,
  ) {
    this.config = config;
    this.mikro = mikro;
    this.emailService = emailService;
    this.security = security;
    this.logger = logger;
  }

  start(): void {
    if (!this.config.email || this.handle) return;
    this.runner = new DistributedBackgroundJobRunner({
      name: 'Security mail',
      pollIntervalMs: 5000,
      lockTtlMs: 60000,
      retryDelayMs: 1000,
      maxAttempts: 3,
      retentionMs: 604800000,
      instanceId: this.instanceId,
      logger: this.logger,
      store: new DatabaseBackgroundJobStore(this.mikro, [JOB_ID], true),
      jobs: [
        {
          id: JOB_ID,
          name: 'Authentication email',
          handler: (payload, context) =>
            RequestContext.create(this.mikro.orm.em, () =>
              this.process(payload, context.signal),
            ),
        },
      ],
    });
    this.handle = this.runner.start();
  }
  async stop(): Promise<void> {
    await this.handle?.stop();
    this.handle = undefined;
  }
  /** Explicit drain for embedded workers and deterministic tests; no polling sleeps. */
  async runPending(): Promise<void> {
    await this.runner?.runPending();
  }

  async enqueue(
    kind: 'verification' | 'password-reset',
    email: string,
    locale?: Locale,
    userSub?: string,
  ): Promise<string> {
    if (!this.config.email) throw new e.EmailNotActivated.Error();
    const now = new Date();
    const id = crypto.randomUUID();
    const sealed = await this.security.sealMailPayload(
      JSON.stringify({
        kind,
        email,
        locale,
        userSub,
        requestedAt: now.getTime(),
      }),
    );
    // Use the request's transaction, unlike a detached scheduler enqueue.
    await this.mikro.em.insert(BackgroundJobEntitySchema, {
      id,
      jobId: JOB_ID,
      payload: JSON.stringify({ id, sealed }),
      status: 'pending',
      availableAt: now,
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      maxAttempts: 3,
      lastError: null,
      completedAt: null,
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  private async process(payload: unknown, signal?: AbortSignal): Promise<void> {
    const envelope = Envelope.safeParse(payload);
    if (!envelope.success) throw new Error('MAIL_PAYLOAD_INVALID');
    const jobId = envelope.data.id;
    try {
      const clear = await this.security.openMailPayload(envelope.data.sealed);
      if (!clear) throw new Error('MAIL_PAYLOAD_INVALID');
      const request = MailRequest.parse(JSON.parse(clear));
      const candidate = await this.mikro.user.findOne({
        email: request.email,
        deleted_at: null,
      });
      if (
        !candidate ||
        candidate.created_at.getTime() > request.requestedAt ||
        (!request.userSub &&
          candidate.created_at.getTime() === request.requestedAt) ||
        (!request.token &&
          candidate.updated_at.getTime() > request.requestedAt) ||
        (!request.userSub &&
          candidate.updated_at.getTime() === request.requestedAt) ||
        (request.userSub && request.userSub !== candidate.sub)
      )
        return;
      const prepared = await withUserSecurity(
        this.mikro,
        candidate.sub,
        async (user) => {
          if (
            user.email !== request.email ||
            (!request.token &&
              user.updated_at.getTime() > request.requestedAt) ||
            (request.token && request.userEpoch !== user.token_epoch) ||
            (!request.userSub &&
              user.updated_at.getTime() === request.requestedAt)
          )
            return null;
          if (
            request.kind === 'verification'
              ? user.email_verified
              : user.managed_by !== 'database'
          )
            return null;
          if (!request.token && Date.now() - request.requestedAt > 3600000)
            return null;
          let token = request.token;
          if (!token) {
            const generated =
              request.kind === 'verification'
                ? await this.mikro.emailVerification.generateToken({
                    userSub: user.sub,
                    userEpoch: user.token_epoch,
                  })
                : await this.mikro.passwordReset.generateToken({
                    userSub: user.sub,
                    userEpoch: user.token_epoch,
                  });
            token = generated.token;
            await this.mikro.em.flush();
            const sealed = await this.security.sealMailPayload(
              JSON.stringify({
                ...request,
                userSub: user.sub,
                userEpoch: user.token_epoch,
                token,
              }),
            );
            const updated = await this.mikro.em.nativeUpdate(
              BackgroundJobEntitySchema,
              {
                id: jobId,
                lockedBy: this.instanceId,
                status: 'running',
                lockedUntil: { $gt: new Date() },
              },
              { payload: JSON.stringify({ id: jobId, sealed }) },
            );
            if (updated !== 1) throw new Error('MAIL_LEASE_LOST');
          }
          const active =
            request.kind === 'verification'
              ? await this.mikro.emailVerification.count({
                  user: user.sub,
                  user_epoch: user.token_epoch,
                  token,
                  verified: false,
                  revoked_at: null,
                  expiresAt: { $gt: new Date() },
                })
              : await this.mikro.passwordReset.count({
                  user: user.sub,
                  user_epoch: user.token_epoch,
                  token,
                  used: false,
                  revoked_at: null,
                  expiresAt: { $gt: new Date() },
                });
          return active === 1
            ? {
                token,
                email: user.email,
                locale: request.locale,
                messageId: `<${jobId}@${new URL(this.config.server.public_origin).hostname}>`,
              }
            : null;
        },
      );
      if (!prepared || signal?.aborted) return;
      const lease = await this.mikro.backgroundJob.count({
        id: jobId,
        lockedBy: this.instanceId,
        status: 'running',
        lockedUntil: { $gt: new Date() },
      });
      if (lease !== 1) return;
      this.logger.info(
        {
          jobId,
          state: 'sending',
          queueAgeMs: Date.now() - request.requestedAt,
        },
        'Authentication mail',
      );
      if (request.kind === 'verification')
        await this.emailService.sendVerificationEmail(prepared);
      else await this.emailService.sendPasswordResetEmail(prepared);
    } catch (error) {
      const responseCode: unknown =
        error instanceof Error ? Reflect.get(error, 'responseCode') : undefined;
      const permanent =
        typeof responseCode === 'number' &&
        responseCode >= 500 &&
        responseCode < 600;
      const code = permanent
        ? 'MAIL_PERMANENT_FAILURE'
        : 'MAIL_DELIVERY_FAILED';
      this.logger.warn({ jobId, code }, 'Authentication mail failed');
      if (permanent) throw new PermanentBackgroundJobError(code);
      throw new Error(code);
    }
  }
}
