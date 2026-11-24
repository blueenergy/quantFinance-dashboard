import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PortfolioNarrativeCard from '../src/components/portfolio/PortfolioNarrativeCard.vue'

function mountCard(narrative) {
  return mount(PortfolioNarrativeCard, { props: { narrative } })
}

describe('PortfolioNarrativeCard evidence refs', () => {
  it('links each ref to its vault note in Obsidian', () => {
    const wrapper = mountCard({
      title: '规则成长周期 30:70（Top10 · 20日）',
      refs: ['model-vs-rule-decision-2026-10-21'],
      ref_paths: ['projects/trading/research/model-vs-rule-decision-2026-10-21.md'],
    })

    const links = wrapper.findAll('.narr-ref')
    expect(links).toHaveLength(1)
    expect(links[0].text()).toBe('model-vs-rule-decision-2026-10-21')
    expect(links[0].attributes('href')).toBe(
      'obsidian://open?vault=llm-wiki&file=projects/trading/research/model-vs-rule-decision-2026-10-21.md'
    )
    expect(links[0].attributes('title')).toContain('projects/trading/research/model-vs-rule-decision-2026-10-21.md')
  })

  it('keeps refs index-aligned with ref_paths', () => {
    const wrapper = mountCard({
      refs: ['first-note', 'second-note'],
      ref_paths: ['projects/trading/research/first-note.md', ''],
    })

    const links = wrapper.findAll('.narr-ref')
    expect(links[0].attributes('href')).toBe(
      'obsidian://open?vault=llm-wiki&file=projects/trading/research/first-note.md'
    )
    expect(links[1].attributes('href')).toBe(
      'obsidian://search?vault=llm-wiki&query=second-note'
    )
  })

  it('falls back to an Obsidian search when no vault path is known', () => {
    const wrapper = mountCard({ refs: ['some-note'] })

    const link = wrapper.get('.narr-ref')
    expect(link.attributes('href')).toBe('obsidian://search?vault=llm-wiki&query=some-note')
    expect(link.attributes('title')).toContain('llm-wiki')
  })

  it('encodes characters that are unsafe in a URI', () => {
    const wrapper = mountCard({
      refs: ['space note'],
      ref_paths: ['projects/trading/research/space note.md'],
    })

    expect(wrapper.get('.narr-ref').attributes('href')).toBe(
      'obsidian://open?vault=llm-wiki&file=projects/trading/research/space%20note.md'
    )
  })

  it('hides the evidence row when the narrative has no refs', () => {
    const wrapper = mountCard({ title: '无依据' })
    expect(wrapper.find('.narr-refs').exists()).toBe(false)
  })
})
