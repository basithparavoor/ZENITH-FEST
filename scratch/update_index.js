const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Add FontAwesome
if (!html.includes('cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css')) {
    html = html.replace(
        '<link rel="alternate icon" href="favicon.png">',
        '<link rel="alternate icon" href="favicon.png">\r\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">'
    );
}

// 2. Add Badge & Modal Footer styles in style section
const extraStyles = `
        /* --- STANDARD APP DOWNLOAD BADGE BUTTON --- */
        .login-app-badge-btn {
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            width: 100%;
            padding: 0.75rem 1.15rem;
            background: #0F172A;
            border: 1px solid #1E293B;
            border-radius: 14px;
            color: #FFFFFF;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.15);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            box-sizing: border-box;
        }
        .login-app-badge-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
            border-color: #334155;
            background: #020617;
        }
        .login-app-badge-btn:active {
            transform: scale(0.98);
        }
        .app-badge-icon-box {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: rgba(16, 185, 129, 0.15);
            color: #10B981;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.35rem;
            flex-shrink: 0;
            transition: transform 0.25s ease;
        }
        .login-app-badge-btn:hover .app-badge-icon-box {
            transform: scale(1.08);
        }
        .app-badge-content {
            display: flex;
            flex-direction: column;
            text-align: left;
            flex: 1;
            min-width: 0;
        }
        .app-badge-eyebrow {
            font-size: 0.62rem;
            font-weight: 700;
            color: #94A3B8;
            letter-spacing: 0.06em;
            line-height: 1.1;
        }
        .app-badge-headline {
            font-size: 0.92rem;
            font-weight: 700;
            color: #F8FAFC;
            letter-spacing: -0.01em;
            margin-top: 2px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .app-badge-action {
            color: #10B981;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.25s ease;
        }
        .login-app-badge-btn:hover .app-badge-action {
            transform: translateY(2px);
        }

        /* Modal Footer Buttons Fix for index.html */
        .festos-app-footer-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            padding: 0.6rem 1.25rem !important;
            font-size: 0.85rem !important;
            font-weight: 700 !important;
            border-radius: 10px !important;
            cursor: pointer !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
            border: 1px solid #CBD5E1 !important;
            background: #FFFFFF !important;
            color: #334155 !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
            line-height: 1.2 !important;
            outline: none !important;
            text-decoration: none !important;
        }
        .festos-app-footer-btn:hover {
            background: #F1F5F9 !important;
            border-color: #94A3B8 !important;
            color: #0F172A !important;
            transform: translateY(-1px) !important;
        }
        .festos-app-footer-btn.btn-close {
            background: #F1F5F9 !important;
            border-color: #E2E8F0 !important;
            color: #475569 !important;
        }
        .festos-app-footer-btn.btn-close:hover {
            background: #E2E8F0 !important;
            color: #0F172A !important;
        }
`;

if (!html.includes('.login-app-badge-btn')) {
    html = html.replace('</style>', extraStyles + '\r\n    </style>');
}

// 3. Replace the app download button markup
const oldButtonRegex = /<div style="margin-top: 1\.25rem; text-align: center;" id="login-app-download-wrap">[\s\S]*?<\/div>/;
const newButtonMarkup = `<div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(226, 232, 240, 0.8); text-align: center;" id="login-app-download-wrap">
            <button type="button" class="login-app-badge-btn" onclick="festosAppUpdate.openModal()">
                <div class="app-badge-icon-box">
                    <i class="fa-brands fa-android"></i>
                </div>
                <div class="app-badge-content">
                    <span class="app-badge-eyebrow">OFFICIAL ANDROID APP</span>
                    <span class="app-badge-headline" id="login-app-download-label">Download APK</span>
                </div>
                <div class="app-badge-action">
                    <i class="fa-solid fa-cloud-arrow-down"></i>
                </div>
            </button>
        </div>`;

if (oldButtonRegex.test(html)) {
    html = html.replace(oldButtonRegex, newButtonMarkup);
    console.log('Replaced app download button markup.');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated successfully.');
