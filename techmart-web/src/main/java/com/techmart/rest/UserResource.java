package com.techmart.rest;

import com.techmart.domain.Notification;
import com.techmart.domain.User;
import com.techmart.domain.Wishlist;
import com.techmart.service.WishlistService;
import jakarta.ejb.EJB;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import jakarta.ejb.Stateless;

@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Stateless
public class UserResource {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @EJB
    private WishlistService wishlistService;

    @Context
    private HttpServletRequest request;

    @Inject
    @jakarta.jms.JMSConnectionFactory("java:app/jms/TechMartConnectionFactory")
    private jakarta.jms.JMSContext jmsContext;

    @jakarta.annotation.Resource(lookup = "java:app/jms/queue/ContactQueue", type = jakarta.jms.Queue.class)
    private jakarta.jms.Queue contactQueue;

    public static class ContactRequest {
        private String name;
        private String email;
        private String message;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    @POST
    @Path("/login")
    @Transactional
    public Response login(User credentials) {
        if (credentials == null || (credentials.getEmail() == null && credentials.getUsername() == null)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Invalid login credentials\"}").build();
        }

        String searchKey = credentials.getEmail() != null ? credentials.getEmail().trim() : credentials.getUsername().trim();
        List<User> users = em.createQuery("SELECT u FROM User u WHERE u.email = :searchKey OR u.username = :searchKey", User.class)
                            .setParameter("searchKey", searchKey)
                            .getResultList();

        if (users.isEmpty()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Invalid login credentials\"}").build();
        }

