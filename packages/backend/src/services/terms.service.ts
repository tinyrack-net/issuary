import type { Loaded } from '@mikro-orm/core';
import fastifyPlugin from 'fastify-plugin';
import type { TermsEntity } from '@/entities/terms.entity.js';
import type { UserTermsConsentEntity } from '@/entities/user-terms-consent.entity.js';
import type { InternalAppConfig } from '@/lib/config/schemas/root.js';
import type { MikroService } from '@/plugins/mikro-orm.js';

declare module 'fastify' {
  interface FastifyInstance {
    termsService: TermsService;
  }
}

/**
 * User consent status for a specific term
 */
export interface TermsUserConsent {
  agreed: boolean;
  agreedVersion: string | null;
  agreedAt: Date | null;
  consentType: 'explicit' | 'implicit' | null;
  requiresUpdate: boolean;
}

/**
 * Content type for terms content
 */
export type TermsContentType = 'link' | 'text';

/**
 * Localized term content for a specific language
 */
export interface LocalizedTermContent {
  title: string;
  type: TermsContentType;
  content: string;
}

/**
 * Term item localized to a specific language
 */
export interface LocalizedTermItem {
  id: string;
  required: boolean;
  consentMode: 'explicit' | 'implicit';
  version: string;
  title: string;
  type: TermsContentType;
  content: string;
  userConsent: TermsUserConsent | null;
}

export class TermsService {
  public constructor(
    private readonly mikro: MikroService,
    private readonly config: InternalAppConfig,
  ) {}

  /**
   * Get all global terms from database
   */
  public async getGlobalTerms(): Promise<
    Loaded<TermsEntity, 'contents', '*', never>[]
  > {
    return this.mikro.terms.findAllWithContents();
  }

  /**
   * Check if any terms have implicit consent mode
   */
  public async hasImplicitTerms(): Promise<boolean> {
    const terms = await this.getGlobalTerms();
    return terms.some((t) => t.consentMode === 'implicit');
  }

  /**
   * Get implicit notice for a specific language
   */
  public getImplicitNotice(lang: string): string | null {
    const notice = this.config.terms.implicit_notice;
    if (!notice) {
      return null;
    }
    return notice[lang] ?? notice['en'] ?? null;
  }

  /**
   * Get localized content for a term from its contents collection
   */
  public getLocalizedContent(
    term: Loaded<TermsEntity, 'contents', '*', never>,
    lang: string,
  ): LocalizedTermContent | null {
    const contents = term.contents.getItems();
    const content = contents.find((c) => c.lang === lang);
    const fallback = contents.find((c) => c.lang === 'en');
    const result = content ?? fallback;

    if (!result) {
      return null;
    }

    return {
      title: result.title,
      type: result.type,
      content: result.content,
    };
  }

  /**
   * Get global terms with user consent status
   */
  public async getGlobalTermsWithConsent(
    userId: string | null,
    lang: string,
  ): Promise<LocalizedTermItem[]> {
    const terms = await this.getGlobalTerms();

    let consentsMap = new Map<string, UserTermsConsentEntity>();
    if (userId) {
      consentsMap =
        await this.mikro.userTermsConsent.findLatestConsentsMap(userId);
    }

    return terms.map((term) => {
      const content = this.getLocalizedContent(term, lang);
      const consent = consentsMap.get(term.id);

      let userConsent: TermsUserConsent | null = null;
      if (consent) {
        userConsent = {
          agreed: consent.agreed,
          agreedVersion: consent.termsVersion,
          agreedAt: consent.agreedAt,
          consentType: consent.consentType,
          requiresUpdate: consent.termsVersion !== term.version,
        };
      }

      return {
        id: term.id,
        required: term.required,
        consentMode: term.consentMode,
        version: term.version,
        title: content?.title ?? term.id,
        type: content?.type ?? 'link',
        content: content?.content ?? '',
        userConsent,
      };
    });
  }

