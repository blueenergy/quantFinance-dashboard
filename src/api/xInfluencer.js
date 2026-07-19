import request from '../utils/request'

/**
 * @param {{ limit?: number, username?: string, with_analysis?: boolean }} params
 */
export async function fetchXInfluencerPosts(params = {}) {
  return request({
    url: '/x-influencer/posts',
    method: 'get',
    params,
  })
}

export async function triggerXInfluencerAnalyze(tweetId) {
  return request({
    url: `/x-influencer/posts/${encodeURIComponent(tweetId)}/analyze`,
    method: 'post',
  })
}
