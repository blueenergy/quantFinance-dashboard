/** Market events calendar API */

import request from '../utils/request'

export async function fetchMarketEvents(params = {}) {
  return request({
    url: '/market/events',
    method: 'get',
    params,
  })
}

export async function fetchMarketEventsStatus() {
  return request({
    url: '/market/events/status',
    method: 'get',
  })
}

export async function enqueueMarketEventBriefs(body = {}) {
  return request({
    url: '/market/events/enqueue-briefs',
    method: 'post',
    data: body,
  })
}
