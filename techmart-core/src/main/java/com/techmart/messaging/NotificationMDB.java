package com.techmart.messaging;

import com.techmart.domain.Notification;
import com.techmart.domain.User;
import com.techmart.monitoring.Logged;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "CustomerNotificationTopic"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Topic"),
    @ActivationConfigProperty(propertyName = "subscriptionName", propertyValue = "NotificationSubscription"),
    @ActivationConfigProperty(propertyName = "clientId", propertyValue = "TechMartApp"),
    @ActivationConfigProperty(propertyName = "subscriptionDurability", propertyValue = "Durable"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class NotificationMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(NotificationMDB.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    public void onMessage(Message message) {
        LOGGER.info("[MDB-NOTIFICATION] Message received in CustomerNotificationTopic.");
        try {
            if (message instanceof TextMessage) {
                String payload = ((TextMessage) message).getText();
                LOGGER.info("[MDB-NOTIFICATION] Received payload: " + payload);

                // Payload pattern: ORDER_CONFIRMATION|userId|orderId|totalAmount
                String[] tokens = payload.split("\\|");
                if (tokens.length >= 4 && "ORDER_CONFIRMATION".equals(tokens[0])) {
                    if ("null".equals(tokens[1]) || "null".equals(tokens[2])) {
                        LOGGER.warning("[MDB-NOTIFICATION] Skipping malformed notification containing null IDs: " + payload);
                        return;
                    }
                    Long userId = Long.parseLong(tokens[1]);
                    Long orderId = Long.parseLong(tokens[2]);
                    String amount = tokens[3];

                    User user = em.find(User.class, userId);
                    com.techmart.domain.Order order = em.find(com.techmart.domain.Order.class, orderId);
                    if (user != null && order != null) {
                        StringBuilder itemsHtml = new StringBuilder();
                        // Pre-fetch/initialize lazy loaded items in the transaction
                        for (com.techmart.domain.OrderItem item : order.getOrderItems()) {
                            itemsHtml.append("<tr>")
                                     .append("<td style='padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px;'>")
                                     .append(item.getProduct().getName())
                                     .append("</td>")
                                     .append("<td style='padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569; font-size: 14px;'>")
                                     .append(item.getQuantity())
                                     .append("</td>")
                                     .append("<td style='padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155; font-weight: 600; font-size: 14px;'>$")
                                     .append(item.getUnitPrice().setScale(2, java.math.RoundingMode.HALF_UP).toString())
                                     .append("</td>")
                                     .append("</tr>");
                        }

                        String emailBody = "<!DOCTYPE html><html>"
                            + "<head><meta charset='UTF-8'></head>"
                            + "<body style=\"margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;\">"
                            + "  <div style='max-width: 600px; margin: 40px auto; background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);'>"
                            + "    <div style='text-align: center; margin-bottom: 30px;'>"
                            + "      <div style='font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;'>TechMart</div>"
                            + "      <div style='font-size: 12px; text-transform: uppercase; color: #64748b; margin-top: 5px; font-weight: 600;'>Order Receipt</div>"
                            + "    </div>"
                            + "    <div style='border-bottom: 1px solid #f1f5f9; padding-bottom: 25px; margin-bottom: 25px;'>"
                            + "      <h2 style='margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 700;'>Thank you for your purchase!</h2>"
                            + "      <p style='margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;'>Hi " + user.getUsername() + ", your order has been received and is currently being processed. Here are your transaction details:</p>"
                            + "    </div>"
                            + "    <div style='background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 30px; font-size: 13px; line-height: 1.6; color: #475569;'>"
                            + "      <div><strong>Order ID:</strong> #TM-2026-" + (1000 + orderId) + "</div>"
                            + "      <div><strong>Status:</strong> Processing</div>"
                            + "      <div><strong>Shipping Address:</strong> " + order.getShippingAddress() + "</div>"
                            + "    </div>"
                            + "    <h3 style='font-size: 16px; color: #0f172a; font-weight: 600; margin-bottom: 15px;'>Items Ordered</h3>"
                            + "    <table style='width: 100%; border-collapse: collapse; margin-bottom: 30px;'>"
                            + "      <thead>"
                            + "        <tr style='background-color: #f1f5f9;'>"
                            + "          <th style='padding: 10px 12px; text-align: left; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; border-radius: 6px 0 0 6px;'>Item</th>"
                            + "          <th style='padding: 10px 12px; text-align: center; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase;'>Qty</th>"
                            + "          <th style='padding: 10px 12px; text-align: right; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; border-radius: 0 6px 6px 0;'>Price</th>"
                            + "        </tr>"
                            + "      </thead>"
                            + "      <tbody>" + itemsHtml.toString() + "</tbody>"
                            + "    </table>"
                            + "    <div style='display: flex; justify-content: flex-end; align-items: center; border-top: 2px solid #e2e8f0; padding-top: 15px; text-align: right;'>"
                            + "      <span style='font-size: 14px; color: #64748b; font-weight: 500; margin-right: 15px;'>Grand Total:</span>"
                            + "      <span style='font-size: 20px; color: #6366f1; font-weight: 800;'>$" + amount + "</span>"
                            + "    </div>"
                            + "    <div style='margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 25px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;'>"
                            + "      If you have any questions, reply to this email or contact support at <a href='mailto:support@techmart.com' style='color: #6366f1; text-decoration: none; font-weight: 500;'>support@techmart.com</a>.<br>"
                            + "      &copy; 2026 TechMart Online Inc. All rights reserved."
                            + "    </div>"
                            + "  </div>"
                            + "</body></html>";

                        // Save notification audit log in Database (first 500 chars fallback/extract for DB log)
                        Notification notification = new Notification(user, "HTML Order Confirmation sent to " + user.getEmail(), "EMAIL", "SENT");
                        em.persist(notification);
                        
                        LOGGER.info("[MDB-NOTIFICATION] Audit notification stored for user: " + user.getEmail());
                        
                        // Dispatch SMTP HTML email
                        sendEmail(user.getEmail(), "TechMart Order Receipt - #" + orderId, emailBody);
                    }
                }
            } else {
                LOGGER.warning("[MDB-NOTIFICATION] Unexpected message type: " + message.getClass().getName());
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-NOTIFICATION] Error processing notification: " + e.getMessage(), e);
        }
    }

    private void sendEmail(String to, String subject, String body) {
        final String username = "dinujaheshan659@gmail.com";
        final String password = "czen adrm qckz vfew";

        java.util.Properties prop = new java.util.Properties();
        prop.put("mail.smtp.host", "smtp.gmail.com");
        prop.put("mail.smtp.port", "587");
        prop.put("mail.smtp.auth", "true");
        prop.put("mail.smtp.starttls.enable", "true");
        prop.put("mail.smtp.starttls.required", "true");
        prop.put("mail.smtp.ssl.trust", "smtp.gmail.com");
        prop.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");

        jakarta.mail.Session session = jakarta.mail.Session.getInstance(prop, new jakarta.mail.Authenticator() {
            @Override
            protected jakarta.mail.PasswordAuthentication getPasswordAuthentication() {
                return new jakarta.mail.PasswordAuthentication(username, password);
            }
        });

        try {
            jakarta.mail.Message message = new jakarta.mail.internet.MimeMessage(session);
            message.setFrom(new jakarta.mail.internet.InternetAddress(username, "TechMart Support"));
            message.setRecipients(jakarta.mail.Message.RecipientType.TO, jakarta.mail.internet.InternetAddress.parse(to));
            message.setSubject(subject);
            // Set email body content type to HTML
            message.setContent(body, "text/html; charset=utf-8");

            jakarta.mail.Transport.send(message);
            LOGGER.info("[SMTP GATEWAY] Real HTML email sent successfully to: " + to);
        } catch (Exception e) {
            LOGGER.log(java.util.logging.Level.SEVERE, "[SMTP GATEWAY] Failed to dispatch real email to " + to, e);
        }
    }
}
