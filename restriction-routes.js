// ═══════════════════════════════════════════════════════════════════════════
//  RESTRICTION MODULE — نظام تقييد الحسابات (مثل Instagram)
// ═══════════════════════════════════════════════════════════════════════════
//
// المسارات:
//   GET  /api/restriction/status            → فحص حالة التقييد
//   POST /api/restriction/appeal/verify-captcha  → الخطوة 1: hCaptcha
//   POST /api/restriction/appeal/send-otp        → الخطوة 2: إرسال OTP للبريد
//   POST /api/restriction/appeal/verify-otp       → الخطوة 3: التحقق من OTP
//   POST /api/restriction/appeal/upload-photo     → الخطوة 4: رفع صورة السيلفي
//   GET  /api/restriction/appeal/status           → حالة الطعن الحالية
//   POST /api/restriction/logout                  → تسجيل خروج من حساب مقيّد
//   POST /api/restriction/admin/set               → (أدمن) تفعيل/إلغاء التقييد
//
// متغيرات البيئة المطلوبة:
//   RESTRICTION_ADMIN_SECRET = كلمة سر سرية للأدمن (مطلوب)
//   HCAPTCHA_SECRET_KEY      = مفتاح hCaptcha (موجود بالفعل)
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch (e) { bcrypt = require('bcrypt'); }
const jwt = require('jsonwebtoken');

//  خدمة البريد المركزية — مستقلة تماماً
const emailService = require('./email-service');

//  مجلد رفع صور الطعون
const appealPhotoDir = path.join(__dirname, 'uploads', 'appeals');
if (!fs.existsSync(appealPhotoDir)) {
    fs.mkdirSync(appealPhotoDir, { recursive: true });
}

//  Multer لرفع صورة السيلفي
const appealPhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, appealPhotoDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'appeal-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    }
});
const appealPhotoUpload = multer({
    storage: appealPhotoStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('NOT_IMAGE'));
    }
});

//  تخزين مؤقت لـ appeal sessions
const appealSessions = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of appealSessions.entries()) {
        if (now - data.createdAt > 30 * 60 * 1000) appealSessions.delete(token);
    }
}, 5 * 60 * 1000);

//  تنظيف صور الطعون بعد 12 ساعة
setInterval(() => {
    try {
        const files = fs.readdirSync(appealPhotoDir);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(appealPhotoDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 12 * 60 * 60 * 1000) { // 12 ساعة
                fs.unlink(filePath, () => {});
                console.log(` [restriction] حذف صورة طعن قديمة: ${file}`);
            }
        });
    } catch (e) {}
}, 60 * 60 * 1000); // كل ساعة

// ═══════════════════════════════════════════════════════════════════════════
//  قالب بريد OTP للطعن
// ═══════════════════════════════════════════════════════════════════════════
function buildAppealOTPEmailHTML(code, username) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>رمز الطعن - Hassani GPT</title>
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

