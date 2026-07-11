export function isSubmittingForKey(submittingKey, activeKey) {
  return Boolean(submittingKey) && submittingKey === activeKey
}
