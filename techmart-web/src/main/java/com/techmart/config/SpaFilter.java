package com.techmart.config;

import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;

@WebFilter("/*")
public class SpaFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestURI = httpRequest.getRequestURI();
        String contextPath = httpRequest.getContextPath();
        String path = requestURI.substring(contextPath.length());

        String lowerPath = path.toLowerCase();
        // Allow REST API endpoints (/api/*), JSP pages, Servlets (/login, /register, /logout) and static resources to pass through normally
        if (path.startsWith("/api") ||
            path.startsWith("/login") ||
            path.startsWith("/register") ||
            path.startsWith("/logout") ||
            path.startsWith("/signin") ||
            path.startsWith("/signup") ||
            path.startsWith("/forgot-password") ||
            lowerPath.contains(".jsp") ||
            lowerPath.endsWith(".js") ||
            lowerPath.endsWith(".css") ||
            lowerPath.endsWith(".html") ||
            lowerPath.endsWith(".jpg") ||
            lowerPath.endsWith(".jpeg") ||
            lowerPath.endsWith(".png") ||
            lowerPath.endsWith(".gif") ||
            lowerPath.endsWith(".svg") ||
            lowerPath.endsWith(".ico") ||
            lowerPath.endsWith(".woff") ||
            lowerPath.endsWith(".woff2") ||
            lowerPath.endsWith(".ttf")) {
            chain.doFilter(request, response);
            return;
        }

        // Forward SPA client view routes (/products, /cart, /admin, /profile, etc.) to index.html
        request.getRequestDispatcher("/index.html").forward(request, response);
    }
}
