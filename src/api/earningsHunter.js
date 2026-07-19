import request from '../utils/request'

export const earningsHunterApi = {
    getSignals(days = 30) {
        return request({
            url: '/hunter/signals',
            method: 'get',
            params: { days },
        })
    },
    analyzeSignal(signalId, signalType) {
        return request({
            url: `/hunter/analyze/${signalId}`,
            method: 'post',
            params: { signal_type: signalType },
        })
    },
}
