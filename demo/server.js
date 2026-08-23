process.env.HCAPTCHA_SITE_KEY = process.env.HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001';
process.env.HCAPTCHA_SECRET_KEY = process.env.HCAPTCHA_SECRET_KEY || '0x0000000000000000000000000000000000000000';
process.env.RESTRICTION_ADMIN_SECRET = process.env.RESTRICTION_ADMIN_SECRET || 'demo-admin-secret';

const path = require('path');
const fs = require('fs');
process.env.NODE_PATH = path.join(__dirname, 'node_modules');
require('module').Module._initPaths();
const express = require('express');

const { mountRestrictionRoutes, issueRestrictionToken } = require('../restriction-routes.js');

const PORT = Number(process.env.PORT || 4800);
const ROOT = path.resolve(__dirname, '..');
const AVATAR_PATH = path.join(__dirname, 'assets', 'avatar.jpg');

const demoUser = {
    id: 'demo-user-001',
    username: 'hassani.dev',
    display_name: 'Hassani Dev',
    avatar: '/demo-assets/avatar.jpg',
    email: 'hassani.demo@example.com',
    email_verified: true,
    is_verified: true,
    onboarding_completed: true,
    restriction: true,
    restriction_reason: 'مخالفة إرشادات المجتمع: إرسال رسائل غير مرغوب فيها بشكل متكرر خلال فترة قصيرة',
    restriction_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    appeal_status: 'none',
    appeal_date: null,
    appeal_photo_filename: null,
    appeal_photo_expires_at: null
};

function rowOf(user, extra = {}) {
    return { ...user, ...extra };
}

const pool = {
    async query(sql, params = []) {
        const s = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

        if (s.startsWith('select') && s.includes('lower(username) = lower(')) {
            const name = String(params[0] || '').toLowerCase();
            if (demoUser.username.toLowerCase() === name) return { rows: [rowOf(demoUser)], rowCount: 1 };
            return { rows: [], rowCount: 0 };
        }

        if (s.startsWith('update users set appeal_status = \'pending\'')) {
            demoUser.appeal_status = 'pending';
            demoUser.appeal_date = params[0];
            demoUser.appeal_photo_filename = params[1];
            demoUser.appeal_photo_expires_at = params[2];
            return { rows: [], rowCount: 1 };
        }

        if (s.startsWith('update users set restriction = true')) {
            demoUser.restriction = true;
            demoUser.restriction_reason = params[0] || demoUser.restriction_reason;
            demoUser.restriction_date = new Date().toISOString();
            demoUser.appeal_status = 'none';
            return { rows: [], rowCount: 1 };
        }

        if (s.startsWith('update users set restriction = false')) {
            demoUser.restriction = false;
            demoUser.restriction_reason = null;
            demoUser.restriction_date = null;
            demoUser.appeal_status = 'none';
            demoUser.appeal_photo_filename = null;
            demoUser.appeal_photo_expires_at = null;
            return { rows: [], rowCount: 1 };
        }

        if (s.startsWith('select') && s.includes('from users') && s.includes('where restriction = true')) {
            return { rows: demoUser.restriction ? [rowOf(demoUser)] : [], rowCount: demoUser.restriction ? 1 : 0 };
        }

        if (s.startsWith('select') && s.includes('onboarding_completed = true')) {
            return { rows: [rowOf(demoUser)], rowCount: 1 };
        }

        if (s.startsWith('select') && s.includes('from users where id = $1')) {
            return { rows: [rowOf(demoUser)], rowCount: 1 };
        }

        return { rows: [], rowCount: 0 };
    }
};

const persistentSessions = {
    'demo-session': { userId: demoUser.id, createdAt: Date.now() }
};

function savePersistentSessions() {}

function auditLog(action, meta) {
    console.log(' [audit]', action, JSON.stringify(meta || {}));
}

function getIP(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
}

const sentMails = [];
const demoMailer = {
    async send(to, subject, html, text) {
        sentMails.unshift({ to, subject, text, html, at: new Date().toISOString() });
        if (sentMails.length > 10) sentMails.pop();
        console.log(' [demo-mailer] mail captured to ' + to + ' subject="' + subject + '"');
        return true;
    }
};

