package com.techmart.service;

import com.techmart.domain.Product;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ProductServiceTest {

    @Mock
    private EntityManager em;

    @Mock
    private TypedQuery<Product> query;

    @InjectMocks
    private ProductService productService;

    @Test
    void testFindAllProducts() {
        Product p1 = new Product();
        p1.setId(1L);
        p1.setName("Test Laptop");

        when(em.createQuery(anyString(), eq(Product.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(Arrays.asList(p1));

        List<Product> result = productService.findAllProducts();

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Test Laptop", result.get(0).getName());
        verify(em).createQuery(anyString(), eq(Product.class));
    }

    @Test
    void testFindProductById() {
        Product p = new Product();
        p.setId(10L);
        when(em.find(Product.class, 10L)).thenReturn(p);

        Product result = productService.findProductById(10L);

        assertNotNull(result);
        assertEquals(10L, result.getId());
    }
}