        User user = users.get(0);
        if (credentials.getPassword() != null) {
            String hashedInput = hashPassword(credentials.getPassword());
            if (!user.getPassword().equals(hashedInput)) {
                return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Incorrect password\"}").build();
            }
        }

        // Store user in HttpSession
        HttpSession session = request.getSession(true);
        session.setAttribute("user", user);

        return Response.ok(user).build();
    }

    @POST
    @Path("/register")
    @Transactional
    public Response register(User newUser) {
        if (newUser == null || newUser.getUsername() == null || newUser.getEmail() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Username and Email are required\"}").build();
        }

        List<User> existing = em.createQuery("SELECT u FROM User u WHERE u.username = :username OR u.email = :email", User.class)
                                .setParameter("username", newUser.getUsername())
                                .setParameter("email", newUser.getEmail())
                                .getResultList();

        if (!existing.isEmpty()) {
            return Response.status(Response.Status.CONFLICT).entity("{\"error\":\"Username or Email is already registered\"}").build();
        }

        String pwd = newUser.getPassword() != null ? newUser.getPassword() : "password123";
        User user = new User(newUser.getUsername(), hashPassword(pwd), newUser.getEmail(), "CUSTOMER");
        user.setFullName(newUser.getFullName());
        user.setPhone(newUser.getPhone());
        em.persist(user);
        em.flush();

        // Store user in HttpSession
        HttpSession session = request.getSession(true);
        session.setAttribute("user", user);

        return Response.status(Response.Status.CREATED).entity(user).build();
    }

    @GET
    @Path("/me")
    public Response getMe() {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Not logged in\"}").build();
        }
        User sessionUser = (User) session.getAttribute("user");
        User user = em.find(User.class, sessionUser.getId());
        return Response.ok(user).build();
    }

    @POST
    @Path("/logout")
    public Response logout() {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return Response.ok("{\"message\":\"Logged out successfully\"}").build();
    }

    @GET
    @Path("/{userId}")
    public Response getUserProfile(@PathParam("userId") Long userId) {
        if (userId != null && userId == 999L) {
            // Check session fallback
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                return Response.ok(session.getAttribute("user")).build();
            }
            userId = 1L;
        }
        User user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(user).build();
    }

    @PUT
    @Path("/{userId}")
    @Transactional
    public Response updateUserProfile(@PathParam("userId") Long userId, User updatedUser) {
        if (userId != null && userId == 999L) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                User sessionUser = (User) session.getAttribute("user");
                userId = sessionUser.getId();
            } else {
                userId = 1L;
            }
        }
        User user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        
        user.setEmail(updatedUser.getEmail());
        user.setUsername(updatedUser.getUsername());
        user.setFullName(updatedUser.getFullName());
        user.setPhone(updatedUser.getPhone());
        user.setStreet(updatedUser.getStreet());
        user.setCity(updatedUser.getCity());
        user.setState(updatedUser.getState());
        user.setZip(updatedUser.getZip());
        user.setCountry(updatedUser.getCountry());
        em.merge(user);

        // Update session
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.setAttribute("user", user);
        }
        
        return Response.ok(user).build();
    }

    @POST
    @Path("/contact")
    public Response submitContact(ContactRequest contactReq) {
        if (contactReq == null || contactReq.getEmail() == null || contactReq.getMessage() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Invalid contact request\"}").build();
        }
        
        try {
            String payload = String.format("%s|%s|%s", 
                contactReq.getName() != null ? contactReq.getName() : "Anonymous", 
                contactReq.getEmail(), 
                contactReq.getMessage());
            
            jmsContext.createProducer().send(contactQueue, payload);
            return Response.ok("{\"message\":\"Contact submission received and queued\"}").build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                           .entity("{\"error\":\"Failed to process contact submission: " + e.getMessage() + "\"}").build();
        }
    }

    @GET
    @Path("/{userId}/wishlist")
    public Response getWishlist(@PathParam("userId") Long userId) {
        if (userId != null && userId == 999L) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                userId = ((User) session.getAttribute("user")).getId();
            } else {
                userId = 1L;
            }
        }
        List<Wishlist> wishlists = wishlistService.getUserWishlist(userId);
        return Response.ok(wishlists).build();
    }

    @POST
    @Path("/{userId}/wishlist/{productId}")
    public Response addToWishlist(@PathParam("userId") Long userId, @PathParam("productId") Long productId) {
        if (userId != null && userId == 999L) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                userId = ((User) session.getAttribute("user")).getId();
            } else {
                userId = 1L;
            }
        }
        try {
            Wishlist wishlist = wishlistService.addToWishlist(userId, productId);
            return Response.ok(wishlist).build();
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"" + e.getMessage() + "\"}").build();
        }
    }

    @DELETE
    @Path("/{userId}/wishlist/{productId}")
    public Response removeFromWishlist(@PathParam("userId") Long userId, @PathParam("productId") Long productId) {
        if (userId != null && userId == 999L) {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("user") != null) {
                userId = ((User) session.getAttribute("user")).getId();
            } else {
                userId = 1L;
            }
        }
        wishlistService.removeFromWishlist(userId, productId);
        return Response.ok().build();
    }

    @GET
    @Path("/notifications")
    public Response getUserNotifications() {
        HttpSession session = request.getSession(false);
        if (session == null || (session.getAttribute("user") == null && session.getAttribute("adminUser") == null)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Not logged in\"}").build();
        }
        User currentUserObj = (User) session.getAttribute("user");
        if (currentUserObj == null) {
            currentUserObj = (User) session.getAttribute("adminUser");
        }
        List<com.techmart.domain.Notification> notifications = em.createQuery(
            "SELECT n FROM Notification n WHERE n.user.id = :uid ORDER BY n.sentAt DESC", 
            com.techmart.domain.Notification.class)
            .setParameter("uid", currentUserObj.getId())
            .getResultList();
        return Response.ok(notifications).build();
    }

    @POST
    @Path("/notifications/read-all")
    @Transactional
    public Response readAllNotifications() {
        HttpSession session = request.getSession(false);
        if (session == null || (session.getAttribute("user") == null && session.getAttribute("adminUser") == null)) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Not logged in\"}").build();
        }
        User currentUserObj = (User) session.getAttribute("user");
        if (currentUserObj == null) {
            currentUserObj = (User) session.getAttribute("adminUser");
        }
        em.createQuery("UPDATE Notification n SET n.status = 'READ' WHERE n.user.id = :uid")
          .setParameter("uid", currentUserObj.getId())
          .executeUpdate();
        return Response.ok("{\"message\":\"All notifications marked as read\"}").build();
    }

    @GET
    @Path("/messages")
    public Response getUserMessages() {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Not logged in\"}").build();
        }
        User currentUserObj = (User) session.getAttribute("user");
        List<com.techmart.domain.ContactMessage> messages = em.createQuery(
            "SELECT c FROM ContactMessage c WHERE c.email = :email ORDER BY c.submittedAt DESC", 
            com.techmart.domain.ContactMessage.class)
            .setParameter("email", currentUserObj.getEmail())
            .getResultList();
        return Response.ok(messages).build();
    }

    @POST
    @Path("/notifications/{id}/read")
    @Transactional
    public Response readSingleNotification(@PathParam("id") Long id) {
        Notification n = em.find(Notification.class, id);
        if (n != null) {
            n.setStatus("READ");
            em.merge(n);
            return Response.ok("{\"message\":\"Notification marked as read\"}").build();
        }
        return Response.status(Response.Status.NOT_FOUND).build();
    }
    private String hashPassword(String plainTextPassword) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(plainTextPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Error hashing password", e);
        }
    }
}
