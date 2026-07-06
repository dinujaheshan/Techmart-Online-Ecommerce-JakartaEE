package com.techmart.messaging;

import com.techmart.domain.Order;
import com.techmart.monitoring.Logged;
import jakarta.annotation.Resource;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.inject.Inject;

import jakarta.jms.JMSContext;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.Queue;
import jakarta.jms.TextMessage;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "OrderProcessingQueue"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class OrderProcessingMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(OrderProcessingMDB.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Inject
    @jakarta.jms.JMSConnectionFactory("java:app/jms/TechMartConnectionFactory")
    private JMSContext jmsContext;

    @Resource(lookup = "java:app/jms/queue/InventoryUpdateQueue", type = jakarta.jms.Queue.class)
    private Queue inventoryUpdateQueue;

    @Override
    public void onMessage(Message message) {
        LOGGER.fine("[MDB-ORDER] Message received in OrderProcessingQueue.");
        try {
            if (message instanceof TextMessage) {
                String orderIdStr = ((TextMessage) message).getText();
                Long orderId = Long.parseLong(orderIdStr);

                LOGGER.fine("[MDB-ORDER] Asynchronously processing Order ID: " + orderId);

                Order order = em.find(Order.class, orderId);
                if (order != null) {
                    Thread.sleep(1000); 

                    order.setStatus("COMPLETED");
                    em.merge(order);
                    LOGGER.fine("[MDB-ORDER] Order " + orderId + " set to status COMPLETED.");

                    String inventoryMsg = String.format("SYNC|%d", order.getId());
                    jmsContext.createProducer().send(inventoryUpdateQueue, inventoryMsg);
                    LOGGER.fine("[MDB-ORDER] Sent sync message to InventoryUpdateQueue: " + inventoryMsg);
                } else {
                    LOGGER.warning("[MDB-ORDER] Order with ID " + orderId + " not found!");
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-ORDER] Exception processing order message: " + e.getMessage(), e);
            throw new RuntimeException("Rollback order message processing", e);
        }
    }
}
