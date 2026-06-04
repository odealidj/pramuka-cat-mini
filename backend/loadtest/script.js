import http from 'k6/http';
import { check, sleep } from 'k6';

// Konfigurasi K6: Kita pakai Environment Variable untuk menentukan mode (smoke, load, stress)
const MODE = __ENV.MODE || 'smoke';

let optionsMap = {
    // 1. Smoke Test: Cepat, hanya memastikan tidak ada script yang error (1 user, 1 menit)
    smoke: {
        vus: 1,
        duration: '10s',
    },
    // 2. Load Test: Menyimulasikan lalu lintas ujian normal (50 user serentak selama 1 menit)
    load: {
        stages: [
            { duration: '10s', target: 50 }, // Naik ke 50 user dalam 10 detik
            { duration: '40s', target: 50 }, // Bertahan 50 user selama 40 detik
            { duration: '10s', target: 0 },  // Turun ke 0 user dalam 10 detik
        ],
    },
    // 3. Stress Test: Mencari titik pecah server (Maks target VUs)
    stress: {
        stages: [
            { duration: '20s', target: Math.floor((__ENV.TARGET_VUS || 500) * 0.2) }, // Naik 20%
            { duration: '30s', target: Math.floor((__ENV.TARGET_VUS || 500) * 0.6) }, // Naik 60%
            { duration: '30s', target: (__ENV.TARGET_VUS || 500) }, // Beban puncak
            { duration: '20s', target: 0 },   // Normalisasi
        ],
    },
};

export let options = Object.assign({}, optionsMap[MODE], {
    thresholds: {
        http_req_duration: ['p(95)<3000'], // 95% request harus selesai di bawah 3 detik
        http_req_failed: ['rate<0.01'],    // Error rate maksimal 1%
    },
});

const BASE_URL = 'http://localhost:8080/api/v1';

let vuToken = null;

export default function () {
    // 1. Test Endpoint: Health Check
    let resHealth = http.get('http://localhost:8080/health');
    check(resHealth, {
        'health is status 200': (r) => r.status === 200,
    });

    // 2. Test Endpoint: Login (Peserta Seed) HANYA SEKALI per VU
    if (!vuToken) {
        const loginPayload = JSON.stringify({
            username: 'peserta1',
            password: 'peserta123',
        });
        
        const params = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        let resLogin = http.post(`${BASE_URL}/auth/login`, loginPayload, params);
        
        check(resLogin, {
            'login is status 200': (r) => r.status === 200,
            'has token': (r) => {
                try {
                    const body = r.json();
                    return body.data && body.data.access_token !== undefined;
                } catch (e) {
                    return false;
                }
            },
        });

        if (resLogin.status !== 200) {
            sleep(1);
            return;
        }
        vuToken = resLogin.json().data.access_token;
    }

    const authParams = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${vuToken}`
        },
    };

    // 3. Test Endpoint: Get Exams (Menguji caching & read performance)
    let resExams = http.get(`${BASE_URL}/protected/exams/upcoming`, authParams);
    check(resExams, {
        'get exams is status 200': (r) => r.status === 200,
    });

    // 4. Test Endpoint: Get Profile (Hit database to test DB pool / Redis caching)
    let resProfile = http.get(`${BASE_URL}/protected/users/me`, authParams);
    check(resProfile, {
        'get profile is status 200': (r) => r.status === 200,
    });

    // Simulasi peserta berpikir/membaca soal sebelum request berikutnya
    sleep(Math.random() * 2 + 1); // Jeda acak 1-3 detik
}
