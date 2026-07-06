package com.techmart.rest;

import com.techmart.domain.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.inject.Inject;
import java.util.List;
import jakarta.ejb.Stateless;

@Path("/admin")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Stateless
public class AdminResource {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @jakarta.ws.rs.core.Context
    private jakarta.servlet.http.HttpServletRequest request;

    @Inject
    @jakarta.jms.JMSConnectionFactory("java:app/jms/TechMartConnectionFactory")
    private jakarta.jms.JMSContext jmsContext;

    @jakarta.annotation.Resource(lookup = "java:app/jms/queue/ContactReplyQueue", type = jakarta.jms.Queue.class)
    private jakarta.jms.Queue contactReplyQueue;

    @jakarta.annotation.Resource(lookup = "java:app/jms/topic/NewProductTopic", type = jakarta.jms.Topic.class)
    private jakarta.jms.Topic newProductTopic;

    @GET
    @Path("/orders")
    public Response getAllOrders() {
        List<Order> orders = em.createQuery("SELECT o FROM Order o ORDER BY o.orderDate DESC", Order.class).getResultList();
        return Response.ok(orders).build();
    }

    @POST
    @Path("/products")
    @Transactional
    public Response addProduct(Product product) {
        if (product.getCategory() != null && product.getCategory().getId() != null) {
            Category category = em.find(Category.class, product.getCategory().getId());
            product.setCategory(category);
        }
        try {
            em.persist(product);
            em.flush();
        } catch (Exception e) {
            return Response.status(Response.Status.CONFLICT)
                           .entity("{\"error\":\"A product with this SKU already exists.\"}")
                           .build();
        }
        // Also initialize inventory for this new product
        Inventory inv = new Inventory(product, 0);
        em.persist(inv);

        // Publish event to NewProductTopic
        try {
            String payload = String.format("%d|%s|%s", product.getId(), product.getName(), product.getPrice().toString());
            jmsContext.createProducer().send(newProductTopic, payload);
        } catch (Exception e) {
            java.util.logging.Logger.getLogger(AdminResource.class.getName())
                .log(java.util.logging.Level.WARNING, "Failed to publish new product notification", e);
        }

        return Response.status(Response.Status.CREATED).entity(product).build();
    }

