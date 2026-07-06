package com.techmart.messaging;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.jms.Destination;
import jakarta.jms.JMSContext;
import jakarta.jms.TextMessage;
import java.util.logging.Level;
import java.util.logging.Logger;

@ApplicationScoped
public class JMSProducer {
    private static final Logger LOGGER = Logger.getLogger(JMSProducer.class.getName());

    @Inject
    private JMSContext jmsContext;

    /**
     * Publishes a string message to the specified JMS destination (Queue or Topic).
     */
    public void sendMessage(Destination destination, String textMessage) {
        if (destination == null || textMessage == null) return;
        
        try {
            TextMessage msg = jmsContext.createTextMessage(textMessage);
            jmsContext.createProducer().send(destination, msg);
            LOGGER.info("[JMS] Successfully sent message to destination: " + destination);
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[JMS-ERROR] Failed to send message to: " + destination, e);
        }
    }
}
