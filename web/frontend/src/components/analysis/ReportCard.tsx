'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { Report } from '@/types/conversation';
import { RatingScale } from './RatingScale';
import { SectionAccordion } from './SectionAccordion';
import { DataSnapshot } from './DataSnapshot';
import { ExportMenu } from './ExportMenu';

const SECTION_OPEN_DEFAULT: Record<string, boolean> = {
  market_technical: false,
  fundamentals: false,
  sentiment: false,
  news_macro: false,
  risk: false,
};

export function ReportCard({ report, compact = false }: { report: Report; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-dark-border bg-gradient-to-br from-dark-secondary to-dark-tertiary shadow-card-dark my-3 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-dark-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">{report.ticker}</span>
              {report.company_name && <span className="text-text-secondary">{report.company_name}</span>}
            </div>
            <div className="mt-2">
              <RatingScale rating={report.conclusion.rating} label={report.conclusion.rating_label} />
            </div>
          </div>
          <ExportMenu reportId={report.id} />
        </div>

        {/* Conclusion summary */}
        <p className="mt-3 text-text-primary leading-relaxed">{report.conclusion.summary}</p>

        {/* Key points */}
        {report.conclusion.key_points?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {report.conclusion.key_points.map((kp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <i className="fas fa-circle text-accent-primary text-[8px] mt-2" aria-hidden="true" />
                <span>{kp}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <DataSnapshot report={report} />
        </div>
      </div>

      {/* Sections */}
      <div className="p-3 space-y-2">
        {report.sections.map((section) => (
          <SectionAccordion
            key={section.key}
            title={section.title}
            defaultOpen={SECTION_OPEN_DEFAULT[section.key] ?? false}
            badge={
              section.summary ? (
                <span className="text-xs text-text-tertiary font-normal hidden md:inline truncate max-w-[280px]">
                  {section.summary}
                </span>
              ) : undefined
            }
          >
            {section.indicators && section.indicators.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {section.indicators.map((ind) => (
                  <span
                    key={ind.name}
                    className="px-2 py-1 rounded bg-dark-tertiary text-xs text-text-secondary font-mono"
                  >
                    {ind.name}: {ind.value}
                    <span
                      className={
                        ind.trend === 'up' ? ' text-success-500' : ind.trend === 'down' ? ' text-danger-500' : ' text-text-tertiary'
                      }
                    >
                      {' '}
                      {ind.trend === 'up' ? '↑' : ind.trend === 'down' ? '↓' : '→'}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="prose-invert max-w-none text-sm">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{section.content || section.summary}</ReactMarkdown>
            </div>

            {section.risk_factors && section.risk_factors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-danger-400 font-medium">风险因素</p>
                <ul className="list-disc list-inside text-text-secondary text-sm">
                  {section.risk_factors.map((rf, i) => (
                    <li key={i}>{rf}</li>
                  ))}
                </ul>
              </div>
            )}

            {section.grounded_evidence && (
              <p className="mt-2 text-xs text-text-tertiary border-l-2 border-accent-primary pl-2">
                数据锚定：{section.grounded_evidence}
              </p>
            )}

            {section.news_sources && section.news_sources.length > 0 && (
              <div className="mt-2 space-y-1">
                {section.news_sources.map((ns, i) => (
                  <a
                    key={i}
                    href={ns.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-accent-primary hover:underline"
                  >
                    <i className="fas fa-external-link-alt mr-1" aria-hidden="true" />
                    {ns.title}
                  </a>
                ))}
              </div>
            )}
          </SectionAccordion>
        ))}
      </div>

      {/* Reflection (decision-log, only when present) */}
      {report.reflection?.previous_decisions && (
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-accent-primary/30 bg-accent-primary/5 p-3 text-xs text-text-secondary">
            <p className="text-accent-primary font-medium mb-1">
              <i className="fas fa-lightbulb mr-1" aria-hidden="true" />
              历史判断反思
            </p>
            <p>{report.reflection.previous_decisions}</p>
            {report.reflection.alpha_vs_benchmark && (
              <p className="mt-1 text-text-tertiary">相对基准：{report.reflection.alpha_vs_benchmark}</p>
            )}
          </div>
        </div>
      )}

      {!compact && report.stage_log && report.stage_log.length > 0 && (
        <div className="px-4 pb-4">
          <details className="text-xs text-text-tertiary">
            <summary className="cursor-pointer hover:text-text-secondary">阶段执行日志</summary>
            <ul className="mt-2 space-y-1">
              {report.stage_log.map((sl, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-32 truncate">{sl.stage_name}</span>
                  <span className="text-text-secondary">{sl.status}</span>
                  {sl.duration_ms != null && <span>{sl.duration_ms}ms</span>}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
