import type { EntityManager } from '@mikro-orm/core';
import type { ITermsEntity } from '../entities/terms.entity.ts';
import { TermsContentEntitySchema } from '../entities/terms-content.entity.ts';
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import { e } from '../schemas/error.ts';
import type { MikroService } from './mikro.service.ts';
import type { SecurityService } from './security.service.ts';

export type AdminListQuery = {
  query?: string | undefined;
  page: number;
  pageSize: number;
  managedBy?: 'database' | 'config' | undefined;
  enabled?: boolean | undefined;
  direction?: 'asc' | 'desc' | undefined;
};

export type AdminClientLifecycleStatus = 'active' | 'inactive' | 'deleted';

export type AdminClientInput = {
  clientId: string;
  name: string;
  type: 'public' | 'confidential';
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
  grantTypes: string[];
  responseTypes: string[];
  scopes: string[];
  skipConsent: boolean;
};

export type AdminTermContentInput = {
  lang: 'ko' | 'en' | 'ja';
  title: string;
  type: 'link' | 'text';
  content: string;
};

export type AdminTermInput = {
  id: string;
  required: boolean;
  consentMode: 'explicit' | 'implicit';
  version: string;
  contents: AdminTermContentInput[];
};

function clientResponse(client: {
  id: string;
  clientId: string;
  clientSecretHash?: string | null | undefined;
  name: string;
  grantTypes: string[];
  responseTypes: string[];
  scopes: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  webOrigins: string[];
  enabled: boolean;
  deletedAt?: Date | null | undefined;
  skipConsent: boolean;
  managed_by: 'database' | 'config';
  created_at: Date;
  updated_at: Date;
}) {
  const type: 'public' | 'confidential' = client.clientSecretHash
    ? 'confidential'
    : 'public';
  return {
    id: client.id,
    client_id: client.clientId,
    name: client.name,
    type,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    scopes: client.scopes,
    redirect_uris: client.redirectUris,
    post_logout_redirect_uris: client.postLogoutRedirectUris,
    web_origins: client.webOrigins,
    enabled: client.enabled,
    deleted_at: client.deletedAt?.toISOString() ?? null,
    skip_consent: client.skipConsent,
    managed_by: client.managed_by,
    created_at: client.created_at.toISOString(),
    updated_at: client.updated_at.toISOString(),
  };
}

function termResponse(term: {
  id: string;
  required: boolean;
  consentMode: 'explicit' | 'implicit';
  version: string;
  managed_by: 'database' | 'config';
  archivedAt?: Date | null | undefined;
  created_at: Date;
  updated_at: Date;
  contents: {
    getItems(): Array<{
      lang: string;
      title: string;
      type: 'link' | 'text';
      content: string;
    }>;
  };
}) {
  return {
    id: term.id,
    required: term.required,
    consent_mode: term.consentMode,
    version: term.version,
    managed_by: term.managed_by,
    archived_at: term.archivedAt?.toISOString() ?? null,
    created_at: term.created_at.toISOString(),
    updated_at: term.updated_at.toISOString(),
    contents: term.contents.getItems().map((content) => ({
      lang: content.lang,
      title: content.title,
      type: content.type,
      content: content.content,
    })),
  };
}

export class AdminConsoleService {
  private readonly mikro: MikroService;
  private readonly securityService: SecurityService;
  private readonly config: IssuaryRuntimeConfig;

  public constructor(
    mikro: MikroService,
    securityService: SecurityService,
    config: IssuaryRuntimeConfig,
  ) {
    this.mikro = mikro;
    this.securityService = securityService;
    this.config = config;
  }

  public async overview() {
    const [
      activeUsers,
      admins,
      activeClients,
      requiredTerms,
      configUsers,
      databaseUsers,
    ] = await Promise.all([
      this.mikro.user.count({ deleted_at: null }),
      this.mikro.user.count({ deleted_at: null, role: 'admin' }),
      this.mikro.oauthClient.count({ enabled: true, deletedAt: null }),
      this.mikro.terms.count({ archivedAt: null, required: true }),
      this.mikro.user.count({ managed_by: 'config', deleted_at: null }),
      this.mikro.user.count({ managed_by: 'database', deleted_at: null }),
    ]);
    const verifiedUsers = await this.mikro.user.count({
      deleted_at: null,
      email_verified: true,
    });
    const twoFactorUsers = await this.mikro.user.count({
      deleted_at: null,
      totps: { verified: true, recovery_confirmed: true },
    });
    return {
      metrics: {
        active_users: activeUsers,
        admins,
        active_clients: activeClients,
        required_terms: requiredTerms,
      },
      users: {
        source: { config: configUsers, database: databaseUsers },
        authentication: {
          email_verified: verifiedUsers,
          two_factor: twoFactorUsers,
          remaining: Math.max(activeUsers - verifiedUsers, 0),
        },
      },
      status: {
        database: 'healthy',
        email: this.config.email ? 'configured' : 'disabled',
        password: this.config.auth.password.enabled,
        passkey: this.config.auth.passkey.enabled,
        totp: this.config.auth.password.totp.enabled,
      },
    };
  }

