package com.techmart.service;

import com.techmart.domain.Product;
import com.techmart.domain.User;
import com.techmart.domain.Wishlist;
import com.techmart.monitoring.Logged;
import jakarta.ejb.Stateless;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.NoResultException;
import java.util.List;

@Stateless
@Logged
public class WishlistService {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    public List<Wishlist> getUserWishlist(Long userId) {
        return em.createQuery("SELECT w FROM Wishlist w WHERE w.user.id = :userId ORDER BY w.addedAt DESC", Wishlist.class)
                 .setParameter("userId", userId)
                 .getResultList();
    }

    public Wishlist addToWishlist(Long userId, Long productId) {
        User user = em.find(User.class, userId);
        Product product = em.find(Product.class, productId);

        if (user == null || product == null) {
            throw new IllegalArgumentException("User or Product not found");
        }

        // Check if already in wishlist
        try {
            Wishlist existing = em.createQuery("SELECT w FROM Wishlist w WHERE w.user.id = :userId AND w.product.id = :productId", Wishlist.class)
                                  .setParameter("userId", userId)
                                  .setParameter("productId", productId)
                                  .getSingleResult();
            return existing; // Already there
        } catch (NoResultException e) {
            // Not in wishlist, proceed to add
        }

        Wishlist wishlist = new Wishlist(user, product);
        em.persist(wishlist);
        return wishlist;
    }

    public void removeFromWishlist(Long userId, Long productId) {
        try {
            Wishlist existing = em.createQuery("SELECT w FROM Wishlist w WHERE w.user.id = :userId AND w.product.id = :productId", Wishlist.class)
                                  .setParameter("userId", userId)
                                  .setParameter("productId", productId)
                                  .getSingleResult();
            em.remove(existing);
        } catch (NoResultException e) {
            // Nothing to remove
        }
    }
}