// ═══════════════════════════════════════════════════════════════════════════
//  الدالة الرئيسية
// ═══════════════════════════════════════════════════════════════════════════
function mountRestrictionRoutes(app, deps) {
    const { pool, nodemailer, persistentSessions, savePersistentSessions, auditLog, getIP, PUBLIC_URL } = deps;

    // ═══════════════════════════════════════════════════════════════════════
    // 0) GET /api/restriction/status — فحص حالة التقييد
    // ═══════════════════════════════════════════════════════════════════════
    app.get('/api/restriction/status', async (req, res) => {
        try {
            let userId = null;
            let token = req.headers.authorization;
            if (token && token.startsWith('Bearer ')) token = token.split(' ')[1];
            else token = req.headers['x-session-token'];

            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');
                    if (decoded && decoded.userId) userId = decoded.userId;
                } catch (_) {}
                if (!userId && persistentSessions && persistentSessions[token]) {
                    userId = persistentSessions[token].userId;
                }
            }
            if (req.session && req.session.userId) userId = req.session.userId;

            if (!userId) return res.json({ success: true, restricted: false });

            const result = await pool.query(
                'SELECT restriction, restriction_reason, restriction_date, appeal_status, appeal_date FROM users WHERE id = $1',
                [userId]
            );
            if (result.rows.length === 0) return res.json({ success: true, restricted: false });

            const user = result.rows[0];
            res.json({
                success: true,
                restricted: user.restriction === true,
                reason: user.restriction_reason || null,
                restrictedAt: user.restriction_date || null,
                appealStatus: user.appeal_status || 'none',
                appealDate: user.appeal_date || null
            });
        } catch (err) {
            console.error('[restriction/status] error:', err.message);
            res.json({ success: true, restricted: false });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 1) POST /api/restriction/appeal/verify-captcha — الخطوة 1: hCaptcha
    // ═══════════════════════════════════════════════════════════════════════
    app.post('/api/restriction/appeal/verify-captcha', async (req, res) => {
        try {
            const { captchaToken } = req.body;
            if (!captchaToken) return res.status(400).json({ success: false, error: 'يرجى إكمال CAPTCHA' });

            const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY;
            if (!HCAPTCHA_SECRET) return res.status(500).json({ success: false, error: 'CAPTCHA غير مُعدّ' });

            const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `response=${encodeURIComponent(captchaToken)}&secret=${encodeURIComponent(HCAPTCHA_SECRET)}`
            });
            const verifyData = await verifyRes.json();
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

    // ═══════════════════════════════════════════════════════════════════════
    // 2) POST /api/restriction/appeal/send-otp — الخطوة 2: إرسال OTP للبريد
    // ═══════════════════════════════════════════════════════════════════════
    app.post('/api/restriction/appeal/send-otp', async (req, res) => {
        try {
            const { sessionToken, username } = req.body;
            console.log(` [restriction] send-otp بدأ — username: "${username}" | sessionToken: ${sessionToken ? 'موجود' : 'مفقود'}`);

            if (!sessionToken || !username) return res.status(400).json({ success: false, error: 'بيانات ناقصة' });

            const session = appealSessions.get(sessionToken);
            if (!session || !session.captchaVerified) {
                console.log(` [restriction] جلسة غير صالحة — session exists: ${!!session}`);
                return res.status(400).json({ success: false, error: 'جلسة غير صالحة' });
            }

            //  ابحث عن المستخدم بـ username فقط (بدون restriction = TRUE)
            // المستخدم على صفحة الطعن أصلاً، فلا داعي للفحص مرة أخرى
            const userResult = await pool.query(
                'SELECT id, username, email, email_verified, is_verified, restriction FROM users WHERE LOWER(username) = LOWER($1)',
                [username.trim()]
            );

            console.log(` [restriction] نتائج البحث: ${userResult.rows.length} مستخدم`);

            if (userResult.rows.length === 0) {
                console.log(` [restriction]  username غير موجود: "${username}"`);
                session.step = 'otp_fake';
                session.fakeMode = true;
                appealSessions.set(sessionToken, session);
                return res.json({ success: true, step: 'otp' });
            }

            const user = userResult.rows[0];
            console.log(` [restriction]  مستخدم موجود: ${user.username} | بريد: ${user.email} | restriction: ${user.restriction} | email_verified: ${user.email_verified} | is_verified: ${user.is_verified}`);

            const hasEmail = user.email && user.email.trim().length > 0;
            if (!hasEmail) {
                console.log(` [restriction]  لا يوجد بريد لهذا المستخدم`);
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

            console.log(` [restriction] مستخدم موجود: ${user.username} | بريد: ${user.email} | email_verified: ${user.email_verified} | is_verified: ${user.is_verified}`);

            // أرسل البريد عبر خدمة البريد المركزية
            const html = buildAppealOTPEmailHTML(otpCode, user.username);
            const subject = `رمز الطعن: ${otpCode} — Hassani GPT`;
            const text = `رمز الطعن الخاص بك: ${otpCode}\n\nينتهي خلال 5 دقائق.`;

            const sent = await emailService.send(user.email, subject, html, text);

            console.log(` [restriction] إرسال OTP طعن إلى ${user.email} — ${sent ? ' نجح' : ' فشل'}`);
            res.json({ success: true, step: 'otp' });
        } catch (err) {
            console.error('[appeal/send-otp] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 3) POST /api/restriction/appeal/verify-otp — الخطوة 3: التحقق من OTP
    // ═══════════════════════════════════════════════════════════════════════
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
            if (!match) return res.status(400).json({ success: false, error: `رمز خاطئ (${5 - session.attempts} محاولات متبقية)` });

            session.otpVerified = true;
            session.step = 'photo';
            appealSessions.set(sessionToken, session);

            res.json({ success: true, step: 'photo' });
        } catch (err) {
            console.error('[appeal/verify-otp] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4) POST /api/restriction/appeal/upload-photo — الخطوة 4: رفع صورة السيلفي
    // ═══════════════════════════════════════════════════════════════════════
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

                //  احفظ الطعن في DB
                const now = new Date();
                const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 ساعة

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

                console.log(` [restriction] تم تقديم طعن من ${session.username} — صورة: ${req.file.filename}`);

                // احذف الـ appeal session
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

    // ═══════════════════════════════════════════════════════════════════════
    // 5) GET /api/restriction/appeal/status — حالة الطعن
    // ═══════════════════════════════════════════════════════════════════════
    app.get('/api/restriction/appeal/status', async (req, res) => {
        try {
            let userId = null;
            let token = req.headers.authorization;
            if (token && token.startsWith('Bearer ')) token = token.split(' ')[1];
            else token = req.headers['x-session-token'];
            if (token) {
                try { const d = jwt.verify(token, process.env.JWT_SECRET || 'fallback'); if (d) userId = d.userId; } catch (_) {}
                if (!userId && persistentSessions && persistentSessions[token]) userId = persistentSessions[token].userId;
            }
            if (req.session && req.session.userId) userId = req.session.userId;
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

    // ═══════════════════════════════════════════════════════════════════════
    // 6) POST /api/restriction/logout — تسجيل خروج من حساب مقيّد
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // 7) POST /api/restriction/admin/set — (أدمن) تفعيل/إلغاء التقييد
    //    body: { adminSecret, userId, restricted, reason? }
    // ═══════════════════════════════════════════════════════════════════════
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

                //  طرد المستخدم من كل جلساته النشطة
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
                    console.log(` [restriction] تم طرد ${kicked} جلسة للمستخدم ${userId}`);
                }

                auditLog && auditLog('RESTRICTION_ACTIVATED', { userId, reason: reason || 'default', ip: getIP ? getIP(req) : req.ip });
                console.log(` [restriction] تم تقييد المستخدم ${userId}: ${reason || 'default'}`);
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
                console.log(` [restriction] تم رفع التقييد عن المستخدم ${userId}`);
            }

            res.json({ success: true, userId, restricted });
        } catch (err) {
            console.error('[restriction/admin/set] error:', err.message);
            res.status(500).json({ success: false, error: 'خطأ في الخادم' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 8) POST /api/restriction/admin/list — (أدمن) قائمة المستخدمين المقيّدين
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // 9) POST /api/restriction/admin/list-all — (أدمن) قائمة كل المستخدمين
    // ═══════════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════════
    // 10) GET /api/restriction/admin/appeal-photo/:filename — (أدمن) عرض صورة طعن
    // ═══════════════════════════════════════════════════════════════════════
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

    console.log(' [restriction] تم تركيب المسارات: /status, /appeal/*, /admin/set, /admin/list, /admin/list-all, /admin/appeal-photo');

    // ═══════════════════════════════════════════════════════════════════════
    //  Middleware: منع المستخدمين المقيّدين من الوصول للمنصة
    // (معرّف داخل mountRestrictionRoutes ليمدّه بـ pool و persistentSessions)
    // ═══════════════════════════════════════════════════════════════════════
    return async function requireNotRestricted(req, res, next) {
        const PROTECTED_PAGES = new Set([
            '/messenger1.html', '/3251.html', '/edit-profile.html',
            '/account-center.html', '/reels.html', '/download.html'
        ]);

        if (!PROTECTED_PAGES.has(req.path) && req.path !== '/') return next();
        if (req.method !== 'GET') return next();

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

        if (!userId) return next();

        try {
            const result = await pool.query('SELECT restriction FROM users WHERE id = $1', [userId]);
            if (result.rows.length > 0 && result.rows[0].restriction === true) {
                console.warn(` [restriction-block] ${userId} حاول الوصول لـ ${req.path}`);
                return res.redirect('/restriction.html');
            }
        } catch (e) {
            // في حال فشل DB، اسمح بالمرور (آمن)
        }
        next();
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//  middleware افتراضي (قبل mount — يسمح بمرور كل شيء)
// ═══════════════════════════════════════════════════════════════════════════
async function requireNotRestricted(req, res, next) {
    next();
}

module.exports = { mountRestrictionRoutes, requireNotRestricted };
