import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 200 },
    { duration: '20s', target: 5000 },
    { duration: '30s', target: 5000 },
    { duration: '20s', target: 0 },
  ],
};

export default function () {
  const r = http.post(`${__ENV.API}/api/events/${__ENV.EVENT}/register`, null, {
    headers: {
      Authorization: `Bearer ${__ENV.TOKEN}`,
      'Idempotency-Key': `${__VU}-${__ITER}`,
    },
  });
  check(r, { accepted: x => x.status === 202 || x.status === 200 });
}
