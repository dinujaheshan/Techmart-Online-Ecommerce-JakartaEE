package com.techmart.messaging;

import com.techmart.monitoring.Logged;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "ContactQueue"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class ContactMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(ContactMDB.class.getName());

    @jakarta.persistence.PersistenceContext(unitName = "TechMartPU")
    private jakarta.persistence.EntityManager em;

    @Override
    public void onMessage(Message message) {
        LOGGER.info("[MDB-CONTACT] Received message in ContactQueue.");
        try {
            if (message instanceof TextMessage) {
                String payload = ((TextMessage) message).getText();
                LOGGER.info("[MDB-CONTACT] Received payload: " + payload);

                // Payload pattern: name|email|message
                String[] tokens = payload.split("\\|", 3);
                if (tokens.length >= 3) {
                    String name = tokens[0];
                    String email = tokens[1];
                    String msgContent = tokens[2];

                    LOGGER.info(String.format("[MDB-CONTACT-PROCESSED] From: %s <%s> | Message: %s", name, email, msgContent));

                    com.techmart.domain.ContactMessage contactMsg = new com.techmart.domain.ContactMessage(name, email, msgContent);
                    em.persist(contactMsg);
                    em.flush();
                    LOGGER.info("[MDB-CONTACT] Contact message saved to database.");

                    try {
                        java.util.List<com.techmart.domain.User> admins = em.createQuery(
                            "SELECT u FROM User u WHERE u.role = 'ADMIN'", com.techmart.domain.User.class).getResultList();
                        for (com.techmart.domain.User admin : admins) {
                            String notifyMsg = String.format("CONTACT_ALERT|%d|%s|%s", contactMsg.getId(), name, msgContent);
                            com.techmart.domain.Notification notification = new com.techmart.domain.Notification(admin, notifyMsg, "SYSTEM", "PENDING");
                            em.persist(notification);
                        }
                        LOGGER.info("[MDB-CONTACT] Notifications sent to admins.");
                    } catch (Exception ex) {
                        LOGGER.log(Level.SEVERE, "Failed to send notification to admin", ex);
                    }
                } else {
                    LOGGER.warning("[MDB-CONTACT] Malformed payload received: " + payload);
                }
            } else {
                LOGGER.warning("[MDB-CONTACT] Unexpected message type: " + message.getClass().getName());
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-CONTACT] Error processing contact message: " + e.getMessage(), e);
        }
    }
}