  public async listClients(
    params: AdminListQuery & {
      type?: 'public' | 'confidential' | undefined;
      lifecycleStatus?: AdminClientLifecycleStatus | undefined;
    },
  ) {
    const where: Record<string, unknown> =
      params.lifecycleStatus === 'deleted'
        ? { deletedAt: { $ne: null } }
        : { deletedAt: null };
    if (params.lifecycleStatus === 'active') where['enabled'] = true;
    if (params.lifecycleStatus === 'inactive') where['enabled'] = false;
    if (params.managedBy) where['managed_by'] = params.managedBy;
    if (params.enabled !== undefined) where['enabled'] = params.enabled;
    if (params.type === 'public') where['clientSecretHash'] = null;
    if (params.type === 'confidential')
      where['clientSecretHash'] = { $ne: null };
    const query = params.query?.trim();
    if (query) {
      where['$or'] = [
        { name: { $like: `%${query}%` } },
        { clientId: { $like: `%${query}%` } },
      ];
    }
    const [clients, total] = await this.mikro.oauthClient.findAndCount(where, {
      populate: ['clientSecretHash'],
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      orderBy: { name: params.direction ?? 'asc' },
    });
    return {
      clients: clients.map(clientResponse),
      pagination: { page: params.page, page_size: params.pageSize, total },
    };
  }

  public async createClient(input: AdminClientInput) {
    const existing = await this.mikro.oauthClient.findOne({
      clientId: input.clientId,
    });
    if (existing) {
      throw new e.OAuthClientAlreadyExists.Error();
    }
    const secret =
      input.type === 'confidential'
        ? `${crypto.randomUUID()}${crypto.randomUUID()}`
        : undefined;
    const client = this.mikro.oauthClient.create({
      clientId: input.clientId,
      clientSecretHash: secret
        ? await this.securityService.hashClientSecret(secret)
        : null,
      name: input.name,
      grantTypes: input.grantTypes,
      responseTypes: input.responseTypes,
      scopes: input.scopes,
      redirectUris: input.redirectUris,
      postLogoutRedirectUris: input.postLogoutRedirectUris,
      webOrigins: input.webOrigins,
      enabled: true,
      deletedAt: null,
      tokenEpoch: crypto.randomUUID(),
      skipConsent: input.skipConsent,
      managed_by: 'database',
    });
    await this.mikro.em.persist(client).flush();
    return { client: clientResponse(client), client_secret: secret };
  }

  public async updateClient(
    id: string,
    input: Omit<AdminClientInput, 'clientId' | 'type'>,
  ) {
    const client = await this.mikro.oauthClient.findOne(
      { id },
      { populate: ['clientSecretHash'] },
    );
    if (!client) return null;
    this.ensureClientEditable(client);
    client.name = input.name;
    client.redirectUris = input.redirectUris;
    client.postLogoutRedirectUris = input.postLogoutRedirectUris;
    client.webOrigins = input.webOrigins;
    client.grantTypes = input.grantTypes;
    client.responseTypes = input.responseTypes;
    client.scopes = input.scopes;
    client.skipConsent = input.skipConsent;
    await this.mikro.em.flush();
    return { client: clientResponse(client) };
  }

  public async rotateClientSecret(id: string) {
    const client = await this.mikro.oauthClient.findOne(
      { id },
      { populate: ['clientSecretHash'] },
    );
    if (!client) return null;
    this.ensureClientEditable(client);
    if (!client.clientSecretHash) return null;
    const secret = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    client.clientSecretHash =
      await this.securityService.hashClientSecret(secret);
    await this.mikro.em.flush();
    return { client: clientResponse(client), client_secret: secret };
  }

