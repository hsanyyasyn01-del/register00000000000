const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch (e) { bcrypt = require('bcrypt'); }
const jwt = require('jsonwebtoken');

let expressStatic = null;
try { expressStatic = require('express').static; } catch (e) { expressStatic = null; }

let emailService;
try { emailService = require('./email-service'); } catch (e) { emailService = { send: async () => false }; }

const appealPhotoDir = path.join(__dirname, 'uploads', 'appeals');
if (!fs.existsSync(appealPhotoDir)) {
    fs.mkdirSync(appealPhotoDir, { recursive: true });
}

const appealPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, appealPhotoDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'appeal-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    }
});
const appealPhotoUpload = multer({
    storage: appealPhotoStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('NOT_IMAGE'));
    }
});

const appealSessions = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of appealSessions.entries()) {
        if (now - data.createdAt > 30 * 60 * 1000) appealSessions.delete(token);
    }
}, 5 * 60 * 1000);

setInterval(() => {
    try {
        const files = fs.readdirSync(appealPhotoDir);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(appealPhotoDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 12 * 60 * 60 * 1000) {
                fs.unlink(filePath, () => {});
                console.log(' [restriction] purged old appeal photo: ' + file);
            }
        });
    } catch (e) {}
}, 60 * 60 * 1000);

const restrictionTokens = new Map();
const RESTRICTION_TOKEN_TTL = Number(process.env.RESTRICTION_TOKEN_TTL_MS || 6 * 60 * 60 * 1000);
setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of restrictionTokens.entries()) {
        if (now - entry.createdAt > RESTRICTION_TOKEN_TTL) restrictionTokens.delete(token);
    }
}, 10 * 60 * 1000);

const telemetryRate = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of telemetryRate.entries()) {
        if (now > rec.reset + 10 * 60 * 1000) telemetryRate.delete(ip);
    }
}, 5 * 60 * 1000);

const TOKEN_PATTERN = /^[0-9a-z]{40,220}$/;

function generateRestrictionToken() {
    const alphabet = '0123456789abcdefghjkmnpqrstuvwxyz';
    const bytes = crypto.randomBytes(160);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
    const digits = String(crypto.randomInt(100000000, 999999999)) + String(crypto.randomInt(100000000, 999999999));
    const merged = (digits + out.slice(0, 170)).split('');
    for (let i = merged.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        const tmp = merged[i];
        merged[i] = merged[j];
        merged[j] = tmp;
    }
    return merged.join('');
}

function issueRestrictionToken(userId) {
    const now = Date.now();
    for (const [existing, entry] of restrictionTokens.entries()) {
        if (entry.userId === userId && now - entry.createdAt <= RESTRICTION_TOKEN_TTL) {
            return { token: existing, reference: entry.reference };
        }
    }
    const token = generateRestrictionToken();
    const reference = 'RV-' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 10).toUpperCase();
    restrictionTokens.set(token, { userId, reference, createdAt: now });
    return { token, reference };
}

function readTokenEntry(token) {
    if (!TOKEN_PATTERN.test(token)) return null;
    const entry = restrictionTokens.get(token);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > RESTRICTION_TOKEN_TTL) {
        restrictionTokens.delete(token);
        return null;
    }
    return entry;
}

function resolveUserId(req, persistentSessions) {
    let userId = null;
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) token = token.split(' ')[1];
    else token = req.headers['x-session-token'];
    if (!token && req.headers.cookie) {
        const m = req.headers.cookie.match(/(?:^|;\s*)sessionToken=([^;]+)/);
        if (m) token = m[1];
    }
    if (req.session && req.session.userId) userId = req.session.userId;
    if (token && !userId) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');
            if (decoded && decoded.userId) userId = decoded.userId;
        } catch (_) {}
        if (!userId && persistentSessions && persistentSessions[token]) {
            userId = persistentSessions[token].userId;
        }
    }
    return userId;
}

async function fetchRestrictionProfile(pool, userId) {
    const wideSql = 'SELECT username, display_name, avatar, restriction, restriction_reason, restriction_date, appeal_status, appeal_date, appeal_photo_expires_at FROM users WHERE id = $1';
    const narrowSql = 'SELECT username, restriction, restriction_reason, restriction_date, appeal_status, appeal_date FROM users WHERE id = $1';
    let rows = null;
    try {
        rows = (await pool.query(wideSql, [userId])).rows;
    } catch (e) {
        rows = (await pool.query(narrowSql, [userId])).rows;
    }
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
        username: u.username || null,
        displayName: typeof u.display_name !== 'undefined' ? u.display_name : null,
        avatar: typeof u.avatar !== 'undefined' ? u.avatar : null,
        restricted: u.restriction === true,
        restrictedAt: u.restriction_date || null,
        reason: u.restriction_reason || null,
        appealStatus: u.appeal_status || 'none',
        appealDate: u.appeal_date || null,
        photoExpiresAt: typeof u.appeal_photo_expires_at !== 'undefined' ? u.appeal_photo_expires_at : null
    };
}

