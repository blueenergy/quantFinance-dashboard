import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export const earningsHunterApi = {
    getSignals(days = 30) {
        return axios.get(`${API_BASE}/hunter/signals`, { params: { days } })
    },
    analyzeSignal(signalId, signalType) {
        return axios.post(`${API_BASE}/hunter/analyze/${signalId}`, null, {
            params: { signal_type: signalType }
        })
    }
}
