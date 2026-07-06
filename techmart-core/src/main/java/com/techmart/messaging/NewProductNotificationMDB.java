package com.techmart.messaging;

import com.techmart.domain.Notification;
import com.techmart.domain.User;
import com.techmart.monitoring.Logged;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "NewProductTopic"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Topic"),
    @ActivationConfigProperty(propertyName = "subscriptionName", propertyValue = "NewProductSubscription"),
    @ActivationConfigProperty(propertyName = "clientId", propertyValue = "TechMartNewProduct"),
    @ActivationConfigProperty(propertyName = "subscriptionDurability", propertyValue = "Durable"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class NewProductNotificationMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(NewProductNotificationMDB.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    public void onMessage(Message message) {
        LOGGER.info("[MDB-NEW-PRODUCT] Received message in NewProductTopic.");
        try {
            if (message instanceof TextMessage) {
                String payload = ((TextMessage) message).getText();
                LOGGER.info("[MDB-NEW-PRODUCT] Payload: " + payload);

                // Payload pattern: productId|productName|productPrice
                String[] tokens = payload.split("\\|", 3);
                if (tokens.length >= 3) {
                    String pName = tokens[1];
                    String pPrice = tokens[2];

                    // Fetch all registered users
                    List<User> users = em.createQuery("SELECT u FROM User u", User.class).getResultList();
                    for (User u : users) {
                        String notificationMsg = String.format("New Product Alert: %s is now available for $%s!", pName, pPrice);
                        Notification notification = new Notification(u, notificationMsg, "SYSTEM", "PENDING");
                        em.persist(notification);
                    }
                    LOGGER.info("[MDB-NEW-PRODUCT] Notifications sent to " + users.size() + " users.");
                } else {
                    LOGGER.warning("[MDB-NEW-PRODUCT] Malformed payload: " + payload);
                }
            } else {
                LOGGER.warning("[MDB-NEW-PRODUCT] Unexpected message type: " + message.getClass().getName());
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-NEW-PRODUCT] Error processing notification: " + e.getMessage(), e);
        }
    }
}
