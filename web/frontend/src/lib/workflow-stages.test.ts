import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_BANDS,
  WORKFLOW_NODES,
  AGENT_TO_BAND_INDEX,
  AGENT_LABEL,
} from './workflow-stages';

describe('workflow-stages — GraphSetup fidelity', () => {
  it('has exactly five bands in graph order', () => {
    expect(WORKFLOW_BANDS).toHaveLength(5);
    expect(WORKFLOW_BANDS.map((b) => b.id)).toEqual([1, 2, 3, 4, 5]);
    expect(WORKFLOW_BANDS.map((b) => b.name)).toEqual([
      '研究 / 数据采集',
      '研究辩论',
      '交易计划',
      '风险审议',
      '最终裁决',
    ]);
  });

  it('exposes exactly the twelve real graph nodes (no auxiliary tools_*/Msg Clear)', () => {
    expect(WORKFLOW_NODES).toHaveLength(12);
    const nodes = WORKFLOW_NODES.map((n) => n.node);
    // Real nodes from setup.py
    expect(nodes).toEqual([
      'Market Analyst',
      'Social Analyst',
      'News Analyst',
      'Fundamentals Analyst',
      'Bull Researcher',
      'Bear Researcher',
      'Research Manager',
      'Trader',
      'Risky Analyst',
      'Safe Analyst',
      'Neutral Analyst',
      'Risk Judge',
    ]);
  });

  it('keeps Risk Judge in a separate final band from the risk debate', () => {
    const riskBand = WORKFLOW_BANDS[3]!;
    const finalBand = WORKFLOW_BANDS[4]!;
    // Band 4 = the fixed Risky → Safe → Neutral rotation.
    expect(riskBand.agents).toEqual(['risky', 'safe', 'neutral']);
    // Band 5 = Risk Judge only (terminal node).
    expect(finalBand.agents).toEqual(['risk_manager']);
    expect(finalBand.nodes[0]!.node).toBe('Risk Judge');
  });

  it('routes every backend agent code to the correct band index', () => {
    expect(AGENT_TO_BAND_INDEX.market).toBe(0);
    expect(AGENT_TO_BAND_INDEX.bull).toBe(1);
    expect(AGENT_TO_BAND_INDEX.invest_judge).toBe(1); // Research Manager ends the debate band
    expect(AGENT_TO_BAND_INDEX.trader).toBe(2);
    expect(AGENT_TO_BAND_INDEX.risky).toBe(3);
    expect(AGENT_TO_BAND_INDEX.risk_manager).toBe(4); // Risk Judge is its own final band
  });

  it('gives Research Manager and Risk Judge distinct, unambiguous labels', () => {
    expect(AGENT_LABEL.invest_judge).toBe('研究经理');
    expect(AGENT_LABEL.risk_manager).toBe('风险裁决');
    expect(AGENT_LABEL.invest_judge).not.toBe(AGENT_LABEL.risk_manager);
  });
});