  /**
   * Check if user needs to consent to any required terms
   * Returns list of term IDs that need consent
   */
  public async getPendingRequiredTerms(userId: string): Promise<string[]> {
    const terms = await this.getGlobalTerms();
    const consentsMap =
      await this.mikro.userTermsConsent.findLatestConsentsMap(userId);

    const pending: string[] = [];

    for (const term of terms) {
      if (!term.required) {
        continue;
      }

      const consent = consentsMap.get(term.id);
      if (!consent) {
        pending.push(term.id);
        continue;
      }

      // Check if version matches
      if (consent.termsVersion !== term.version) {
        pending.push(term.id);
      }
    }

    return pending;
  }

  /**
   * Check if user has any pending required terms
   */
  public async hasPendingRequiredTerms(userId: string): Promise<boolean> {
    const pending = await this.getPendingRequiredTerms(userId);
    return pending.length > 0;
  }

  /**
   * Record consent for multiple terms
   * consentType is determined by each term's consentMode
   */
  public async recordConsents(params: {
    userId: string;
    consents: Array<{
      termsId: string;
      agreed: boolean;
    }>;
    consentType?: 'explicit' | 'implicit';
  }): Promise<UserTermsConsentEntity[]> {
    const terms = await this.getGlobalTerms();
    const termsMap = new Map(terms.map((t) => [t.id, t]));

    const records = params.consents
      .map((consent) => {
        const term = termsMap.get(consent.termsId);
        if (!term) {
          return null;
        }

        return {
          userId: params.userId,
          termsId: consent.termsId,
          termsVersion: term.version,
          agreed: consent.agreed,
          // Use provided consentType or derive from term's consentMode
          consentType: params.consentType ?? term.consentMode,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) {
      return [];
    }

    return this.mikro.userTermsConsent.recordConsents(records);
  }

  /**
   * Record implicit consent for terms with implicit consent mode
   * Used during signup for terms that don't require explicit user action
   */
  public async recordImplicitConsents(params: {
    userId: string;
  }): Promise<UserTermsConsentEntity[]> {
    const terms = await this.getGlobalTerms();

    // Only record consent for terms with implicit consent mode
    const implicitTerms = terms.filter((t) => t.consentMode === 'implicit');

    if (implicitTerms.length === 0) {
      return [];
    }

    return this.recordConsents({
      userId: params.userId,
      consents: implicitTerms.map((t) => ({
        termsId: t.id,
        agreed: true,
      })),
      consentType: 'implicit',
    });
  }

  /**
   * Get terms that require explicit consent (checkbox)
   */
  public async getExplicitTerms(): Promise<
    Loaded<TermsEntity, 'contents', '*', never>[]
  > {
    const terms = await this.getGlobalTerms();
    return terms.filter((t) => t.consentMode === 'explicit');
  }

  /**
   * Get terms with implicit consent mode
   */
  public async getImplicitTerms(): Promise<
    Loaded<TermsEntity, 'contents', '*', never>[]
  > {
    const terms = await this.getGlobalTerms();
    return terms.filter((t) => t.consentMode === 'implicit');
  }

  /**
   * Validate that all required explicit terms have been agreed to
   * (implicit terms are auto-agreed, so they don't need validation)
   */
  public async validateExplicitConsents(
    consents: Array<{ termsId: string; agreed: boolean }>,
  ): Promise<{ valid: boolean; missingTerms: string[] }> {
    const terms = await this.getGlobalTerms();
    // Only validate required terms with explicit consent mode
    const requiredExplicitTerms = terms.filter(
      (t) => t.required && t.consentMode === 'explicit',
    );
    const consentsMap = new Map(consents.map((c) => [c.termsId, c]));

    const missingTerms: string[] = [];

    for (const term of requiredExplicitTerms) {
      const consent = consentsMap.get(term.id);
      if (!consent || !consent.agreed) {
        missingTerms.push(term.id);
      }
    }

    return {
      valid: missingTerms.length === 0,
      missingTerms,
    };
  }

  /**
   * Check if any required terms exist
   */
  public async hasRequiredTerms(): Promise<boolean> {
    return this.mikro.terms.hasRequiredTerms();
  }
}

export default fastifyPlugin(
  async (fastify) => {
    const termsService = new TermsService(fastify.mikro, fastify.config);
    fastify.decorate('termsService', termsService);
  },
  {
    name: 'terms-service-plugin',
    dependencies: ['base-service-plugin'],
  },
);
