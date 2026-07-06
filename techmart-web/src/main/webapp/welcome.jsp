<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<%@ page import="com.techmart.domain.User" %>
<%
    User user = (User) session.getAttribute("jspUser");
    Boolean isLoggedIn = (Boolean) session.getAttribute("isJspLoggedIn");
    if (user == null || isLoggedIn == null || !isLoggedIn) {
        response.sendRedirect(request.getContextPath() + "/signin.jsp");
        return;
    }
%>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome - TechMart JSP Dashboard</title>
    <link rel="stylesheet" href="${pageContext.request.contextPath}/index.css">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <style>
        body {
            background-color: var(--bg-main);
            color: var(--text-main);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            font-family: 'Inter', system-ui, sans-serif;
        }
        .welcome-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: var(--shadow-lg);
            width: 100%;
            max-width: 540px;
            padding: 2.5rem;
            box-sizing: border-box;
            text-align: center;
        }
        .user-avatar-lg {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            font-weight: 700;
            margin: 0 auto 1.5rem auto;
        }
        .badge-jsp {
            background: rgba(99, 102, 241, 0.2);
            color: #818cf8;
            border: 1px solid rgba(99, 102, 241, 0.4);
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 1rem;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5rem 0;
            text-align: left;
        }
        .info-table td {
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border);
            font-size: 0.9rem;
        }
        .btn-group {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 2rem;
        }
    </style>
</head>
<body>

    <div class="welcome-card">
        <span class="badge-jsp">Authenticated via Jakarta JSP & Servlet</span>
        
        <div class="user-avatar-lg">
            <%= (user.getFullName() != null && !user.getFullName().isEmpty()) ? user.getFullName().substring(0, 1).toUpperCase() : user.getUsername().substring(0, 1).toUpperCase() %>
        </div>

        <h2 style="margin: 0 0 0.5rem 0;">Welcome, <%= user.getFullName() != null && !user.getFullName().isEmpty() ? user.getFullName() : user.getUsername() %>!</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">Your JSP Session authentication was successful.</p>

        <% if ("true".equals(request.getParameter("registered"))) { %>
            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem; margin-top: 1rem;">
                Account successfully created and persisted to JPA database!
            </div>
        <% } %>

        <table class="info-table">
            <tr>
                <td style="color: var(--text-muted); font-weight: 600; width: 35%;">User ID:</td>
                <td><strong>#<%= user.getId() != null ? user.getId() : "1" %></strong></td>
            </tr>
            <tr>
                <td style="color: var(--text-muted); font-weight: 600;">Email Address:</td>
                <td><%= user.getEmail() %></td>
            </tr>
            <tr>
                <td style="color: var(--text-muted); font-weight: 600;">Username:</td>
                <td><code><%= user.getUsername() %></code></td>
            </tr>
            <tr>
                <td style="color: var(--text-muted); font-weight: 600;">Role:</td>
                <td><span style="background: var(--primary); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700;"><%= user.getRole() != null ? user.getRole() : "CUSTOMER" %></span></td>
            </tr>
        </table>

        <div class="btn-group">
            <a href="${pageContext.request.contextPath}/" class="btn btn-primary" style="text-decoration:none; padding:0.75rem 1.2rem;">Go to Storefront</a>
            <a href="${pageContext.request.contextPath}/logout" class="btn btn-outline-danger" style="text-decoration:none; padding:0.75rem 1.2rem;">Logout (JSP)</a>
        </div>
    </div>

</body>
</html>
