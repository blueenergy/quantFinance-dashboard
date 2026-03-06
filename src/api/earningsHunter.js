import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const earningsHunterApi = {
    getSignals(days = 30) {
        return axios.get(`${API_BASE_URL}/hunter/signals`, { params: { days } })
    },
    analyzeSignal(signalId, signalType) {
        return axios.post(`${API_BASE_URL}/hunter/analyze/${signalId}`, null, {
            params: { signal_type: signalType }
        })
    }
}