  public async setClientsEnabled(
    ids: string[] | undefined,
    filter: AdminListQuery | undefined,
    enabled: boolean,
  ) {
    if (ids) {
      const clients = await this.mikro.oauthClient.find({ id: { $in: ids } });
      for (const client of clients) this.ensureClientEditable(client);
      return this.applyStatus(
        clients,
        enabled,
        (client) => client.enabled,
        (client) => {
          client.enabled = enabled;
        },
      );
    }

    const where: Record<string, unknown> = {
      deletedAt: null,
      managed_by: 'database',
    };
    if (filter?.managedBy) where['managed_by'] = filter.managedBy;
    if (filter?.enabled !== undefined) where['enabled'] = filter.enabled;
    const query = filter?.query?.trim();
    if (query)
      where['$or'] = [
        { name: { $like: `%${query}%` } },
        { clientId: { $like: `%${query}%` } },
      ];
    const clients = await this.mikro.oauthClient.find(where);
    return this.applyStatus(
      clients,
      enabled,
      (client) => client.enabled,
      (client) => {
        client.enabled = enabled;
      },
    );
  }

  public async deleteClient(id: string) {
    const client = await this.mikro.oauthClient.findOne(
      { id },
      { populate: ['clientSecretHash'] },
    );
    if (!client) return null;
    if (client.managed_by === 'config') {
      throw new e.OAuthClientNotEditable.Error();
    }
    if (!client.deletedAt) {
      client.deletedAt = new Date();
      client.tokenEpoch = crypto.randomUUID();
      await this.mikro.em.flush();
    }
    return { client: clientResponse(client) };
  }

  public async restoreClient(id: string) {
    const client = await this.mikro.oauthClient.findOne(
      { id },
      { populate: ['clientSecretHash'] },
    );
    if (!client) return null;
    if (client.managed_by === 'config') {
      throw new e.OAuthClientNotEditable.Error();
    }
    if (client.deletedAt) {
      client.deletedAt = null;
      await this.mikro.em.flush();
    }
    return { client: clientResponse(client) };
  }

  public async listTerms(
    params: AdminListQuery & {
      required?: boolean | undefined;
      consentMode?: 'explicit' | 'implicit' | undefined;
      archived?: boolean | undefined;
    },
  ) {
    const where: Record<string, unknown> = {};
    if (params.managedBy) where['managed_by'] = params.managedBy;
    if (params.required !== undefined) where['required'] = params.required;
    if (params.consentMode) where['consentMode'] = params.consentMode;
    if (params.archived !== undefined)
      where['archivedAt'] = params.archived ? { $ne: null } : null;
    const query = params.query?.trim();
    if (query)
      where['$or'] = [
        { id: { $like: `%${query}%` } },
        { contents: { title: { $like: `%${query}%` } } },
      ];
    const [terms, total] = await this.mikro.terms.findAndCount(where, {
      populate: ['contents'],
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      orderBy: { id: params.direction ?? 'asc' },
    });
    return {
      terms: terms.map(termResponse),
      pagination: { page: params.page, page_size: params.pageSize, total },
    };
  }

  public async createTerm(input: AdminTermInput) {
    const term = this.mikro.terms.create({
      id: input.id,
      required: input.required,
      consentMode: input.consentMode,
      version: input.version,
      managed_by: 'database',
      archivedAt: null,
    });
    this.replaceTermContents(this.mikro.em, term, input.contents);
    await this.mikro.em.persist(term).flush();
    return { term: termResponse(term) };
  }

  public async updateTerm(id: string, input: Omit<AdminTermInput, 'id'>) {
    const term = await this.mikro.terms.findOne(
      { id },
      { populate: ['contents'] },
    );
    if (!term || term.managed_by === 'config') return null;
    term.required = input.required;
    term.consentMode = input.consentMode;
    term.version = input.version;
    for (const content of term.contents.getItems())
      this.mikro.em.remove(content);
    term.contents.removeAll();
    this.replaceTermContents(this.mikro.em, term, input.contents);
    await this.mikro.em.flush();
    return { term: termResponse(term) };
  }

  public async setTermsArchived(
    ids: string[] | undefined,
    filter: AdminListQuery | undefined,
    archived: boolean,
  ) {
    const where: Record<string, unknown> = ids ? { id: { $in: ids } } : {};
    if (filter?.managedBy) where['managed_by'] = filter.managedBy;
    const query = filter?.query?.trim();
    if (query) where['id'] = { $like: `%${query}%` };
    const terms = await this.mikro.terms.find(where);
    return this.applyStatus(
      terms,
      archived,
      (term) => Boolean(term.archivedAt),
      (term) => {
        term.archivedAt = archived ? new Date() : null;
      },
    );
  }