    @PUT
    @Path("/products/{id}")
    @Transactional
    public Response updateProduct(@PathParam("id") Long id, Product updatedProduct) {
        Product product = em.find(Product.class, id);
        if (product == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        product.setName(updatedProduct.getName());
        product.setDescription(updatedProduct.getDescription());
        product.setPrice(updatedProduct.getPrice());
        product.setSku(updatedProduct.getSku());
        product.setImageUrl(updatedProduct.getImageUrl());
        if (updatedProduct.getCategory() != null && updatedProduct.getCategory().getId() != null) {
            Category category = em.find(Category.class, updatedProduct.getCategory().getId());
            product.setCategory(category);
        } else {
            product.setCategory(null);
        }
        em.merge(product);
        return Response.ok(product).build();
    }

    @DELETE
    @Path("/products/{id}")
    @Transactional
    public Response deleteProduct(@PathParam("id") Long id) {
        Product product = em.find(Product.class, id);
        if (product != null) {
            // Delete inventory first to avoid constraint violation
            em.createQuery("DELETE FROM Inventory i WHERE i.product.id = :pid")
              .setParameter("pid", id)
              .executeUpdate();
            em.remove(product);
        }
        return Response.ok().build();
    }

    @PUT
    @Path("/orders/{id}/status")
    @Transactional
    public Response updateOrderStatus(@PathParam("id") Long id, @QueryParam("status") String status) {
        Order order = em.find(Order.class, id);
        if (order == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        order.setStatus(status);
        em.merge(order);
        return Response.ok(order).build();
    }

    @GET
    @Path("/users")
    public Response getAllUsers() {
        List<User> users = em.createQuery("SELECT u FROM User u ORDER BY u.id ASC", User.class).getResultList();
        return Response.ok(users).build();
    }

    @PUT
    @Path("/users/{id}/role")
    @Transactional
    public Response updateUserRole(@PathParam("id") Long id, @QueryParam("role") String role) {
        User user = em.find(User.class, id);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        user.setRole(role);
        em.merge(user);
        return Response.ok(user).build();
    }

    @DELETE
    @Path("/users/{id}")
    @Transactional
    public Response deleteUser(@PathParam("id") Long id) {
        User user = em.find(User.class, id);
        if (user != null) {
            // Let's delete user's wishlists, notifications
            em.createQuery("DELETE FROM Wishlist w WHERE w.user.id = :uid").setParameter("uid", id).executeUpdate();
            em.createQuery("DELETE FROM Notification n WHERE n.user.id = :uid").setParameter("uid", id).executeUpdate();
            // What about Orders? 
            em.createQuery("DELETE FROM Order o WHERE o.user.id = :uid").setParameter("uid", id).executeUpdate();
            em.remove(user);
        }
        return Response.ok().build();
    }

    @GET
    @Path("/inventory")
    public Response getInventory() {
        List<Inventory> inventoryList = em.createQuery("SELECT i FROM Inventory i ORDER BY i.product.id ASC", Inventory.class).getResultList();
        return Response.ok(inventoryList).build();
    }

    @PUT
    @Path("/inventory/{id}")
    @Transactional
    public Response updateInventory(@PathParam("id") Long id, @QueryParam("quantity") Integer quantity) {
        Inventory inventory = em.find(Inventory.class, id);
        if (inventory == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        inventory.setQuantity(quantity);
        em.merge(inventory);
        return Response.ok(inventory).build();
    }

    @POST
    @Path("/login")
    @Transactional
    public Response adminLogin(User credentials) {
        if (credentials == null || (credentials.getEmail() == null && credentials.getUsername() == null)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Invalid admin credentials\"}").build();
        }

        String searchKey = credentials.getEmail() != null ? credentials.getEmail().trim() : credentials.getUsername().trim();
        List<User> users = em.createQuery("SELECT u FROM User u WHERE u.email = :searchKey OR u.username = :searchKey", User.class)
                            .setParameter("searchKey", searchKey)
                            .getResultList();

        if (users.isEmpty()) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Admin user not found\"}").build();
        }

        User user = users.get(0);
        if (!"ADMIN".equals(user.getRole())) {
            return Response.status(Response.Status.FORBIDDEN).entity("{\"error\":\"Access denied. User is not an administrator.\"}").build();
        }

        if (credentials.getPassword() != null && !user.getPassword().equals(credentials.getPassword())) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Incorrect password\"}").build();
        }

        // Store admin in separate session attribute "adminUser"
        jakarta.servlet.http.HttpSession session = request.getSession(true);
        session.setAttribute("adminUser", user);

        return Response.ok(user).build();
    }

    @GET
    @Path("/me")
    public Response getAdminMe() {
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("adminUser") == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("{\"error\":\"Not logged in as admin\"}").build();
        }
        User adminUser = (User) session.getAttribute("adminUser");
        User freshAdmin = em.find(User.class, adminUser.getId());
        return Response.ok(freshAdmin).build();
    }

    @POST
    @Path("/logout")
    public Response adminLogout() {
        jakarta.servlet.http.HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute("adminUser");
        }
        return Response.ok("{\"message\":\"Admin logged out successfully\"}").build();
    }

    @GET
    @Path("/categories")
    public Response getAllCategories() {
        List<Category> categories = em.createQuery("SELECT c FROM Category c ORDER BY c.id ASC", Category.class).getResultList();
        return Response.ok(categories).build();
    }

    @POST
    @Path("/categories")
    @Transactional
    public Response addCategory(Category category) {
        em.persist(category);
        return Response.status(Response.Status.CREATED).entity(category).build();
    }

    @PUT
    @Path("/categories/{id}")
    @Transactional
    public Response updateCategory(@PathParam("id") Long id, Category updatedCategory) {
        Category category = em.find(Category.class, id);
        if (category == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        category.setName(updatedCategory.getName());
        category.setDescription(updatedCategory.getDescription());
        em.merge(category);
        return Response.ok(category).build();
    }

    @DELETE
    @Path("/categories/{id}")
    @Transactional
    public Response deleteCategory(@PathParam("id") Long id) {
        Category category = em.find(Category.class, id);
        if (category != null) {
            em.createQuery("UPDATE Product p SET p.category = null WHERE p.category.id = :cid")
              .setParameter("cid", id)
              .executeUpdate();
            em.remove(category);
        }
        return Response.ok().build();
    }

    @GET
    @Path("/contacts")
    public Response getAllContactMessages() {
        List<ContactMessage> messages = em.createQuery("SELECT c FROM ContactMessage c ORDER BY c.submittedAt DESC", ContactMessage.class).getResultList();
        return Response.ok(messages).build();
    }

    @POST
    @Path("/contacts/{id}/reply")
    public Response replyToContact(@PathParam("id") Long id, String replyTextObj) {
        String replyText = replyTextObj;
        if (replyTextObj != null && replyTextObj.trim().startsWith("{")) {
            try {
                int start = replyTextObj.indexOf("\"replyText\"");
                if (start != -1) {
                    int valStart = replyTextObj.indexOf(":", start);
                    if (valStart != -1) {
                        int quoteStart = replyTextObj.indexOf("\"", valStart);
                        int quoteEnd = replyTextObj.indexOf("\"", quoteStart + 1);
                        if (quoteStart != -1 && quoteEnd != -1) {
                            replyText = replyTextObj.substring(quoteStart + 1, quoteEnd);
                        }
                    }
                }
            } catch (Exception e) {
                // Fallback
            }
        }

        if (replyText == null || replyText.trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("{\"error\":\"Reply text is required\"}").build();
        }

        try {
            String payload = String.format("%d|%s", id, replyText);
            jmsContext.createProducer().send(contactReplyQueue, payload);
            return Response.ok("{\"message\":\"Reply queued for dispatch\"}").build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                           .entity("{\"error\":\"Failed to send reply to JMS queue: " + e.getMessage() + "\"}").build();
        }
    }

    @DELETE
    @Path("/contacts/{id}")
    @Transactional
    public Response deleteContactMessage(@PathParam("id") Long id) {
        ContactMessage msg = em.find(ContactMessage.class, id);
        if (msg != null) {
            em.remove(msg);
            return Response.ok().build();
        }
        return Response.status(Response.Status.NOT_FOUND).build();
    }

    @GET
    @Path("/metrics")
    public Response getSystemMetrics(@QueryParam("category") String category, @QueryParam("simulatedUsers") @DefaultValue("1") int simulatedUsers) {
        long startTime = System.nanoTime();
        
        // Product Query Performance Measurement
        long queryStartTime = System.nanoTime();
        Long totalProducts;
        if (category != null && !category.trim().isEmpty() && !"ALL".equalsIgnoreCase(category.trim())) {
            totalProducts = em.createQuery("SELECT COUNT(p) FROM Product p WHERE p.category.name = :cname", Long.class)
                              .setParameter("cname", category.trim())
                              .getSingleResult();
        } else {
            totalProducts = em.createQuery("SELECT COUNT(p) FROM Product p", Long.class).getSingleResult();
        }
        long queryEndTime = System.nanoTime();
        double dbQueryTimeMs = (queryEndTime - queryStartTime) / 1_000_000.0;

        Long totalCategories = em.createQuery("SELECT COUNT(c) FROM Category c", Long.class).getSingleResult();
        Long totalOrders = em.createQuery("SELECT COUNT(o) FROM Order o", Long.class).getSingleResult();
        Long totalUsers = em.createQuery("SELECT COUNT(u) FROM User u", Long.class).getSingleResult();

        long endTime = System.nanoTime();
        double apiDurationMs = (endTime - startTime) / 1_000_000.0;

        // Calculate load time based on simulated users scale & data items
        double totalCatalogLoadTimeMs = Math.max(12.0, (dbQueryTimeMs * 1.5) + (totalProducts * 1.2) + (simulatedUsers * 3.5));
        double imageAssetFetchTimeMs = Math.max(18.0, 25.0 + (totalProducts * 2.1) + (simulatedUsers * 4.2));

        Runtime runtime = Runtime.getRuntime();
        long freeMemory = runtime.freeMemory() / (1024 * 1024);
        long totalMemory = runtime.totalMemory() / (1024 * 1024);
        long usedMemory = totalMemory - freeMemory;

        String jsonResponse = String.format(
            "{" +
            "\"catalogLoadTimeMs\":%.2f," +
            "\"dbQueryTimeMs\":%.2f," +
            "\"imageAssetFetchTimeMs\":%.2f," +
            "\"totalProductsCount\":%d," +
            "\"totalCategoriesCount\":%d," +
            "\"totalOrdersCount\":%d," +
            "\"totalUsersCount\":%d," +
            "\"usedMemoryMb\":%d," +
            "\"totalMemoryMb\":%d," +
            "\"freeMemoryMb\":%d," +
            "\"apiDurationMs\":%.2f," +
            "\"simulatedConcurrency\":%d," +
            "\"selectedCategory\":\"%s\"" +
            "}",
            totalCatalogLoadTimeMs,
            dbQueryTimeMs,
            imageAssetFetchTimeMs,
            totalProducts,
            totalCategories,
            totalOrders,
            totalUsers,
            usedMemory,
            totalMemory,
            freeMemory,
            apiDurationMs,
            simulatedUsers,
            category != null ? category : "ALL"
        );

        return Response.ok(jsonResponse).build();
    }
}

