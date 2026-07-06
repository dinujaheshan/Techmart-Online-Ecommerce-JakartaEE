package com.techmart.service;

import com.techmart.domain.Product;
import com.techmart.monitoring.Logged;
import jakarta.ejb.Stateless;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import java.util.List;

@Stateless
@Logged
public class ProductService {

    @PersistenceContext(unitName = "TechMartPU")
    private EntityManager em;

    public List<Product> findAllProducts() {
        TypedQuery<Product> query = em.createQuery("SELECT p FROM Product p LEFT JOIN FETCH p.category", Product.class);
        return query.getResultList();
    }

    public Product findProductById(Long id) {
        if (id == null) return null;
        return em.find(Product.class, id);
    }

    public Product findProductBySku(String sku) {
        if (sku == null || sku.trim().isEmpty()) return null;
        try {
            return em.createQuery("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.sku = :sku", Product.class)
                     .setParameter("sku", sku)
                     .getSingleResult();
        } catch (Exception e) {
            return null; // Product not found
        }
    }

    public Product createProduct(Product product) {
        if (product == null) return null;
        if (product.getCategory() != null && product.getCategory().getId() != null) {
            product.setCategory(em.getReference(product.getCategory().getClass(), product.getCategory().getId()));
        }
        em.persist(product);
        return product;
    }

    public void updateProduct(Product product) {
        if (product != null && product.getId() != null) {
            em.merge(product);
        }
    }

    public void deleteProduct(Long id) {
        Product product = findProductById(id);
        if (product != null) {
            em.remove(product);
        }
    }
}
