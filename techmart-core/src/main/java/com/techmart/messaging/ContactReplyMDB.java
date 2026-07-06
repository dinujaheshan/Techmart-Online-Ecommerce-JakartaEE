package com.techmart.messaging;

import com.techmart.domain.ContactMessage;
import com.techmart.monitoring.Logged;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.OffsetDateTime;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "ContactReplyQueue"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class ContactReplyMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(ContactReplyMDB.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    public void onMessage(Message message) {
        LOGGER.info("[MDB-CONTACT-REPLY] Received message in ContactReplyQueue.");
        try {
            if (message instanceof TextMessage) {
                String payload = ((TextMessage) message).getText();
                LOGGER.info("[MDB-CONTACT-REPLY] Payload: " + payload);

                // Payload pattern: contactMessageId|replyText
                String[] tokens = payload.split("\\|", 2);
                if (tokens.length >= 2) {
                    Long contactMessageId = Long.parseLong(tokens[0]);
                    String replyText = tokens[1];

                    ContactMessage contactMsg = em.find(ContactMessage.class, contactMessageId);
                    if (contactMsg != null) {
                        contactMsg.setReply(replyText);
                        contactMsg.setRepliedAt(OffsetDateTime.now());
                        em.merge(contactMsg);
                        LOGGER.info("[MDB-CONTACT-REPLY] Successfully saved reply to ContactMessage ID: " + contactMessageId);

                        try {
                            java.util.List<com.techmart.domain.User> customers = em.createQuery(
                                "SELECT u FROM User u WHERE u.email = :email", com.techmart.domain.User.class)
                                .setParameter("email", contactMsg.getEmail())
                                .getResultList();
                            if (!customers.isEmpty()) {
                                com.techmart.domain.User customer = customers.get(0);
                                String replyNotifyMsg = String.format("REPLY_ALERT|%d|%s|%s", contactMessageId, replyText, contactMsg.getMessage());
                                com.techmart.domain.Notification notification = new com.techmart.domain.Notification(customer, replyNotifyMsg, "SYSTEM", "PENDING");
                                em.persist(notification);
                                LOGGER.info("[MDB-CONTACT-REPLY] Reply notification sent to customer: " + customer.getUsername());
                            }
                        } catch (Exception ex) {
                            LOGGER.log(Level.SEVERE, "Failed to create reply notification for customer", ex);
                        }
                    } else {
                        LOGGER.warning("[MDB-CONTACT-REPLY] ContactMessage not found with ID: " + contactMessageId);
                    }
                } else {
                    LOGGER.warning("[MDB-CONTACT-REPLY] Malformed payload received: " + payload);
                }
            } else {
                LOGGER.warning("[MDB-CONTACT-REPLY] Unexpected message type: " + message.getClass().getName());
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-CONTACT-REPLY] Error processing reply: " + e.getMessage(), e);
        }
    }
}
