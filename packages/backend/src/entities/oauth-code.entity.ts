import {
  Entity,
  EntityRepositoryType,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  type Ref,
  ref,
  t,
} from '@mikro-orm/core';
import { OAuthCodeRepository } from '@/repositories/oauth-code.repository.js';
import { BaseEntity } from './base.entity.js';
import { OAuthClientEntity } from './oauth-client.entity.js';
import { UserEntity } from './user.entity.js';

export const OAUTH_CODE_CHALLENGE_METHOD = {
  S256: 'S256',
  plain: 'plain',
} as const;

export type OAuthCodeChallengeMethods =
  (typeof OAUTH_CODE_CHALLENGE_METHOD)[keyof typeof OAUTH_CODE_CHALLENGE_METHOD];

@Entity({
  tableName: 'oauth_code',
  comment: 'Issued OAuth authorization codes',
  repository: () => OAuthCodeRepository,
})
@Index({
  properties: ['client', 'consumedAt'],
  name: 'oauth_code_client_consumed_idx',
})
@Index({
  properties: ['expiredAt'],
  name: 'oauth_code_expired_at_idx',
})
export class OAuthCodeEntity extends BaseEntity {
  [EntityRepositoryType]?: OAuthCodeRepository;

  @PrimaryKey({
    type: t.uuid,
    name: 'id',
    comment: 'Primary key as UUID',
    nullable: false,
  })
  public id: string = crypto.randomUUID();

  @Index({
    name: 'auth_code_hash_idx',
    properties: ['codeHash'],
  })
  @Property({
    type: t.string,
    name: 'code_hash',
    comment: 'Hash of the issued authorization code',
    nullable: false,
    unique: true,
  })
  public codeHash: string;

  @ManyToOne({
    entity: () => OAuthClientEntity,
    name: 'oauth_client_id',
    comment: 'Reference to the OAuth client that requested the code',
    nullable: false,
    ref: true,
  })
  public client: Ref<OAuthClientEntity>;

  @ManyToOne({
    entity: () => UserEntity,
    name: 'user_id',
    comment: 'Reference to the resource owner (user)',
    nullable: false,
    ref: true,
  })
  public user: Ref<UserEntity>;

  @Property({
    type: t.string,
    name: 'redirect_uri',
    comment: 'Redirect URI used during the authorization request',
    nullable: true,
  })
  public redirectUri: string;

  @Property({
    type: t.json,
    name: 'scope',
    comment: 'Scopes granted by the authorization code',
    nullable: false,
    default: [],
  })
  public scope: string[] = [];

  @Property({
    type: t.string,
    name: 'nonce',
    comment: 'Nonce value associated with the authorization request',
    nullable: false,
  })
  public nonce: string;

  @Property({
    type: t.string,
    name: 'code_challenge',
    comment: 'PKCE code challenge value',
    nullable: false,
  })
  public codeChallenge: string;

  @Enum({
    type: t.enum,
    items: () => OAUTH_CODE_CHALLENGE_METHOD,
    name: 'code_challenge_method',
    comment: 'PKCE code challenge method',
    nullable: false,
    default: OAUTH_CODE_CHALLENGE_METHOD.S256,
  })
  public codeChallengeMethod: OAuthCodeChallengeMethods = 'S256';

  @Property({
    type: t.datetime,
    name: 'expired_at',
    comment: 'Absolute expiry timestamp for the code',
    nullable: false,
  })
  public expiredAt: Date;

  @Property({
    type: t.datetime,
    name: 'consumed_at',
    comment: 'Timestamp when the code was redeemed',
    nullable: true,
  })
  public consumedAt?: Date;

  /**
   * OIDC Authentication Metadata
   * These fields store authentication context from the user's session
   * to be included in the ID Token when the code is exchanged.
   */

  @Property({
    type: t.integer,
    name: 'auth_time',
    comment:
      'Time when the End-User authentication occurred (Unix timestamp). Used for auth_time claim in ID Token (OIDC Core 1.0 §2)',
    nullable: true,
  })
  public authTime?: number;

  public constructor(params: {
    clientId: string;
    userId: string;
    codeHash: string;
    redirectUri: string;
    scope: string[];
    nonce: string;
    codeChallenge: string;
    codeChallengeMethod: OAuthCodeChallengeMethods;
    expiredAt: Date;
    /** OIDC: Time when End-User authentication occurred (Unix timestamp) */
    authTime?: number;
  }) {
    super();
    this.client = ref(OAuthClientEntity, params.clientId);
    this.user = ref(UserEntity, params.userId);
    this.codeHash = params.codeHash;
    this.redirectUri = params.redirectUri;
    this.scope = params.scope;
    this.nonce = params.nonce;
    this.codeChallenge = params.codeChallenge;
    this.codeChallengeMethod = params.codeChallengeMethod;
    this.expiredAt = params.expiredAt;
    // Only assign OIDC auth metadata when defined (exactOptionalPropertyTypes)
    if (params.authTime !== undefined) {
      this.authTime = params.authTime;
    }
  }
}
