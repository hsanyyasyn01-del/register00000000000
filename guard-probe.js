const target = (process.argv[2] || 'https://2-mmdv.onrender.com').replace(/\/+$/, '');
const cookieArgIndex = process.argv.indexOf('--cookie');
const cookie = cookieArgIndex !== -1 ? process.argv[cookieArgIndex + 1] || '' : '';

const PROBES = [
    { name: 'root-page', method: 'GET', path: '/' },
    { name: 'restriction-page', method: 'GET', path: '/restriction.html' },
    { name: 'status', method: 'GET', path: '/api/restriction/status' },
    { name: 'heartbeat', method: 'GET', path: '/api/restriction/heartbeat' },
    { name: 'bootstrap', method: 'GET', path: '/api/restriction/bootstrap' },
    { name: 'i18n-ar', method: 'GET', path: '/api/restriction/i18n/ar' },
    { name: 'session-fake', method: 'GET', path: '/api/restriction/session/' + 'x'.repeat(60) },
    { name: 'token-mint', method: 'POST', path: '/api/restriction/token' },
    { name: 'telemetry', method: 'POST', path: '/api/restriction/telemetry' },
    { name: 'appeal-captcha', method: 'POST', path: '/api/restriction/appeal/verify-captcha' },
    { name: 'logout', method: 'POST', path: '/api/restriction/logout' },
    { name: 'unknown-api', method: 'GET', path: '/api/qx-probe-notreal' },
    { name: 'unknown-page', method: 'GET', path: '/qx-probe-notreal.html' }
];

function classify(status, engine, body) {
    if (engine) return 'ENGINE:' + engine;
    if (status === 403 && body.indexOf('استدلال') !== -1) return 'BAN-MIDDLEWARE-403';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT-FOUND';
    if (status >= 300 && status < 400) return 'REDIRECT';
    if (status === 200) return 'OK';
    return 'HTTP-' + status;
}

async function probe(item) {
    const headers = { Accept: 'application/json, text/html' };
    if (cookie) headers.Cookie = cookie;
    if (item.method === 'POST') headers['Content-Type'] = 'application/json';
    const init = { method: item.method, headers, redirect: 'manual' };
    if (item.method === 'POST') init.body = '{}';
    const started = Date.now();
    let res;
    try {
        res = await fetch(target + item.path, init);
    } catch (err) {
        return { name: item.name, path: item.path, error: String(err && err.message ? err.message : err), ms: Date.now() - started };
    }
    const ms = Date.now() - started;
    const engine = res.headers.get('x-restriction-engine') || '';
    const setCookie = res.headers.get('set-cookie') ? 'yes' : 'no';
    const location = res.headers.get('location') || '';
    const text = await res.text();
    const body = text.replace(/\s+/g, ' ').slice(0, 180);
    let shape = '';
    try {
        const json = JSON.parse(text);
        shape = 'json-keys:[' + Object.keys(json).sort().slice(0, 12).join(',') + ']';
    } catch (e) {
        shape = text.indexOf('<html') !== -1 || text.indexOf('<!DOCTYPE') !== -1 ? 'html' : 'text';
    }
    return { name: item.name, path: item.path, status: res.status, ms, engine, setCookie, location, shape, body, verdict: classify(res.status, engine, text) };
}

async function checkPageAssets() {
    try {
        const res = await fetch(target + '/restriction.html', { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
        const html = await res.text();
        const match = html.match(/src="(\/[^"]*assets\/[^"]*\.js)"/);
        if (!match) return { assetProbe: 'no-entry-found' };
        const assetRes = await fetch(target + match[1], { headers: cookie ? { Cookie: cookie } : {} });
        return { assetProbe: match[1].split('/').pop(), assetStatus: assetRes.status, assetEngine: assetRes.headers.get('x-restriction-engine') || '' };
    } catch (err) {
        return { assetProbe: 'error', detail: String(err) };
    }
}

async function main() {
    console.log('=== GUARD PROBE ===');
    console.log('target: ' + target);
    console.log('cookie: ' + (cookie ? 'provided' : 'anonymous'));
    console.log('');
    const results = [];
    for (const item of PROBES) {
        const r = await probe(item);
        results.push(r);
        if (r.error) {
            console.log('[' + r.name + '] ERROR ' + r.error);
            continue;
        }
        let line = '[' + r.name + '] ' + item.method + ' ' + r.path;
        line += ' => ' + r.status + ' (' + r.ms + 'ms) ' + r.verdict;
        console.log(line);
        console.log('    ' + r.shape + (r.location ? ' location:' + r.location.slice(0, 90) : '') + (r.setCookie === 'yes' ? ' set-cookie:yes' : ''));
        console.log('    body: ' + r.body);
    }
    const asset = await checkPageAssets();
    console.log('');
    console.log('[asset-check] ' + JSON.stringify(asset));
    console.log('');
    console.log('=== VERDICT ===');
    const engineHits = results.filter(r => r.engine);
    if (engineHits.length > 0) {
        console.log('restriction engine: LIVE (' + engineHits[0].engine + ')');
    } else {
        console.log('restriction engine: OLD DEPLOYMENT (no X-Restriction-Engine header anywhere)');
    }
    const statusProbe = results.find(r => r.name === 'status');
    if (statusProbe && statusProbe.shape && statusProbe.shape.indexOf('authenticated') !== -1) {
        console.log('status shape: NEW (authenticated + cfg embedded)');
    } else if (statusProbe && statusProbe.status === 200) {
        console.log('status shape: OLD (bare restricted flag)');
    } else {
        console.log('status shape: UNREACHABLE from here');
    }
    const banHits = results.filter(r => r.verdict === 'BAN-MIDDLEWARE-403');
    if (banHits.length > 0) {
        console.log('ban middleware: ACTIVE on this browser fingerprint (' + banHits.length + ' probes blocked with istidlal message)');
    } else {
        console.log('ban middleware: not triggering for this fingerprint');
    }
    const hb = results.find(r => r.name === 'heartbeat');
    const unknown = results.find(r => r.name === 'unknown-api');
    if (hb && unknown) {
        if (hb.status === 200 && unknown.status === 404) {
            console.log('routing: heartbeat route exists, unknown api 404s normally');
        } else if (hb.status === 404 && unknown.status === 404) {
            console.log('routing: heartbeat missing (old addon), unknown api 404s normally');
        } else if (hb.status === 403 && unknown.status === 403) {
            console.log('routing: blanket 403 for api paths from this fingerprint');
        }
    }
    console.log('=== END ===');
}

main();
