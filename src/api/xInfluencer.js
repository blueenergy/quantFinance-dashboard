import axios from 'axios'

/**
 * @param {{ limit?: number, username?: string, with_analysis?: boolean }} params
 */
export async function fetchXInfluencerPosts(params = {}) {
  const res = await axios.get('/api/x-influencer/posts', { params })
  return res.data
}

export async function triggerXInfluencerAnalyze(tweetId) {
  const res = await axios.post(`/api/x-influencer/posts/${encodeURIComponent(tweetId)}/analyze`)
  return res.data
}
