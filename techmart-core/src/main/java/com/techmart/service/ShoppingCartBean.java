package com.techmart.service;

import com.techmart.domain.CartItem;
import com.techmart.domain.Product;
import com.techmart.monitoring.Logged;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.ejb.PostActivate;
import jakarta.ejb.PrePassivate;
import jakarta.ejb.Remove;
import jakarta.ejb.Stateful;
import jakarta.enterprise.context.SessionScoped;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.logging.Logger;

@Stateful
@SessionScoped
@Logged
public class ShoppingCartBean implements Serializable {
    private static final long serialVersionUID = 1L;
    private static final Logger LOGGER = Logger.getLogger(ShoppingCartBean.class.getName());

    private List<CartItem> items;

    @PostConstruct
    public void init() {
        items = new ArrayList<>();
        LOGGER.fine("[LIFECYCLE] ShoppingCartBean @PostConstruct - Cart initialized.");
    }

    @PreDestroy
    public void destroy() {
        LOGGER.fine("[LIFECYCLE] ShoppingCartBean @PreDestroy - Cart resources cleaned up.");
    }

    @PrePassivate
    public void passivate() {
        LOGGER.fine("[LIFECYCLE] ShoppingCartBean @PrePassivate - Cart bean state is being passivated (serialized) to disk.");
    }

    @PostActivate
    public void activate() {
        LOGGER.fine("[LIFECYCLE] ShoppingCartBean @PostActivate - Cart bean state is being activated (deserialized) back to memory.");
    }

    public void addItem(Product product, int quantity) {
        if (product == null || quantity <= 0) return;
        
        for (CartItem item : items) {
            if (item.getProduct().getId().equals(product.getId())) {
                item.setQuantity(item.getQuantity() + quantity);
                LOGGER.fine("[CART] Updated quantity for product: " + product.getName());
                return;
            }
        }
        items.add(new CartItem(product, quantity));
        LOGGER.fine("[CART] Added new product: " + product.getName());
    }

    public void removeItem(Long productId) {
        if (productId == null) return;
        items.removeIf(item -> item.getProduct().getId().equals(productId));
        LOGGER.fine("[CART] Removed product ID: " + productId);
    }

    public List<CartItem> getItems() {
        return Collections.unmodifiableList(items);
    }

    public BigDecimal getTotalAmount() {
        return items.stream()
                .map(CartItem::getSubTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void clearCart() {
        items.clear();
        LOGGER.fine("[CART] Cart cleared.");
    }

    @Remove
    public void checkoutComplete() {
        // Destroy Stateful Bean Context
        items.clear();
        LOGGER.fine("[LIFECYCLE] ShoppingCartBean @Remove - EJB context destroyed.");
    }
}
