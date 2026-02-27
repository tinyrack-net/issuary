import type { Loaded } from '@mikro-orm/core';
import type { ITermsEntity } from '#backend/entities/terms.entity.js';
import type { UserTermsConsentEntity } from '#backend/entities/user-terms-consent.entity.js';
import type { MikroService } from '#backend/services/mikro.service.js';

/**
 * Loaded terms type alias for readability
 */
type LoadedTerms = Loaded<ITermsEntity, 'contents', '*', never>;

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
  private readonly mikro: MikroService;
  public constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  /**
   * Get all global terms from database
   */
  public async getGlobalTerms(): Promise<LoadedTerms[]> {
    return this.mikro.terms.findAllWithContents();
  }

  /**
   * Get localized content for a term from its contents collection
   */
  public getLocalizedContent(
    term: LoadedTerms,
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
   * Extract pending required term IDs from already-loaded
   * localized terms. Use this instead of getPendingRequiredTerms
   * when you already have the result of getGlobalTermsWithConsent.
   */
  public getPendingFromLocalizedTerms(terms: LocalizedTermItem[]): string[] {
    return terms
      .filter(
        (t) => t.required && (!t.userConsent || t.userConsent.requiresUpdate),
      )
      .map((t) => t.id);
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
   * Record consent for multiple terms.
   * Accepts optional pre-loaded terms to avoid redundant DB queries.
   */
  public async recordConsents(params: {
    userSub: string;
    consents: Array<{
      termsId: string;
      agreed: boolean;
      consentType?: 'explicit' | 'implicit' | undefined;
    }>;
    terms?: LoadedTerms[];
  }): Promise<UserTermsConsentEntity[]> {
    const terms = params.terms ?? (await this.getGlobalTerms());
    const termsMap = new Map(terms.map((t) => [t.id, t]));

    const records = params.consents
      .map((consent) => {
        const term = termsMap.get(consent.termsId);
        if (!term) {
          return null;
        }

        return {
          userSub: params.userSub,
          termsId: consent.termsId,
          termsVersion: term.version,
          agreed: consent.agreed,
          // Use provided consentType or derive from term's consentMode
          consentType: consent.consentType ?? term.consentMode,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) {
      return [];
    }

    return this.mikro.userTermsConsent.recordConsents(records);
  }

  /**
   * Record implicit consent for terms with implicit consent mode.
   * Used during signup for terms that don't require explicit user
   * action. Accepts optional pre-loaded terms to avoid redundant
   * DB queries.
   */
  public async recordImplicitConsents(params: {
    userSub: string;
    terms?: LoadedTerms[];
  }): Promise<UserTermsConsentEntity[]> {
    const terms = params.terms ?? (await this.getGlobalTerms());

    // Only record consent for terms with implicit consent mode
    const implicitTerms = terms.filter((t) => t.consentMode === 'implicit');

    if (implicitTerms.length === 0) {
      return [];
    }

    return this.recordConsents({
      userSub: params.userSub,
      consents: implicitTerms.map((t) => ({
        termsId: t.id,
        agreed: true,
        consentType: 'implicit' as const,
      })),
      terms,
    });
  }

  /**
   * Get terms that require explicit consent (checkbox).
   * Accepts optional pre-loaded terms to avoid redundant DB
   * queries.
   */
  public async getExplicitTerms(terms?: LoadedTerms[]): Promise<LoadedTerms[]> {
    const allTerms = terms ?? (await this.getGlobalTerms());
    return allTerms.filter((t) => t.consentMode === 'explicit');
  }

  /**
   * Validate that all required explicit terms have been agreed to.
   * (implicit terms are auto-agreed, so they don't need validation)
   * Accepts optional pre-loaded terms to avoid redundant DB
   * queries.
   */
  public async validateExplicitConsents(
    consents: Array<{ termsId: string; agreed: boolean }>,
    terms?: LoadedTerms[],
  ): Promise<{ valid: boolean; missingTerms: string[] }> {
    const allTerms = terms ?? (await this.getGlobalTerms());
    // Only validate required terms with explicit consent mode
    const requiredExplicitTerms = allTerms.filter(
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
   * Validate explicit consents, then record all consents
   * (explicit + implicit) in a single flow. Loads terms only once.
   */
  public async validateAndRecordConsents(params: {
    userSub: string;
    consents: Array<{ termsId: string; agreed: boolean }>;
  }): Promise<{
    validation: { valid: boolean; missingTerms: string[] };
    records: UserTermsConsentEntity[];
  }> {
    const terms = await this.getGlobalTerms();

    const validation = await this.validateExplicitConsents(
      params.consents,
      terms,
    );

    if (!validation.valid) {
      return { validation, records: [] };
    }

    // Record explicit consents
    const explicitRecords =
      params.consents.length > 0
        ? await this.recordConsents({
            userSub: params.userSub,
            consents: params.consents,
            terms,
          })
        : [];

    // Record implicit consents
    const implicitRecords = await this.recordImplicitConsents({
      userSub: params.userSub,
      terms,
    });

    return {
      validation,
      records: [...explicitRecords, ...implicitRecords],
    };
  }
}
