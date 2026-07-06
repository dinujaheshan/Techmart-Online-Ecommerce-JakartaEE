package com.techmart.service;

import com.techmart.domain.*;
import com.techmart.monitoring.Logged;
import jakarta.annotation.Resource;
import jakarta.ejb.Asynchronous;
import jakarta.ejb.AsyncResult;
import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.jms.JMSContext;
import jakarta.jms.Queue;
import jakarta.jms.Topic;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.Future;
import java.util.logging.Level;
import java.util.logging.Logger;

@Stateless
@Logged
public class OrderService {
    private static final Logger LOGGER = Logger.getLogger(OrderService.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @EJB
    private InventoryManager inventoryManager;

    @Inject
    @jakarta.jms.JMSConnectionFactory("java:app/jms/TechMartConnectionFactory")
    private JMSContext jmsContext;

    @Resource(lookup = "java:app/jms/queue/OrderProcessingQueue", type = jakarta.jms.Queue.class)
    private Queue orderProcessingQueue;

    @Resource(lookup = "java:app/jms/topic/CustomerNotificationTopic", type = jakarta.jms.Topic.class)
    private Topic customerNotificationTopic;

    public Order placeOrder(Long userId, List<CartItem> items, String shippingAddress) {
        LOGGER.fine("[ORDER] Initiating order placement for User ID: " + userId);
        
        User user = em.find(User.class, userId);
        if (user == null) {
            throw new IllegalArgumentException("User not found with ID: " + userId);
        }

        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Cannot place an order with an empty shopping cart.");
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        Order order = new Order(user, shippingAddress, BigDecimal.ZERO);
        
        for (CartItem cartItem : items) {
            Product product = em.find(Product.class, cartItem.getProduct().getId());
            if (product == null) {
                throw new IllegalArgumentException("Product not found: " + cartItem.getProduct().getId());
            }

            int requestedQty = cartItem.getQuantity();
            boolean success = inventoryManager.decrementStock(product.getId(), requestedQty);
            if (!success) {
                throw new IllegalStateException("Insufficient inventory for product: " + product.getName() + " (SKU: " + product.getSku() + ")");
            }

            OrderItem orderItem = new OrderItem(product, requestedQty, product.getPrice());
            order.addOrderItem(orderItem);
            
            BigDecimal itemTotal = product.getPrice().multiply(BigDecimal.valueOf(requestedQty));
            totalAmount = totalAmount.add(itemTotal);
        }

        order.setTotalAmount(totalAmount);
        order.setStatus("PROCESSING");
        
        em.persist(order);
        em.flush();

        try {
            jmsContext.createProducer().send(orderProcessingQueue, order.getId().toString());
            LOGGER.fine("[ORDER] Published Order ID " + order.getId() + " to OrderProcessingQueue.");
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to publish Order " + order.getId() + " to JMS queue", e);
        }

        try {
            String msg = String.format("ORDER_CONFIRMATION|%d|%d|%s", user.getId(), order.getId(), totalAmount.toString());
            jmsContext.createProducer().send(customerNotificationTopic, msg);
            LOGGER.fine("[ORDER] Published Notification to Topic: " + msg);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Failed to publish Notification to JMS topic", e);
        }

        return order;
    }

    @Asynchronous
    public Future<Boolean> processPaymentAsync(Long orderId, BigDecimal amount) {
        LOGGER.fine("[ASYNC-PAYMENT] Started payment processing for Order: " + orderId + " (" + Thread.currentThread().getName() + ")");
        try {
            Thread.sleep(3000); 
            if (Math.random() < 0.1) {
                throw new RuntimeException("External Payment Gateway Timeout!");
            }
            LOGGER.fine("[ASYNC-PAYMENT] Payment successful for Order: " + orderId);
            return new AsyncResult<>(true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warning("[ASYNC-PAYMENT] Payment thread was interrupted for Order: " + orderId);
            return new AsyncResult<>(false);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[ASYNC-PAYMENT] Error during payment processing: " + e.getMessage());
            return new AsyncResult<>(false);
        }
    }

    @Asynchronous
    public void sendEmailNotificationAsync(String emailAddress, String subject, String messageContent) {
        LOGGER.fine("[ASYNC-EMAIL] Sending email notification to: " + emailAddress + " | Subject: " + subject + " (" + Thread.currentThread().getName() + ")");
        try {
            Thread.sleep(1500);
            LOGGER.info("Email notification sent to: " + emailAddress);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.warning("[ASYNC-EMAIL] Email sending interrupted.");
        }
    }
}
