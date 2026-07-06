package com.techmart.messaging;

import com.techmart.domain.Order;
import com.techmart.domain.OrderItem;
import com.techmart.domain.Inventory;
import com.techmart.monitoring.Logged;
import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.MessageDriven;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.logging.Level;
import java.util.logging.Logger;

@MessageDriven(activationConfig = {
    @ActivationConfigProperty(propertyName = "destination", propertyValue = "InventoryUpdateQueue"),
    @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
    @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge")
})
@Logged
public class InventoryMDB implements MessageListener {
    private static final Logger LOGGER = Logger.getLogger(InventoryMDB.class.getName());
    private static final int LOW_STOCK_THRESHOLD = 5;

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    @Override
    public void onMessage(Message message) {
        LOGGER.fine("[MDB-INVENTORY] Message received in InventoryUpdateQueue.");
        try {
            if (message instanceof TextMessage) {
                String text = ((TextMessage) message).getText();
                LOGGER.fine("[MDB-INVENTORY] Parsing sync payload: " + text);

                if (text.startsWith("SYNC|")) {
                    Long orderId = Long.parseLong(text.substring(5));
                    Order order = em.find(Order.class, orderId);
                    
                    if (order != null) {
                        for (OrderItem item : order.getOrderItems()) {
                            Long productId = item.getProduct().getId();
                            
                            try {
                                Inventory inv = em.createQuery("SELECT i FROM Inventory i WHERE i.product.id = :productId", Inventory.class)
                                                  .setParameter("productId", productId)
                                                  .getSingleResult();
                                
                                LOGGER.fine(String.format("[MDB-INVENTORY] Audited SKU %s: Current Stock = %d", 
                                    item.getProduct().getSku(), inv.getQuantity()));
                                
                                if (inv.getQuantity() < LOW_STOCK_THRESHOLD) {
                                    LOGGER.warning(String.format(
                                        "[ALERT-INVENTORY] LOW STOCK DETECTED: Product ID: %d | SKU: %s | Remaining Qty: %d (Below Threshold of %d)",
                                        productId, item.getProduct().getSku(), inv.getQuantity(), LOW_STOCK_THRESHOLD
                                    ));
                                }
                            } catch (Exception ex) {
                                LOGGER.fine("[MDB-INVENTORY] No inventory record found for product ID: " + productId);
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "[MDB-INVENTORY] Error processing inventory sync: " + e.getMessage(), e);
        }
    }
}
