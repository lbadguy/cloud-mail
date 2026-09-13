import http from '@/axios/index.js';

export function getUpdateStatus() {
    return http.get('/update/status', { noMsg: true });
}

export function requestUpdateApply() {
    return http.post('/update/apply', {}, { noMsg: true });
}