async function defaultHcaptchaVerifier(captchaToken, secret) {
    const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `response=${encodeURIComponent(captchaToken)}&secret=${encodeURIComponent(secret)}`
    });
    return verifyRes.json();
}

function sanitizeTelemetryPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const out = {};
    const keys = Object.keys(payload).slice(0, 25);
    for (const k of keys) {
        const v = payload[k];
        if (typeof v === 'string') out[k] = v.slice(0, 300);
        else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    }
    return out;
}

function buildAppealOTPEmailHTML(code, username) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>Hassani GPT</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Cairo',sans-serif;color:#f0f6fc;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px;">
<table width="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#161b22;border:1px solid #30363d;border-radius:24px;overflow:hidden;">
<tr><td style="padding:32px 24px 16px;text-align:center;background:radial-gradient(circle at 50% 0%,rgba(239,68,68,0.15) 0%,transparent 60%);">
<h1 style="margin:0;font-size:22px;font-weight:800;color:#fca5a5;">رمز التحقق للطعن</h1>
<p style="margin:6px 0 0;font-size:13px;color:#8b949e;">Hassani GPT</p>
</td></tr>
<tr><td style="padding:24px 28px;">
<h2 style="margin:0 0 12px;font-size:18px;text-align:center;">مرحباً ${username || ''}</h2>
<p style="margin:0 0 20px;font-size:14px;color:#8b949e;text-align:center;line-height:1.7;">
استخدم الرمز التالي للمتابعة في تقديم طعنك. ينتهي خلال 5 دقائق.
</p>
<div style="background:#0d1117;border:1px solid #30363d;border-radius:16px;padding:24px;text-align:center;">
<div style="direction:ltr;font-size:36px;font-weight:900;letter-spacing:10px;color:#ef4444;font-family:monospace;">${code}</div>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#8b949e;text-align:center;">
لن يطلب منك فريق Hassani GPT هذا الرمز أبداً.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildRestrictionConfig() {
    return {
        brand: {
            name: process.env.RESTRICTION_BRAND_NAME || 'Hassani GPT',
            logo: process.env.RESTRICTION_BRAND_LOGO || '/1234.png'
        },
        captcha: {
            siteKey: process.env.HCAPTCHA_SITE_KEY || 'ea14e556-79e8-46a4-a59e-21d8653267be',
            enabled: !!process.env.HCAPTCHA_SECRET_KEY
        },
        features: {
            appealEnabled: process.env.RESTRICTION_APPEAL_ENABLED !== '0',
            cameraEnabled: process.env.RESTRICTION_CAMERA_ENABLED !== '0',
            heartbeatMs: Number(process.env.RESTRICTION_HEARTBEAT_MS || 25000),
            telemetryEnabled: process.env.RESTRICTION_TELEMETRY_ENABLED !== '0'
        },
        links: {
            help: process.env.RESTRICTION_LINK_HELP || '/help.html',
            terms: process.env.RESTRICTION_LINK_TERMS || '/terms.html',
            privacy: process.env.RESTRICTION_LINK_PRIVACY || '/privacy.html',
            about: process.env.RESTRICTION_LINK_ABOUT || '/about.html',
            login: process.env.RESTRICTION_LINK_LOGIN || '/login.html',
            home: process.env.RESTRICTION_LINK_HOME || '/messenger1.html'
        },
        serverTime: new Date().toISOString()
    };
}

