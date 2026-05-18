import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#admin/components/page-header.js';
import { auditEventsQueryOptions } from '#admin/queries/admin.js';

export function AuditEventsPage() {
  const { t } = useTranslation();
  const { data: events } = useSuspenseQuery(auditEventsQueryOptions);

  return (
    <section>
      <PageHeader
        subtitle={t('auditEvents.subtitle')}
        title={t('auditEvents.title')}
      />
      {events.length === 0 ? (
        <div className="alert">{t('auditEvents.empty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>{t('auditEvents.action')}</th>
                <th>{t('auditEvents.actor')}</th>
                <th>{t('auditEvents.target')}</th>
                <th>{t('auditEvents.ip')}</th>
                <th>{t('auditEvents.userAgent')}</th>
                <th>{t('auditEvents.metadata')}</th>
                <th>{t('auditEvents.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="font-medium">{event.action}</td>
                  <td>{event.actor_sub}</td>
                  <td>
                    {event.target_type}:{event.target_id}
                  </td>
                  <td>{event.ip ?? t('common.unknown')}</td>
                  <td>{event.user_agent ?? t('common.unknown')}</td>
                  <td>
                    <pre className="max-w-md overflow-x-auto text-xs">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  </td>
                  <td>{event.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
