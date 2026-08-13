import type { RoleChainReport, AnalystNode, DebateSide } from '@/types/report';
import { VERDICT_PILL, STANCE_PILL, STANCE_LABEL, RISK_LABEL } from '@/types/report';

function VerdictPill({ verdict, label }: { verdict: string; label: string }) {
  const cls = (VERDICT_PILL as Record<string, string>)[verdict] ?? 'verdict-neutral';
  return <span className={`verdict-pill ${cls}`}><i className="fa-solid fa-scale-balanced text-[10px]" />{label}</span>;
}

function PriceBandView({ band, currency }: { band: { low: number; high: number; currency: string } | null; currency?: string | undefined }) {
  if (!band) return <span className="data-sample-badge">示例 / 延迟</span>;
  const sym = ({ USD: '$', HKD: 'HK$', CNY: '¥' } as Record<string, string>)[band.currency || currency || 'USD'] || '$';
  return (
    <span className="num text-sm text-text-primary">
      {sym}{band.low} <span className="text-text-tertiary">–</span> {sym}{band.high}
    </span>
  );
}

function AnalystCard({ a }: { a: AnalystNode }) {
  if (!a.hasContent) {
    return (
      <div className="surface-card p-4 opacity-60">
        <div className="flex items-center justify-between">
          <span className="num text-xs text-text-tertiary">{a.code}</span>
          <span className="verdict-pill verdict-neutral">{STANCE_LABEL[a.stance]}</span>
        </div>
        <h4 className="mt-1 text-sm font-medium text-text-secondary">{a.title}</h4>
        <p className="mt-2 text-xs text-text-tertiary">暂无产出，待后续复核。</p>
      </div>
    );
  }
  return (
    <div className="surface-card p-4">
      <div className="flex items-center justify-between">
        <span className="num text-xs text-accent-secondary">{a.code}</span>
        <span className={`verdict-pill ${STANCE_PILL[a.stance]}`}>{STANCE_LABEL[a.stance]}</span>
      </div>
      <h4 className="mt-1 text-sm font-medium text-text-primary">{a.title}</h4>
      <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-text-secondary">{a.summary}</p>
    </div>
  );
}

function DebateColumn({ title, side, tone }: { title: string; side: DebateSide; tone: 'bull' | 'bear' | 'safe' | 'neutral' }) {
  const toneIcon = { bull: 'fa-arrow-trend-up', bear: 'fa-arrow-trend-down', safe: 'fa-shield', neutral: 'fa-minus' }[tone];
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2">
        <i className={`fa-solid ${toneIcon} text-xs ${tone === 'bull' ? 'text-verdict-bull' : tone === 'bear' ? 'text-verdict-bear' : tone === 'safe' ? 'text-verdict-safe' : 'text-text-tertiary'}`} />
        <span className="text-xs font-medium text-text-secondary">{title}</span>
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs font-medium text-text-primary">{side.headline}</p>
      <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-text-secondary">{side.summary}</p>
    </div>
  );
}

export function RoleChainReportView({ report }: { report: RoleChainReport }) {
  const d = report.decision;
  return (
    <div className="space-y-8">
      {/* 0. Pinned decision */}
      <section className="surface-panel chain-rail p-5 pl-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <i className="fa-solid fa-gavel" /> Risk Judge 最终裁决
            </div>
            <h2 className="h-serif mt-2 text-2xl">{report.company} <span className="num text-base text-text-tertiary">{report.ticker}</span></h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VerdictPill verdict={d.verdict} label={d.verdictLabel} />
            {d.confidence != null && (
              <span className="num text-xs text-text-secondary">置信度 {d.confidence}%</span>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">{d.rationale}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="建议价格区间"><PriceBandView band={d.priceBand} currency={report.market ? ({ US: 'USD', HK: 'HKD', CN: 'CNY' } as Record<string, string>)[report.market] : undefined} /></Field>
          <Field label="风险等级"><span className={`verdict-pill ${d.riskLevel === 'high' ? 'verdict-bear' : d.riskLevel === 'low' ? 'verdict-bull' : d.riskLevel === 'elevated' ? 'verdict-hold' : 'verdict-neutral'}`}>{RISK_LABEL[d.riskLevel]}</span></Field>
          <Field label="建议期限">{d.horizon ? <span className="text-sm text-text-primary">{d.horizon}</span> : <span className="data-sample-badge">未给出</span>}</Field>
          <Field label="数据来源"><span className="num text-sm text-text-secondary">{report.meta.sources} 条</span></Field>
        </div>
      </section>

      {/* 1. Analyst team */}
      <ChainSection index="01" title="分析师团队" subtitle="Market · Social · News · Fundamentals">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {report.analysts.map((a) => <AnalystCard key={a.code} a={a} />)}
        </div>
      </ChainSection>

      {/* 2. Research debate */}
      <ChainSection index="02" title="研究辩论" subtitle="Bull · Bear · Research Manager">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DebateColumn title="看多方" side={report.debate.bull} tone="bull" />
          <DebateColumn title="看空方" side={report.debate.bear} tone="bear" />
          <div className="surface-card border-verdict-safe/30 p-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-user-tie text-xs text-verdict-safe" />
              <span className="text-xs font-medium text-text-secondary">研究经理裁决</span>
            </div>
            <p className="mt-1.5 line-clamp-6 text-xs leading-relaxed text-text-primary">{report.debate.manager.summary}</p>
          </div>
        </div>
      </ChainSection>

      {/* 3. Trader plan */}
      <ChainSection index="03" title="交易计划" subtitle="Trader — 非执行性研究建议">
        <div className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VerdictPill verdict={report.traderPlan.verdict} label={report.traderPlan.verdictLabel} />
            <PriceBandView band={report.traderPlan.priceBand} currency={report.market ? ({ US: 'USD', HKD: 'HKD', CN: 'CNY' } as Record<string, string>)[report.market] : undefined} />
            {report.traderPlan.positionCapPct != null && (
              <span className="num text-xs text-text-secondary">仓位上限 {report.traderPlan.positionCapPct}%</span>
            )}
          </div>
          {report.traderPlan.hasContent && (
            <p className="mt-3 text-xs leading-relaxed text-text-secondary">{report.traderPlan.summary}</p>
          )}
          <p className="disclaimer-strip mt-3 flex items-center gap-1.5">
            <i className="fa-solid fa-circle-info" /> {report.traderPlan.note}
          </p>
        </div>
      </ChainSection>

      {/* 4. Risk debate */}
      <ChainSection index="04" title="风险辩论" subtitle="Risky · Safe · Neutral">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DebateColumn title="激进方" side={report.riskDebate.risky} tone="bear" />
          <DebateColumn title="稳健方" side={report.riskDebate.safe} tone="safe" />
          <DebateColumn title="中性方" side={report.riskDebate.neutral} tone="neutral" />
        </div>
      </ChainSection>

      {/* 5. Summary */}
      {report.summary && (
        <ChainSection index="05" title="末尾总结">
          <p className="text-sm leading-relaxed text-text-secondary">{report.summary}</p>
        </ChainSection>
      )}

      <p className="disclaimer-strip border-t border-dark-border pt-4">{report.meta.disclaimer}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-text-tertiary">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ChainSection({ index, title, subtitle, children }: { index: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="chain-rail pl-8">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="num text-xs text-text-tertiary">{index}</span>
        <h3 className="h-serif text-base">{title}</h3>
        {subtitle && <span className="text-xs text-text-tertiary">· {subtitle}</span>}
      </div>
      {children}
    </section>
  );
}
