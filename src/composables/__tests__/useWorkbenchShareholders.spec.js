import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWorkbenchShareholders } from '../useWorkbenchShareholders'

describe('useWorkbenchShareholders', () => {
  it('filters unchanged international holders', () => {
    const shareholders = useWorkbenchShareholders({
      shareholderData: ref({
        top10_float_change: {
          intl_changes: [
            { norm_key: 'a', change_type: 'unchanged' },
            { norm_key: 'b', change_type: 'increased' },
          ],
        },
      }),
    })

    expect(shareholders.shIntlChanges.value).toEqual([
      { norm_key: 'b', change_type: 'increased' },
    ])
  })

  it('maps legacy intl_new rows to new changes', () => {
    const shareholders = useWorkbenchShareholders({
      shareholderData: ref({
        top10_float_change: {
          intl_new: [{ norm_key: 'qfii', norm_label: 'QFII', holder_name: '机构甲' }],
        },
      }),
    })

    expect(shareholders.shIntlChanges.value).toEqual([{
      norm_key: 'qfii',
      norm_label: 'QFII',
      holder_name: '机构甲',
      change_type: 'new',
      current: { norm_key: 'qfii', norm_label: 'QFII', holder_name: '机构甲' },
      previous: null,
      hold_amount_chg: null,
      hold_ratio_chg: null,
      hold_ratio_rel_chg_pct: null,
    }])
  })
})