function buildMissingBuildHtml() {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Hassani GPT</title></head>
<body style="margin:0;background:#000;color:#f5f5f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="text-align:center;max-width:420px;padding:24px;">
<h1 style="font-size:18px;margin:0 0 12px;">واجهة التقييد غير مثبتة</h1>
<p style="font-size:13px;color:#a8a8a8;line-height:1.7;margin:0;">لم يتم العثور على ملفات الواجهة المبنية داخل restriction-vue/dist. ابنِ الواجهة أولاً عبر npm run build ثم أعد تشغيل الخادم.</p>
</div>
</body>
</html>`;
}

const I18N_AR = {
    appTitle: 'تنبيه حول الحساب',
    brand: 'Hassani GPT',
    accountCenter: 'مركز الحساب',
    restrictedTitle: 'لقد قيدنا حسابك',
    restrictedOn: 'في {date}',
    restrictedBody: 'لا يلتزم حسابك بإرشادات المجتمع الخاصة بنا. لن يتمكن الآخرون من رؤية حسابك أو التفاعل معه حتى تكتمل المراجعة.',
    whyTitle: 'لماذا حدث هذا',
    defaultReason: 'مخالفة شروط الاستخدام',
    detailDate: 'تاريخ التقييد',
    detailStatus: 'الحالة',
    detailReference: 'المرجع',
    statusRestricted: 'مقيد',
    statusAppealPending: 'الاعتراض قيد المراجعة',
    statusAppealNone: 'لم يتم تقديم اعتراض',
    appealCta: 'الاعتراض على القرار',
    logoutCta: 'تسجيل الخروج',
    deadlineNote: 'إذا كنت تعتقد أننا ارتكبنا خطأ، يمكنك الاعتراض على القرار خلال 180 يوماً من تاريخ التقييد، وإلا فقد يتم تعطيل حسابك نهائياً.',
    stepIdentity: 'تأكيد هويتك',
    stepIdentityBody: 'للحفاظ على أمان حسابك، يجب إكمال تحقق أمني سريع قبل تقديم الاعتراض.',
    stepOtpTitle: 'أدخل رمز التأكيد',
    stepOtpBody: 'أدخل اسم المستخدم الخاص بك وسنرسل رمزاً مكوناً من 6 أرقام إلى البريد الإلكتروني المرتبط بحسابك.',
    stepOtpSent: 'أدخل الرمز المكون من 6 أرقام الذي أرسلناه إليك.',
    usernamePlaceholder: 'اسم المستخدم',
    sendCode: 'إرسال الرمز',
    sendingCode: 'جاري الإرسال...',
    confirm: 'تأكيد',
    confirming: 'جاري التأكيد...',
    continue: 'متابعة',
    verifying: 'جاري التحقق...',
    back: 'رجوع',
    resendCode: 'إعادة إرسال الرمز',
    resendIn: 'إعادة الإرسال بعد {s} ث',
    stepSelfieTitle: 'التحقق بالصورة',
    stepSelfieBody: 'التقط صورة واضحة لوجهك لتأكيد هويتك. تُستخدم الصورة للمراجعة فقط وتحذف تلقائياً.',
    capture: 'التقاط',
    retake: 'إعادة الالتقاط',
    submitReview: 'إرسال للمراجعة',
    submitting: 'جاري الإرسال...',
    cameraError: 'تعذر الوصول للكاميرا',
    cameraRetry: 'إعادة المحاولة',
    cameraWaiting: 'جاري تشغيل الكاميرا...',
    submittedBadge: 'تم الاستلام',
    submittedTitle: 'تلقينا اعتراضك',
    submittedBody: 'تستغرق المراجعة عادةً أقل من 24 ساعة. سنعلمك بالقرار فور اتخاذه عبر بريدك الإلكتروني.',
    submittedDate: 'تاريخ الاعتراض',
    submittedStatus: 'الحالة',
    submittedStatusValue: 'قيد المراجعة',
    submittedPurge: 'حذف الصورة',
    privacyNote: 'ستحذف صورتك نهائياً من أنظمتنا بعد اكتمال المراجعة ولن تكون مرئية لأي شخص.',
    footerHelp: 'مركز المساعدة',
    footerTerms: 'الشروط',
    footerPrivacy: 'الخصوصية',
    footerAbout: 'حول',
    footerCopyright: '© 2026 Hassani GPT',
    offline: 'لا يوجد اتصال بالإنترنت. سنحاول مجدداً تلقائياً.',
    sessionExpiredTitle: 'انتهت صلاحية الجلسة',
    sessionExpiredBody: 'لم نتمكن من التحقق من هذه الصفحة. سجل الدخول مجدداً لمتابعة حالة حسابك.',
    loginCta: 'تسجيل الدخول',
    retryCta: 'إعادة المحاولة',
    genericError: 'حدث خطأ ما. حاول مجدداً.',
    toastCaptchaRequired: 'يرجى إكمال التحقق البشري',
    toastCaptchaFailed: 'فشل التحقق البشري',
    toastUsernameRequired: 'يرجى إدخال اسم المستخدم',
    toastCodeSent: 'تم إرسال الرمز بنجاح',
    toastCodeWrong: 'الرمز غير صحيح',
    toastCodeIncomplete: 'أدخل الرمز كاملاً',
    toastPhotoRequired: 'التقط صورة أولاً',
    toastNetwork: 'خطأ في الاتصال بالخادم',
    toastLoggedOut: 'تم تسجيل الخروج',
    stepOf: 'الخطوة {current} من {total}'
};

const I18N_EN = {
    appTitle: 'Account notice',
    brand: 'Hassani GPT',
    accountCenter: 'Account center',
    restrictedTitle: 'We restricted your account',
    restrictedOn: 'on {date}',
    restrictedBody: 'Your account does not follow our Community Guidelines. Other people cannot see or interact with your account until the review is complete.',
    whyTitle: 'Why this happened',
    defaultReason: 'Violation of the terms of use',
    detailDate: 'Restriction date',
    detailStatus: 'Status',
    detailReference: 'Reference',
    statusRestricted: 'Restricted',
    statusAppealPending: 'Appeal under review',
    statusAppealNone: 'No appeal submitted',
    appealCta: 'Disagree with decision',
    logoutCta: 'Log out',
    deadlineNote: 'If you think we made a mistake, you can disagree with the decision within 180 days of the restriction date, otherwise your account may be permanently disabled.',
    stepIdentity: 'Confirm your identity',
    stepIdentityBody: 'To keep your account secure, complete a quick security check before submitting an appeal.',
    stepOtpTitle: 'Enter confirmation code',
    stepOtpBody: 'Enter your username and we will send a 6-digit code to the email address linked to your account.',
    stepOtpSent: 'Enter the 6-digit code we sent you.',
    usernamePlaceholder: 'Username',
    sendCode: 'Send code',
    sendingCode: 'Sending...',
    confirm: 'Confirm',
    confirming: 'Confirming...',
    continue: 'Continue',
    verifying: 'Verifying...',
    back: 'Back',
    resendCode: 'Resend code',
    resendIn: 'Resend in {s}s',
    stepSelfieTitle: 'Photo verification',
    stepSelfieBody: 'Take a clear photo of your face to confirm your identity. The photo is only used for review and is deleted automatically.',
    capture: 'Capture',
    retake: 'Retake',
    submitReview: 'Submit for review',
    submitting: 'Submitting...',
    cameraError: 'Camera unavailable',
    cameraRetry: 'Try again',
    cameraWaiting: 'Starting camera...',
    submittedBadge: 'Received',
    submittedTitle: 'We received your appeal',
    submittedBody: 'Reviews usually take less than 24 hours. We will notify you of the decision by email as soon as it is made.',
    submittedDate: 'Appeal date',
    submittedStatus: 'Status',
    submittedStatusValue: 'Under review',
    submittedPurge: 'Photo deletion',
    privacyNote: 'Your photo will be permanently deleted from our systems after the review is complete and will not be visible to anyone.',
    footerHelp: 'Help center',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy',
    footerAbout: 'About',
    footerCopyright: '© 2026 Hassani GPT',
    offline: 'No internet connection. We will retry automatically.',
    sessionExpiredTitle: 'Session expired',
    sessionExpiredBody: 'We could not verify this page. Log in again to continue reviewing your account status.',
    loginCta: 'Log in',
    retryCta: 'Try again',
    genericError: 'Something went wrong. Try again.',
    toastCaptchaRequired: 'Please complete the human verification',
    toastCaptchaFailed: 'Human verification failed',
    toastUsernameRequired: 'Please enter your username',
    toastCodeSent: 'Code sent successfully',
    toastCodeWrong: 'Incorrect code',
    toastCodeIncomplete: 'Enter the full code',
    toastPhotoRequired: 'Take a photo first',
    toastNetwork: 'Network error',
    toastLoggedOut: 'Logged out',
    stepOf: 'Step {current} of {total}'
};

const RESTRICTION_I18N = { ar: I18N_AR, en: I18N_EN };

const RESTRICTION_ENGINE_VERSION = 'v2.1.0';

function mountRestrictionRoutes(app, deps) {
    const { pool, persistentSessions, savePersistentSessions, auditLog, getIP } = deps;
    const mailer = deps.emailService || emailService;
    const hcaptchaVerifier = deps.hcaptchaVerifier || defaultHcaptchaVerifier;
    const distDir = deps.distDir || process.env.RESTRICTION_DIST_DIR || path.join(__dirname, 'restriction-vue', 'dist');
    const distIndex = path.join(distDir, 'index.html');

    app.use((req, res, next) => {
        if (req.path === '/restriction.html' || req.path.startsWith('/restriction.html/') ||
            req.path.startsWith('/api/restriction') || req.path.startsWith('/restriction-assets')) {
            res.set('X-Restriction-Engine', RESTRICTION_ENGINE_VERSION);
        }
        next();
    });

    async function buildBootPayload(req, tokenOverride) {
        let token = tokenOverride || null;
        let entry = token ? readTokenEntry(token) : null;
        let userId = entry ? entry.userId : resolveUserId(req, persistentSessions);
        if (!userId) return null;
        const profile = await fetchRestrictionProfile(pool, userId);
        if (!profile || profile.restricted !== true) return null;
        if (!entry) {
            const issued = issueRestrictionToken(userId);
            token = issued.token;
            profile.reference = issued.reference;
        } else {
            profile.reference = entry.reference;
        }
        return {
            v: 2,
            restricted: true,
            token,
            url: '/restriction.html/' + token,
            cfg: buildRestrictionConfig(),
            profile
        };
    }

    async function sendRestrictionPage(req, res, tokenOverride) {
        res.set('Cache-Control', 'no-store, must-revalidate');
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        if (!fs.existsSync(distIndex)) return res.status(503).send(buildMissingBuildHtml());
        let html = fs.readFileSync(distIndex, 'utf8');
        try {
            const boot = await buildBootPayload(req, tokenOverride);
            if (boot) {
                const json = JSON.stringify(boot).replace(/</g, '\\u003c');
                const tag = '<script>window.__RESTRICTION_BOOT__=' + json + '</script>';
                if (html.indexOf('</head>') !== -1) html = html.replace('</head>', tag + '</head>');
                else html = tag + html;
            }
        } catch (err) {}
        return res.type('html').send(html);
    }

    app.get('/api/restriction/status', async (req, res) => {
        try {
            const userId = resolveUserId(req, persistentSessions);
            if (!userId) return res.json({ success: true, restricted: false });

            const profile = await fetchRestrictionProfile(pool, userId);
            if (!profile) return res.json({ success: true, restricted: false });

            if (profile.restricted === true) {
                const { token, reference } = issueRestrictionToken(userId);
                profile.reference = reference;
                return res.json({
                    success: true,
                    restricted: true,
                    reason: profile.reason,
                    restrictedAt: profile.restrictedAt,
                    appealStatus: profile.appealStatus,
                    appealDate: profile.appealDate,
                    username: profile.username,
                    displayName: profile.displayName,
                    avatar: profile.avatar,
                    token,
                    reference,
                    url: '/restriction.html/' + token,
                    profile
                });
            }

            res.json({
                success: true,
                restricted: false,
                reason: null,
                restrictedAt: null,
                appealStatus: profile.appealStatus,
                appealDate: profile.appealDate,
                username: profile.username,
                displayName: profile.displayName,
                avatar: profile.avatar
            });
        } catch (err) {
            console.error('[restriction/status] error:', err.message);
            res.json({ success: true, restricted: false });
        }
    });

    app.get('/api/restriction/session/:token', async (req, res) => {
        try {
            const entry = readTokenEntry(req.params.token);
            if (!entry) {
                return res.status(404).json({ success: false, error: 'SESSION_EXPIRED' });
            }
            const profile = await fetchRestrictionProfile(pool, entry.userId);
            if (!profile) {
                return res.status(404).json({ success: false, error: 'SESSION_EXPIRED' });
            }
            profile.reference = entry.reference;
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, restricted: profile.restricted === true, profile });
        } catch (err) {
            console.error('[restriction/session] error:', err.message);
            res.status(500).json({ success: false, error: 'SERVER_ERROR' });
        }
    });

    app.post('/api/restriction/token', async (req, res) => {
        try {
            const userId = resolveUserId(req, persistentSessions);
            if (!userId) return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
            const result = await pool.query('SELECT restriction FROM users WHERE id = $1', [userId]);
            if (result.rows.length === 0 || result.rows[0].restriction !== true) {
                return res.status(403).json({ success: false, error: 'NOT_RESTRICTED' });
            }
            const { token, reference } = issueRestrictionToken(userId);
            auditLog && auditLog('RESTRICTION_TOKEN_ISSUED', { userId, ip: getIP ? getIP(req) : req.ip, details: { reference } });
            const profile = await fetchRestrictionProfile(pool, userId);
            if (profile) profile.reference = reference;
            res.json({ success: true, token, reference, url: '/restriction.html/' + token, profile: profile || null });
        } catch (err) {
            console.error('[restriction/token] error:', err.message);
            res.status(500).json({ success: false, error: 'SERVER_ERROR' });
        }
    });

    app.get('/api/restriction/bootstrap', (req, res) => {
        res.set('Cache-Control', 'public, max-age=60');
        const cfg = buildRestrictionConfig();
        res.json({ success: true, ...cfg });
    });

    app.get('/api/restriction/i18n/:locale', (req, res) => {
        const locale = RESTRICTION_I18N[req.params.locale] ? req.params.locale : 'ar';
        res.set('Cache-Control', 'public, max-age=300');
        res.json({
            success: true,
            locale,
            dir: locale === 'ar' ? 'rtl' : 'ltr',
            messages: RESTRICTION_I18N[locale]
        });
    });

    app.get('/api/restriction/heartbeat', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, ok: true, serverTime: new Date().toISOString(), uptime: Math.round(process.uptime()) });
    });

    app.post('/api/restriction/telemetry', (req, res) => {
        try {
            const ip = getIP ? getIP(req) : (req.ip || 'unknown');
            const now = Date.now();
            let rec = telemetryRate.get(ip);
            if (!rec || now > rec.reset) rec = { count: 0, reset: now + 60000 };
            rec.count += 1;
            telemetryRate.set(ip, rec);
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = null; }
            }
            if (rec.count > 240 || !body || !Array.isArray(body.events)) return res.status(204).end();
            const events = body.events.slice(0, 50);
            const significant = new Set(['restriction_page_view', 'restriction_error', 'restriction_appeal_submitted', 'restriction_session_invalid']);
            for (const ev of events) {
                const name = String((ev && ev.event) || '').slice(0, 60);
                if (!name || !significant.has(name)) continue;
                auditLog && auditLog('RESTRICTION_TELEMETRY', {
                    ip,
                    details: { event: name, payload: sanitizeTelemetryPayload(ev.payload) }
                });
            }
            return res.status(204).end();
        } catch (err) {
            return res.status(204).end();
        }
    });

    app.post('/api/restriction/appeal/verify-captcha', async (req, res) => {
        try {
            const { captchaToken } = req.body;
            if (!captchaToken) return res.status(400).json({ success: false, error: 'يرجى إكمال CAPTCHA' });

            const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY;
            if (!HCAPTCHA_SECRET) return res.status(500).json({ success: false, error: 'CAPTCHA غير مُعدّ' });

            const verifyData = await hcaptchaVerifier(captchaToken, HCAPTCHA_SECRET);
            if (!verifyData.success) return res.status(400).json({ success: false, error: 'فشل التحقق البشري' });

            const sessionToken = 'appeal_' + crypto.randomBytes(24).toString('hex');
            appealSessions.set(sessionToken, {
                captchaVerified: true,
                step: 'otp',
                createdAt: Date.now()
            });

            res.json({ success: true, sessionToken, step: 'otp' });
        } catch (err) {
            console.error('[appeal/verify-captcha] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.post('/api/restriction/appeal/send-otp', async (req, res) => {
        try {
            const { sessionToken, username } = req.body;
            console.log(' [restriction] send-otp start username="' + username + '" token=' + (sessionToken ? 'present' : 'missing'));

            if (!sessionToken || !username) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });

            const session = appealSessions.get(sessionToken);
            if (!session || !session.captchaVerified) {
                return res.status(400).json({ success: false, error: 'جلسة غير صالحة' });
            }

            const userResult = await pool.query(
                'SELECT id, username, email, email_verified, is_verified, restriction FROM users WHERE LOWER(username) = LOWER($1)',
                [username.trim()]
            );

            if (userResult.rows.length === 0) {
                session.step = 'otp_fake';
                session.fakeMode = true;
                appealSessions.set(sessionToken, session);
                return res.json({ success: true, step: 'otp' });
            }

            const user = userResult.rows[0];

            const hasEmail = user.email && user.email.trim().length > 0;
            if (!hasEmail) {
                session.step = 'otp_fake';
                session.fakeMode = true;
                appealSessions.set(sessionToken, session);
                return res.json({ success: true, step: 'otp' });
            }

            const otpCode = String(Math.floor(100000 + Math.random() * 900000));
            const otpHash = await bcrypt.hash(otpCode, 10);

            session.userId = user.id;
            session.username = user.username;
            session.email = user.email;
            session.otpHash = otpHash;
            session.otpExpiresAt = Date.now() + 5 * 60 * 1000;
            session.attempts = 0;
            session.fakeMode = false;
            appealSessions.set(sessionToken, session);

            const html = buildAppealOTPEmailHTML(otpCode, user.username);
            const subject = 'رمز الطعن: ' + otpCode;
            const text = 'رمز الطعن الخاص بك: ' + otpCode + ' ينتهي خلال 5 دقائق.';

            const sent = await mailer.send(user.email, subject, html, text);

            console.log(' [restriction] appeal OTP to ' + user.email + ' ' + (sent ? 'sent' : 'failed'));
            res.json({ success: true, step: 'otp' });
        } catch (err) {
            console.error('[appeal/send-otp] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.post('/api/restriction/appeal/verify-otp', async (req, res) => {
        try {
            const { sessionToken, otp } = req.body;
            if (!sessionToken || !otp) return res.status(400).json({ success: false, error: 'الرمز مطلوب' });

            const session = appealSessions.get(sessionToken);
            if (!session || !session.captchaVerified) return res.status(400).json({ success: false, error: 'جلسة غير صالحة' });

            if (session.fakeMode || !session.otpHash) return res.status(400).json({ success: false, error: 'رمز غير صحيح' });
            if (Date.now() > session.otpExpiresAt) return res.status(400).json({ success: false, error: 'انتهت صلاحية الرمز' });

            session.attempts = (session.attempts || 0) + 1;
            if (session.attempts > 5) {
                appealSessions.delete(sessionToken);
                return res.status(429).json({ success: false, error: 'محاولات كثيرة' });
            }

            const match = await bcrypt.compare(String(otp), session.otpHash);
            if (!match) return res.status(400).json({ success: false, error: 'رمز خاطئ (' + (5 - session.attempts) + ' محاولات متبقية)' });

            session.otpVerified = true;
            session.step = 'photo';
            appealSessions.set(sessionToken, session);

            res.json({ success: true, step: 'photo' });
        } catch (err) {
            console.error('[appeal/verify-otp] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.post('/api/restriction/appeal/upload-photo', (req, res) => {
        const uploader = appealPhotoUpload.single('selfie');
        uploader(req, res, async (err) => {
            try {
                if (err) {
                    const msg = err.message === 'NOT_IMAGE' ? 'يرجى رفع صورة فقط' : 'حجم الصورة كبير (الحد 10MB)';
                    return res.status(400).json({ success: false, error: msg });
                }
                if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم إرسال صورة' });

                const { sessionToken } = req.body;
                const session = appealSessions.get(sessionToken);
                if (!session || !session.otpVerified) {
                    try { fs.unlink(req.file.path, () => {}); } catch (e) {}
                    return res.status(403).json({ success: false, error: 'يجب إكمال الخطوات السابقة' });
                }

                const now = new Date();
                const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

                await pool.query(`
                    UPDATE users SET
                        appeal_status = 'pending',
                        appeal_date = $1,
                        appeal_photo_filename = $2,
                        appeal_photo_expires_at = $3
                    WHERE id = $4
                `, [now, req.file.filename, expiresAt, session.userId]);

                auditLog && auditLog('APPEAL_SUBMITTED', {
                    userId: session.userId,
                    ip: getIP ? getIP(req) : req.ip,
                    details: { photo: req.file.filename }
                });

                console.log(' [restriction] appeal submitted by ' + session.username + ' photo=' + req.file.filename);

                appealSessions.delete(sessionToken);

                res.json({
                    success: true,
                    step: 'done',
                    appealDate: now.toISOString(),
                    photoExpiresAt: expiresAt.toISOString()
                });
            } catch (err) {
                console.error('[appeal/upload-photo] error:', err.message);
                if (req.file && req.file.path) try { fs.unlink(req.file.path, () => {}); } catch (e) {}
                res.status(500).json({ success: false, error: 'خطأ في الخادم' });
            }
        });
    });

    app.get('/api/restriction/appeal/status', async (req, res) => {
        try {
            const userId = resolveUserId(req, persistentSessions);
            if (!userId) return res.json({ success: true, appealStatus: 'none' });

            const result = await pool.query(
                'SELECT appeal_status, appeal_date, appeal_photo_expires_at FROM users WHERE id = $1',
                [userId]
            );
            if (result.rows.length === 0) return res.json({ success: true, appealStatus: 'none' });

            const u = result.rows[0];
            res.json({
                success: true,
                appealStatus: u.appeal_status || 'none',
                appealDate: u.appeal_date || null,
                photoExpiresAt: u.appeal_photo_expires_at || null
            });
        } catch (err) {
            console.error('[appeal/status] error:', err.message);
            res.json({ success: true, appealStatus: 'none' });
        }
    });

    app.post('/api/restriction/logout', (req, res) => {
        try {
            const token = req.headers.authorization;
            let authToken = null;
            if (token && token.startsWith('Bearer ')) authToken = token.split(' ')[1];
            else authToken = req.headers['x-session-token'];

            if (authToken && persistentSessions[authToken]) {
                delete persistentSessions[authToken];
                if (typeof savePersistentSessions === 'function') savePersistentSessions(persistentSessions);
            }
            if (req.session) req.session.destroy(() => {});
            res.json({ success: true, redirect: '/login.html' });
        } catch (err) {
            console.error('[restriction/logout] error:', err.message);
            res.json({ success: true, redirect: '/login.html' });
        }
    });

    app.post('/api/restriction/admin/set', async (req, res) => {
        try {
            const { adminSecret, userId, restricted, reason } = req.body;
            const ADMIN_SECRET = process.env.RESTRICTION_ADMIN_SECRET;

            if (!ADMIN_SECRET) return res.status(500).json({ success: false, error: 'RESTRICTION_ADMIN_SECRET غير مُعرّف' });
            if (adminSecret !== ADMIN_SECRET) return res.status(403).json({ success: false, error: 'غير مصرح' });
            if (!userId) return res.status(400).json({ success: false, error: 'userId مطلوب' });

            if (restricted) {
                await pool.query(`
                    UPDATE users SET
                        restriction = TRUE,
                        restriction_reason = $1,
                        restriction_date = NOW(),
                        appeal_status = 'none'
                    WHERE id = $2
                `, [reason || 'مخالفة شروط الاستخدام', userId]);

                if (persistentSessions) {
                    let kicked = 0;
                    for (const [token, session] of Object.entries(persistentSessions)) {
                        if (session.userId === userId) {
                            delete persistentSessions[token];
                            kicked++;
                        }
                    }
                    if (kicked > 0 && typeof savePersistentSessions === 'function') {
                        savePersistentSessions(persistentSessions);
                    }
                    console.log(' [restriction] kicked ' + kicked + ' sessions for user ' + userId);
                }

                auditLog && auditLog('RESTRICTION_ACTIVATED', { userId, reason: reason || 'default', ip: getIP ? getIP(req) : req.ip });
                console.log(' [restriction] user restricted ' + userId + ': ' + (reason || 'default'));
            } else {
                await pool.query(`
                    UPDATE users SET
                        restriction = FALSE,
                        restriction_reason = NULL,
                        restriction_date = NULL,
                        appeal_status = 'none',
                        appeal_photo_filename = NULL,
                        appeal_photo_expires_at = NULL
                    WHERE id = $1
                `, [userId]);

                auditLog && auditLog('RESTRICTION_LIFTED', { userId, ip: getIP ? getIP(req) : req.ip });
                console.log(' [restriction] restriction lifted for user ' + userId);
            }

            res.json({ success: true, userId, restricted });
        } catch (err) {
            console.error('[restriction/admin/set] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.post('/api/restriction/admin/list', async (req, res) => {
        try {
            const { adminSecret } = req.body;
            const ADMIN_SECRET = process.env.RESTRICTION_ADMIN_SECRET;

            if (!ADMIN_SECRET) return res.status(500).json({ success: false, error: 'RESTRICTION_ADMIN_SECRET غير مُعرّف' });
            if (adminSecret !== ADMIN_SECRET) return res.status(403).json({ success: false, error: 'غير مصرح' });

            const result = await pool.query(`
                SELECT id, username, email, restriction_reason, restriction_date,
                       appeal_status, appeal_date, appeal_photo_filename, appeal_photo_expires_at
                FROM users
                WHERE restriction = TRUE OR restriction IS TRUE
                ORDER BY restriction_date DESC
            `);

            res.json({ success: true, users: result.rows });
        } catch (err) {
            console.error('[restriction/admin/list] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.post('/api/restriction/admin/list-all', async (req, res) => {
        try {
            const { adminSecret } = req.body;
            const ADMIN_SECRET = process.env.RESTRICTION_ADMIN_SECRET;

            if (!ADMIN_SECRET) return res.status(500).json({ success: false, error: 'RESTRICTION_ADMIN_SECRET غير مُعرّف' });
            if (adminSecret !== ADMIN_SECRET) return res.status(403).json({ success: false, error: 'غير مصرح' });

            const result = await pool.query(`
                SELECT id, username, email, restriction, restriction_reason, restriction_date, appeal_status
                FROM users
                WHERE onboarding_completed = TRUE
                ORDER BY
                    restriction = TRUE DESC,
                    username ASC
                LIMIT 500
            `);

            res.json({ success: true, users: result.rows });
        } catch (err) {
            console.error('[restriction/admin/list-all] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    app.get('/api/restriction/admin/appeal-photo/:filename', async (req, res) => {
        try {
            const adminSecret = req.headers['x-admin-secret'] || req.query.secret;
            const ADMIN_SECRET = process.env.RESTRICTION_ADMIN_SECRET;

            if (!ADMIN_SECRET || adminSecret !== ADMIN_SECRET) {
                return res.status(403).json({ error: 'غير مصرح' });
            }

            const filename = path.basename(req.params.filename);
            const filePath = path.join(appealPhotoDir, filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'الصورة غير موجودة أو تم حذفها' });
            }

            res.sendFile(filePath);
        } catch (err) {
            console.error('[appeal-photo] error:', err.message);
            res.status(500).json({ error: 'خطأ' });
        }
    });

    if (expressStatic) {
        app.use('/restriction-assets', expressStatic(distDir, {
            index: false,
            fallthrough: true,
            maxAge: '7d',
            immutable: true,
            setHeaders: (res) => {
                res.setHeader('X-Content-Type-Options', 'nosniff');
            }
        }));
    }

    app.get(['/restriction.html', '/restriction.html/'], (req, res) => {
        sendRestrictionPage(req, res, null);
    });
    app.get('/restriction.html/:token', (req, res) => {
        if (!TOKEN_PATTERN.test(req.params.token)) {
            return res.redirect(302, '/restriction.html');
        }
        sendRestrictionPage(req, res, req.params.token);
    });

    console.log(' [restriction] mounted: /status, /session/:token, /token, /bootstrap, /i18n/:locale, /heartbeat, /telemetry, /appeal/*, /admin/*, /restriction.html/:token, /restriction-assets/*');

    return async function requireNotRestricted(req, res, next) {
        const PROTECTED_PAGES = new Set([
            '/messenger1.html', '/3251.html', '/edit-profile.html',
            '/account-center.html', '/reels.html', '/download.html'
        ]);

        if (!PROTECTED_PAGES.has(req.path) && req.path !== '/') return next();
        if (req.method !== 'GET') return next();

        const userId = resolveUserId(req, persistentSessions);
        if (!userId) return next();

        try {
            const result = await pool.query('SELECT restriction FROM users WHERE id = $1', [userId]);
            if (result.rows.length > 0 && result.rows[0].restriction === true) {
                const { token, reference } = issueRestrictionToken(userId);
                console.warn(' [restriction-block] user ' + userId + ' blocked from ' + req.path + ' ref=' + reference);
                auditLog && auditLog('RESTRICTION_REDIRECT', { userId, ip: getIP ? getIP(req) : req.ip, details: { path: req.path, reference } });
                res.set('Cache-Control', 'no-store');
                return res.redirect(302, '/restriction.html/' + token);
            }
        } catch (e) {}
        next();
    };
}

async function requireNotRestricted(req, res, next) {
    next();
}

module.exports = { mountRestrictionRoutes, requireNotRestricted, issueRestrictionToken };
