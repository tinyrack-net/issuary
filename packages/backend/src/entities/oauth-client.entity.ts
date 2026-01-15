import {
  Entity,
  EntityRepositoryType,
  Index,
  type Opt,
  PrimaryKey,
  Property,
  t,
} from '@mikro-orm/core';
import { OAuthClientRepository } from '@/repositories/oauth-client.repository.js';
import { BaseEntity } from './base.entity.js';

@Entity({
  tableName: 'oauth_client',
  comment: 'Registered OAuth clients',
  repository: () => OAuthClientRepository,
})
export class OAuthClientEntity extends BaseEntity {
  [EntityRepositoryType]?: OAuthClientRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string;

  @Index({
    name: 'client_client_id_unique',
    properties: ['clientId'],
    options: { unique: true },
  })
  @Property({
    type: t.string,
    name: 'client_id',
    comment: 'Public client identifier',
    nullable: false,
  })
  public clientId: string;

  @Property({
    type: t.string,
    name: 'client_secret_hash',
    comment: 'Hash of the client secret (null for public clients using PKCE)',
    nullable: true,
    lazy: true,
    hidden: true,
  })
  public clientSecretHash: string | null = null;

  @Property({
    type: t.string,
    name: 'name',
    comment: 'Human-readable name of the OAuth client',
    nullable: false,
  })
  public name: string;

  @Property({
    type: t.json,
    name: 'grant_types',
    comment: 'Allowed OAuth grant types for the client',
    nullable: false,
    default: [],
  })
  public grantTypes: string[] = [];

  @Property({
    type: t.json,
    name: 'response_types',
    comment: 'Allowed OAuth response types for the client',
    nullable: false,
    default: [],
  })
  public responseTypes: string[] = [];

  @Property({
    type: t.json,
    name: 'scopes',
    comment: 'Allowed OAuth scopes for the client',
    nullable: false,
    default: [],
  })
  public scopes: string[] = [];

  @Property({
    type: t.json,
    name: 'redirect_uris',
    comment: 'Registered redirect URIs for the client',
    nullable: false,
    default: [],
  })
  public redirectUris: string[] = [];

  @Property({
    type: t.boolean,
    name: 'enabled',
    comment: 'Whether the OAuth client is enabled',
    default: true,
  })
  public enabled = true;

  @Property({
    type: t.string,
    name: 'managed_by',
    comment: 'Data source: config (from YAML) or database (runtime created)',
    nullable: false,
    default: 'database',
  })
  public managed_by: Opt<'config' | 'database'> = 'database';

  @Property({
    type: t.string,
    name: 'logo_uri',
    comment: 'Logo URI for the OAuth client',
    nullable: true,
    default: null,
  })
  public logoUri: string | null = null;

  public constructor(params: {
    id?: string;
    clientId: string;
    clientSecretHash?: string | null;
    name: string;
  }) {
    super();
    this.id = params.id ?? crypto.randomUUID();
    this.clientId = params.clientId;
    this.clientSecretHash = params.clientSecretHash ?? null;
    this.name = params.name;
  }
}
