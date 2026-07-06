<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TechMart | Sign Up</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236366f1'><path d='M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H7c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.66-1.34 3-3 3z'/></svg>">
    <link rel="stylesheet" href="${pageContext.request.contextPath}/index.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <script>
        (function() {
            var savedTheme = localStorage.getItem('techmart_theme') || 'dark';
            document.documentElement.setAttribute('data-theme', savedTheme);
        })();
    </script>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        :root[data-theme="dark"] {
            --bg-body: #0b0f19;
            --bg-gradient: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.15) 0%, transparent 45%),
                           radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.12) 0%, transparent 45%),
                           radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
            --card-bg: rgba(19, 25, 47, 0.85);
            --card-border: rgba(255, 255, 255, 0.1);
            --card-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.1);
            --text-main: #f8fafc;
            --text-title: #ffffff;
            --text-muted: #94a3b8;
            --text-label: #cbd5e1;
            --input-bg: rgba(15, 23, 42, 0.6);
            --input-border: rgba(255, 255, 255, 0.12);
            --input-placeholder: #475569;
            --input-icon: #64748b;
            --accent: #818cf8;
            --btn-bg: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
            --btn-hover: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
            --toggle-bg: rgba(255, 255, 255, 0.1);
            --toggle-color: #fbbf24;
        }
        :root[data-theme="light"] {
            --bg-body: #f8fafc;
            --bg-gradient: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 45%),
                           radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.06) 0%, transparent 45%);
            --card-bg: #ffffff;
            --card-border: #e2e8f0;
            --card-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
            --text-main: #0f172a;
            --text-title: #0f172a;
            --text-muted: #64748b;
            --text-label: #334155;
            --input-bg: #ffffff;
            --input-border: #cbd5e1;
            --input-placeholder: #94a3b8;
            --input-icon: #94a3b8;
            --accent: #4f46e5;
            --btn-bg: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
            --btn-hover: linear-gradient(135deg, #4338ca 0%, #1d4ed8 100%);
            --toggle-bg: rgba(15, 23, 42, 0.06);
            --toggle-color: #475569;
        }
        body {
            background-color: var(--bg-body);
            background-image: var(--bg-gradient);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            padding: 2rem 1rem;
            transition: background 0.3s ease, color 0.3s ease;
        }
        .top-bar {
            width: 100%;
            max-width: 480px;
            display: flex;
            justify-content: flex-end;
            margin-bottom: 0.5rem;
        }
        .theme-toggle-btn {
            background: var(--toggle-bg);
            border: 1px solid var(--card-border);
            color: var(--toggle-color);
            width: 42px;
            height: 42px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .theme-toggle-btn:hover {
            transform: scale(1.08);
        }
        .auth-container {
            width: 100%;
            max-width: 480px;
            margin: auto 0;
        }
        .auth-card {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            box-shadow: var(--card-shadow);
            padding: 2.75rem 2.25rem;
            width: 100%;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .auth-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #6366f1 0%, #3b82f6 50%, #8b5cf6 100%);
        }
        .brand-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .brand-logo-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
            border: 1px solid rgba(99, 102, 241, 0.4);
            border-radius: 16px;
            color: #818cf8;
            margin-bottom: 0.75rem;
            box-shadow: 0 8px 20px rgba(99, 102, 241, 0.2);
        }
        .brand-logo-badge .material-icons {
            font-size: 28px;
        }
        .brand-name {
            font-size: 1.6rem;
            font-weight: 800;
            color: var(--text-title);
            letter-spacing: -0.5px;
            margin-bottom: 0.25rem;
        }
        .brand-name span {
            color: #6366f1;
        }
        .auth-title {
            font-size: 1.35rem;
            font-weight: 700;
            color: var(--accent);
            margin-bottom: 0.35rem;
        }
        .auth-subtitle {
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        .alert {
            padding: 0.85rem 1rem;
            border-radius: 12px;
            font-size: 0.85rem;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }
        .alert-error {
            background-color: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
        }
        .form-group {
            margin-bottom: 1.2rem;
        }
        .form-group label {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-label);
            margin-bottom: 0.45rem;
        }
        .input-wrapper {
            position: relative;
            display: flex;
            align-items: center;
        }
        .input-wrapper .material-icons {
            position: absolute;
            left: 1rem;
            color: var(--input-icon);
            font-size: 20px;
            pointer-events: none;
            transition: color 0.2s ease;
        }
        .form-input {
            width: 100%;
            padding: 0.85rem 1rem 0.85rem 2.8rem;
            border: 1.5px solid var(--input-border);
            border-radius: 14px;
            background: var(--input-bg);
            color: var(--text-main);
            font-size: 0.95rem;
            font-family: inherit;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .form-input::placeholder {
            color: var(--input-placeholder);
        }
        .form-input:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
        }
        .input-wrapper:focus-within .material-icons {
            color: var(--accent);
        }
        .btn-signup {
            width: 100%;
            height: 50px;
            background: var(--btn-bg);
            color: #ffffff;
            border: none;
            border-radius: 14px;
            font-size: 0.975rem;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            transition: all 0.25s ease;
            margin-top: 0.5rem;
        }
        .btn-signup:hover {
            background: var(--btn-hover);
            box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.6);
            transform: translateY(-2px);
        }
        .btn-signup:active {
            transform: translateY(0);
        }
        .auth-footer {
            text-align: center;
            margin-top: 1.75rem;
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        .auth-footer a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 700;
        }
        .auth-footer a:hover {
            text-decoration: underline;
        }
        .page-footer {
            margin-top: 2rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--text-muted);
            font-weight: 600;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>

    <div class="top-bar">
        <button id="themeToggleBtn" class="theme-toggle-btn" title="Toggle Light/Dark Theme">
            <span class="material-icons" id="themeIcon">light_mode</span>
        </button>
    </div>

    <div class="auth-container">
        <div class="auth-card">
            <div class="brand-header">
                <div class="brand-logo-badge">
                    <span class="material-icons">person_add_alt</span>
                </div>
                <div class="brand-name">Tech<span>Mart</span></div>
                <h1 class="auth-title">Create Account</h1>
                <p class="auth-subtitle">Join TechMart today to start shopping smart</p>
            </div>

            <%-- Error Messages --%>
            <% if (request.getAttribute("errorMessage") != null) { %>
                <div class="alert alert-error">
                    <span class="material-icons" style="font-size: 18px;">error_outline</span>
                    <%= request.getAttribute("errorMessage") %>
                </div>
            <% } %>

            <form action="${pageContext.request.contextPath}/register" method="post">
                <div class="form-group">
                    <label for="fullName">Full Name</label>
                    <div class="input-wrapper">
                        <span class="material-icons">badge</span>
                        <input type="text" id="fullName" name="fullName" class="form-input" 
                               placeholder="e.g. Alex Morgan" required autocomplete="name">
                    </div>
                </div>

                <div class="form-group">
                    <label for="username">Username</label>
                    <div class="input-wrapper">
                        <span class="material-icons">alternate_email</span>
                        <input type="text" id="username" name="username" class="form-input" 
                               placeholder="e.g. alexm" required autocomplete="username">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <div class="input-wrapper">
                        <span class="material-icons">mail_outline</span>
                        <input type="email" id="email" name="email" class="form-input" 
                               placeholder="alex@example.com" required autocomplete="email">
                    </div>
                </div>

                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="input-wrapper">
                        <span class="material-icons">lock_open</span>
                        <input type="password" id="password" name="password" class="form-input" 
                               placeholder="Min. 6 characters" required autocomplete="new-password">
                    </div>
                </div>

                <button type="submit" class="btn-signup">
                    Create Account
                    <span class="material-icons" style="font-size: 18px;">arrow_forward</span>
                </button>
            </form>

            <div class="auth-footer">
                Already have an account? <a href="${pageContext.request.contextPath}/signin.jsp">Sign In</a>
            </div>
        </div>
    </div>

    <div class="page-footer">
        TechMart Online &bull; Premium Electronics Shopping
    </div>

    <script>
        const themeBtn = document.getElementById('themeToggleBtn');
        const themeIcon = document.getElementById('themeIcon');

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('techmart_theme', theme);
            themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        }

        const initialTheme = localStorage.getItem('techmart_theme') || 'dark';
        applyTheme(initialTheme);

        themeBtn.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    </script>
</body>
</html>
