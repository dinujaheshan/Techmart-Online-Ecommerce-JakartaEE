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

@WebServlet("/register")
public class RegisterServlet extends HttpServlet {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        request.getRequestDispatcher("/signup.jsp").forward(request, response);
    }

    @Override
    @Transactional
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String fullName = request.getParameter("fullName");
        String username = request.getParameter("username");
        String email = request.getParameter("email");
        String password = request.getParameter("password");

        if (email == null || email.trim().isEmpty() ||
            password == null || password.trim().isEmpty()) {
            request.setAttribute("errorMessage", "Email and Password are required for registration.");
            request.getRequestDispatcher("/signup.jsp").forward(request, response);
            return;
        }

        try {
            // Check existing user
            List<User> existing = em.createQuery("SELECT u FROM User u WHERE u.email = :email", User.class)
                                    .setParameter("email", email.trim())
                                    .getResultList();

            if (!existing.isEmpty()) {
                request.setAttribute("errorMessage", "An account with this email address already exists.");
                request.getRequestDispatcher("/signup.jsp").forward(request, response);
                return;
            }

            User user = new User();
            user.setFullName(fullName != null ? fullName.trim() : "");
            user.setUsername(username != null && !username.trim().isEmpty() ? username.trim() : email.trim());
            user.setEmail(email.trim());
            user.setPassword(hashPassword(password));
            user.setRole("CUSTOMER");

            em.persist(user);
            em.flush();

            HttpSession session = request.getSession(true);
            session.setAttribute("user", user);
            session.setAttribute("jspUser", user);
            session.setAttribute("isJspLoggedIn", true);

            response.sendRedirect(request.getContextPath() + "/");
        } catch (Exception e) {
            request.setAttribute("errorMessage", "Registration failed: " + e.getMessage());
            request.getRequestDispatcher("/signup.jsp").forward(request, response);
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