  public async search(query: string) {
    const value = `%${query.trim()}%`;
    const [users, clients, terms] = await Promise.all([
      this.mikro.user.find(
        { $or: [{ email: { $like: value } }, { sub: { $like: value } }] },
        { limit: 5 },
      ),
      this.mikro.oauthClient.find(
        {
          deletedAt: null,
          $or: [{ name: { $like: value } }, { clientId: { $like: value } }],
        },
        { limit: 5, populate: ['clientSecretHash'] },
      ),
      this.mikro.terms.find(
        {
          $or: [
            { id: { $like: value } },
            { contents: { title: { $like: value } } },
          ],
        },
        { limit: 5, populate: ['contents'] },
      ),
    ]);
    return {
      users: users.map((user) => ({
        id: user.sub,
        title: user.email,
        subtitle: user.sub,
      })),
      clients: clients.map((client) => ({
        id: client.id,
        title: client.name,
        subtitle: client.clientId,
      })),
      terms: terms.map((term) => ({
        id: term.id,
        title: term.contents.getItems()[0]?.title ?? term.id,
        subtitle: term.version,
      })),
    };
  }

  public system() {
    const config = this.config;
    return {
      health: {
        database: 'healthy',
        email: config.email ? 'configured' : 'disabled',
      },
      sections: [
        {
          id: 'authentication',
          values: {
            password_enabled: config.auth.password.enabled,
            passkey_enabled: config.auth.passkey.enabled,
            totp_enabled: config.auth.password.totp.enabled,
          },
        },
        {
          id: 'registration',
          values: {
            enabled: config.registration.enabled,
            email_verification_required:
              config.registration.email_verification_required,
            allowed_email_patterns: config.registration.allowed_email_patterns,
          },
        },
        {
          id: 'password',
          values: {
            min_length: config.auth.password.policy.min_length,
            max_length: config.auth.password.policy.max_length,
            two_factor_required:
              config.auth.password.two_factor.enrollment_required,
          },
        },
        {
          id: 'tokens',
          values: {
            access_token_ttl: config.tokens.access_token_ttl,
            refresh_token_ttl: config.tokens.refresh_token_ttl,
            key_rotation_enabled: config.tokens.key_rotation.enabled,
          },
        },
        {
          id: 'identityProviders',
          values: {
            configured: config.identity_providers.map(
              (provider) => provider.display_name,
            ),
          },
        },
        {
          id: 'cleanup',
          values: {
            account_deletion_enabled: config.account_deletion.enabled,
            account_deletion_retention: config.account_deletion.retention,
          },
        },
        {
          id: 'languages',
          values: {
            supported: config.i18n.supported_languages,
            default: config.i18n.default_language,
            fallback: config.i18n.fallback_language,
          },
        },
      ],
    };
  }

  private replaceTermContents(
    em: EntityManager,
    term: ITermsEntity,
    contents: AdminTermContentInput[],
  ) {
    for (const input of contents) {
      const content = em.create(TermsContentEntitySchema, {
        terms: term,
        lang: input.lang,
        title: input.title,
        type: input.type,
        content: input.content,
      });
      term.contents.add(content);
    }
  }

  private async applyStatus<T extends { managed_by: 'database' | 'config' }>(
    items: T[],
    desired: boolean,
    current: (item: T) => boolean,
    change: (item: T) => void,
  ) {
    const skipped: Record<string, number> = {};
    let changed = 0;
    for (const item of items) {
      let reason: string | undefined;
      if (item.managed_by === 'config') reason = 'config';
      else if (current(item) === desired) reason = 'unchanged';
      if (reason) {
        skipped[reason] = (skipped[reason] ?? 0) + 1;
        continue;
      }
      change(item);
      changed += 1;
    }
    await this.mikro.em.flush();
    return { matched: items.length, changed, skipped };
  }

  private ensureClientEditable(client: {
    managed_by: 'database' | 'config';
    deletedAt?: Date | null | undefined;
  }): void {
    if (client.managed_by === 'config') {
      throw new e.OAuthClientNotEditable.Error();
    }
    if (client.deletedAt) {
      throw new e.OAuthClientDeleted.Error();
    }
  }
}
