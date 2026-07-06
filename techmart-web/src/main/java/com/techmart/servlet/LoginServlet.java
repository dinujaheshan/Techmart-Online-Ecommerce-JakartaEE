package com.techmart.servlet;

import com.techmart.domain.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.util.List;

@WebServlet("/login")
public class LoginServlet extends HttpServlet {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("techmart_remember_email".equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isEmpty()) {
                    request.setAttribute("rememberEmail", cookie.getValue());
                    request.setAttribute("rememberChecked", true);
                    break;
                }
            }
        }
        request.getRequestDispatcher("/signin.jsp").forward(request, response);
    }

    @Override
    @Transactional
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String emailOrUsername = request.getParameter("email");
        String password = request.getParameter("password");
        String rememberMe = request.getParameter("rememberMe");

        if (emailOrUsername == null || emailOrUsername.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {
            request.setAttribute("errorMessage", "Email/Username and Password are required.");
            request.getRequestDispatcher("/signin.jsp").forward(request, response);
            return;
        }

        try {
            List<User> users = em.createQuery("SELECT u FROM User u WHERE u.email = :key OR u.username = :key", User.class)
                                 .setParameter("key", emailOrUsername.trim())
                                 .getResultList();

            if (!users.isEmpty()) {
                User user = users.get(0);
                String hashedInput = hashPassword(password);
                if (user.getPassword() != null && (user.getPassword().equals(password) || user.getPassword().equals(hashedInput))) {
                    HttpSession session = request.getSession(true);
                    session.setAttribute("user", user);
                    session.setAttribute("jspUser", user);
                    session.setAttribute("isJspLoggedIn", true);

                    // Handle Remember Me Cookie
                    String cookiePath = request.getContextPath().isEmpty() ? "/" : request.getContextPath();
                    if (rememberMe != null && !rememberMe.isEmpty()) {
                        Cookie rememberCookie = new Cookie("techmart_remember_email", emailOrUsername.trim());
                        rememberCookie.setMaxAge(30 * 24 * 60 * 60); // 30 days
                        rememberCookie.setPath(cookiePath);
                        response.addCookie(rememberCookie);
                    } else {
                        Cookie rememberCookie = new Cookie("techmart_remember_email", "");
                        rememberCookie.setMaxAge(0);
                        rememberCookie.setPath(cookiePath);
                        response.addCookie(rememberCookie);
                    }

                    response.sendRedirect(request.getContextPath() + "/");
                    return;
                }
            }

            request.setAttribute("errorMessage", "Invalid credentials. Please check your email and password.");
            request.getRequestDispatcher("/signin.jsp").forward(request, response);
        } catch (Exception e) {
            request.setAttribute("errorMessage", "An error occurred during authentication: " + e.getMessage());
            request.getRequestDispatcher("/signin.jsp").forward(request, response);
        }
    }

    private String hashPassword(String plainTextPassword) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(plainTextPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            return plainTextPassword;
        }
    }
}

