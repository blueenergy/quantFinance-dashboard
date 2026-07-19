import { computed, toValue } from 'vue'

export function useWorkbenchShareholders({ shareholderData }) {
  const shareholderDataValue = () => toValue(shareholderData) || {}

  const shSummary = computed(() => shareholderDataValue().summary || {})
  const shHolderNumbers = computed(() => Array.isArray(shareholderDataValue().holder_numbers) ? shareholderDataValue().holder_numbers : [])
  const shHkHold = computed(() => Array.isArray(shareholderDataValue().hk_hold) ? shareholderDataValue().hk_hold : [])
  const shHolderTrades = computed(() => Array.isArray(shareholderDataValue().holder_trades) ? shareholderDataValue().holder_trades : [])
  const shShareFloats = computed(() => Array.isArray(shareholderDataValue().share_floats) ? shareholderDataValue().share_floats : [])
  const shRepurchases = computed(() => Array.isArray(shareholderDataValue().repurchases) ? shareholderDataValue().repurchases : [])
  const shTop10Change = computed(() => shareholderDataValue().top10_float_change || {})
  const shIntlNew = computed(() => Array.isArray(shTop10Change.value.intl_new) ? shTop10Change.value.intl_new : [])
  const shIntlChanges = computed(() => {
    if (Array.isArray(shTop10Change.value.intl_changes)) {
      return shTop10Change.value.intl_changes.filter((row) => row?.change_type !== 'unchanged')
    }
    return shIntlNew.value.map((row) => ({
      norm_key: row.norm_key,
      norm_label: row.norm_label,
      holder_name: row.holder_name,
      change_type: 'new',
      current: row,
      previous: null,
      hold_amount_chg: null,
      hold_ratio_chg: null,
      hold_ratio_rel_chg_pct: null,
    }))
  })
  const shHksc = computed(() => shTop10Change.value.hksc || {})

  return {
    shSummary,
    shHolderNumbers,
    shHkHold,
    shHolderTrades,
    shShareFloats,
    shRepurchases,
    shTop10Change,
    shIntlNew,
    shIntlChanges,
    shHksc,
  }
}
