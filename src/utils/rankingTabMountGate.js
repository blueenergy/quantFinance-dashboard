/**
 * Once the user opens the 金榜 (ranking) tab, the panel should stay mounted
 * and only be hidden with v-show so state and data survive tab switches.
 * @param {boolean} alreadyMounted
 * @param {string} activeTabId
 * @returns {boolean}
 */
export function nextRankingTabMountedState(alreadyMounted, activeTabId) {
  return alreadyMounted || activeTabId === 'ranking'
}
