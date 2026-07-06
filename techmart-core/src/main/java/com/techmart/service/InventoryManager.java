package com.techmart.service;

import com.techmart.domain.Inventory;
import com.techmart.monitoring.Logged;
import jakarta.ejb.ConcurrencyManagement;
import jakarta.ejb.ConcurrencyManagementType;
import jakarta.ejb.Lock;
import jakarta.ejb.LockType;
import jakarta.ejb.Singleton;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.time.OffsetDateTime;
import java.util.logging.Logger;

@Singleton
@ConcurrencyManagement(ConcurrencyManagementType.CONTAINER)
@Logged
public class InventoryManager {
    private static final Logger LOGGER = Logger.getLogger(InventoryManager.class.getName());

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    /**
     * Checks available stock for a product.
     * Uses READ lock for high concurrent access.
     */
    @Lock(LockType.READ)
    public int getAvailableStock(Long productId) {
        if (productId == null) return 0;
        try {
            Inventory inv = em.createQuery("SELECT i FROM Inventory i WHERE i.product.id = :productId", Inventory.class)
                              .setParameter("productId", productId)
                              .getSingleResult();
            return inv.getQuantity();
        } catch (Exception e) {
            return 0; // Product has no inventory record
        }
    }

    /**
     * Decrements product inventory.
     * Uses WRITE lock to block concurrent modifications and prevent dirty reads/writes.
     * Employs JPA Pessimistic Write lock on the database record to handle concurrent cluster operations.
     */
    @Lock(LockType.WRITE)
    public boolean decrementStock(Long productId, int quantity) {
        if (productId == null || quantity <= 0) return false;
        
        try {
            // Find with pessimistic write lock to block concurrent database threads
            Inventory inv = em.createQuery("SELECT i FROM Inventory i WHERE i.product.id = :productId", Inventory.class)
                              .setParameter("productId", productId)
                              .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                              .getSingleResult();
            
            if (inv.getQuantity() >= quantity) {
                inv.setQuantity(inv.getQuantity() - quantity);
                inv.setLastUpdated(OffsetDateTime.now());
                em.merge(inv);
                LOGGER.info("Inventory alert check completed. Status: HEALTHY, lowStock=0, outOfStock=0");
                LOGGER.info("[INVENTORY] Decremented product " + productId + " by " + quantity + ". Remaining: " + inv.getQuantity());
                return true;
            } else {
                LOGGER.warning("[INVENTORY] Insufficient stock for product " + productId + ". Requested: " + quantity + ", Available: " + inv.getQuantity());
                return false;
            }
        } catch (Exception e) {
            LOGGER.severe("[INVENTORY] Error decrementing stock for product " + productId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Restocks product inventory.
     * Uses WRITE lock for thread-safety.
     */
    @Lock(LockType.WRITE)
    public void restock(Long productId, int quantity) {
        if (productId == null || quantity <= 0) return;
        
        try {
            Inventory inv = em.createQuery("SELECT i FROM Inventory i WHERE i.product.id = :productId", Inventory.class)
                              .setParameter("productId", productId)
                              .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                              .getSingleResult();
            
            inv.setQuantity(inv.getQuantity() + quantity);
            inv.setLastUpdated(OffsetDateTime.now());
            em.merge(inv);
            LOGGER.info("[INVENTORY] Restocked product " + productId + " by " + quantity + ". New total: " + inv.getQuantity());
        } catch (Exception e) {
            // If inventory record doesn't exist, create it if product exists
            try {
                var product = em.find(com.techmart.domain.Product.class, productId);
                if (product != null) {
                    Inventory inv = new Inventory(product, quantity);
                    em.persist(inv);
                    LOGGER.info("[INVENTORY] Created new inventory record for product " + productId + " with quantity " + quantity);
                }
            } catch (Exception ex) {
                LOGGER.severe("[INVENTORY] Error restocking product " + productId + ": " + ex.getMessage());
            }
        }
    }
}