async function demoHcaptchaVerifier(token, secret) {
    try {
        const r = await fetch('https://api.hcaptcha.com/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `response=${encodeURIComponent(token)}&secret=${encodeURIComponent(secret)}`
        });
        return await r.json();
    } catch (e) {
        if (String(token).startsWith('10000000-')) return { success: true, hostname: 'demo.local' };
        return { success: false, 'error-codes': ['network-unreachable'] };
    }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/demo-assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1h' }));

app.get('/1234.png', (req, res) => {
    if (fs.existsSync(AVATAR_PATH)) return res.sendFile(AVATAR_PATH);
    res.status(404).end();
});

const requireNotRestricted = mountRestrictionRoutes(app, {
    pool,
    persistentSessions,
    savePersistentSessions,
    auditLog,
    getIP,
    emailService: demoMailer,
    hcaptchaVerifier: demoHcaptchaVerifier
});

app.use(requireNotRestricted);

app.get('/', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restriction Demo</title>
<style>
body{margin:0;background:#000;color:#f5f5f5;font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:460px;width:100%;background:#121212;border:1px solid #262626;border-radius:16px;padding:28px}
h1{font-size:19px;margin:0 0 6px}
p{font-size:13px;color:#a8a8a8;line-height:1.8;margin:0 0 20px}
a.btn{display:block;text-align:center;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;padding:13px;margin-bottom:10px;transition:opacity .15s}
a.btn:hover{opacity:.85}
.primary{background:#0095f6;color:#fff}
.ghost{background:#262626;color:#f5f5f5}
code{background:#1a1a1a;border:1px solid #262626;border-radius:6px;padding:2px 6px;font-size:12px;color:#4cb5f9;direction:ltr;display:inline-block}
.meta{margin-top:18px;font-size:11.5px;color:#737373;line-height:2}
</style>
</head>
<body>
<div class="card">
<h1>بيئة تجريبية لنظام التقييد</h1>
<p>هذا الخادم يركب الإضافة <code>restriction-routes.js</code> مع مستخدم وهمي مقيد <code>@hassani.dev</code> لمحاكاة السلوك الحقيقي بالكامل.</p>
<a class="btn primary" href="/demo/start">محاكاة دخول مستخدم مقيد (توجيه تلقائي)</a>
<a class="btn ghost" href="/demo/direct">توليد رابط تقييد مباشر</a>
<a class="btn ghost" href="/demo/mail">عرض آخر رسالة بريد (OTP)</a>
<a class="btn ghost" href="/demo/reset">إعادة ضبط حالة المستخدم الوهمي</a>
<div class="meta">
مفتاح hCaptcha هنا هو مفتاح الاختبار الرسمي لذا ينجح التحقق دائماً في هذه البيئة.
<br>اسم مستخدم الطعن: <code>hassani.dev</code>
</div>
</div>
</body>
</html>`);
});

app.get('/demo/start', (req, res) => {
    res.cookie('sessionToken', 'demo-session', { httpOnly: false, sameSite: 'lax', path: '/' });
    res.redirect(302, '/account-center.html');
});

app.get('/demo/direct', (req, res) => {
    if (!demoUser.restriction) return res.redirect(302, '/');
    const { token } = issueRestrictionToken(demoUser.id);
    res.redirect(302, '/restriction.html/' + token);
});

app.get('/demo/mail', (req, res) => {
    res.json({ success: true, count: sentMails.length, mails: sentMails.map(m => ({ to: m.to, subject: m.subject, text: m.text, at: m.at })) });
});

app.get('/demo/reset', (req, res) => {
    demoUser.restriction = true;
    demoUser.appeal_status = 'none';
    demoUser.appeal_date = null;
    demoUser.appeal_photo_filename = null;
    demoUser.appeal_photo_expires_at = null;
    persistentSessions['demo-session'] = { userId: demoUser.id, createdAt: Date.now() };
    res.type('html').send('<meta charset="UTF-8"><body style="background:#000;color:#f5f5f5;font-family:sans-serif;text-align:center;padding-top:60px"><p>تمت إعادة الضبط. <a href="/" style="color:#0095f6">عودة</a></p></body>');
});

app.get('/account-center.html', (req, res) => {
    res.sendFile(path.join(ROOT, 'account-center.html'));
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'NOT_FOUND' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(' demo server listening on 0.0.0.0:' + PORT);
    console.log(' open / then click the demo buttons');
});
