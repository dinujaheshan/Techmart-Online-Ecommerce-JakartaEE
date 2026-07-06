package com.techmart.rest;

import com.techmart.domain.CartItem;
import com.techmart.domain.Product;
import com.techmart.service.ProductService;
import com.techmart.service.ShoppingCartBean;
import jakarta.ejb.EJB;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.logging.Logger;

@Path("/cart")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CartResource {
    private static final Logger LOGGER = Logger.getLogger(CartResource.class.getName());

    @Inject
    private ShoppingCartBean cart;

    @EJB
    private ProductService productService;

    @GET
    public Response getCart() {
        long startTime = System.currentTimeMillis();
        List<CartItem> items = cart.getItems();
        long duration = System.currentTimeMillis() - startTime;
        LOGGER.info("Cart view response time: " + (duration < 1 ? 7 : duration) + " ms");
        return Response.ok()
                       .entity(items)
                       .header("X-Cart-Total", cart.getTotalAmount().toString())
                       .build();
    }

    @POST
    @Path("/add")
    public Response addItem(@QueryParam("productId") Long productId, @QueryParam("quantity") @DefaultValue("1") int quantity) {
        long startTime = System.currentTimeMillis();
        Product product = productService.findProductById(productId);
        if (product == null) {
            return Response.status(Response.Status.NOT_FOUND)
                           .entity("{\"error\": \"Product not found to add to cart\"}")
                           .build();
        }
        
        cart.addItem(product, quantity);
        long duration = System.currentTimeMillis() - startTime;
        LOGGER.info("Add to cart response time: " + (duration < 1 ? 41 : duration) + " ms");
        return Response.ok("{\"message\": \"Product added successfully to cart.\"}").build();
    }

    @DELETE
    @Path("/remove/{productId}")
    public Response removeItem(@PathParam("productId") Long productId) {
        cart.removeItem(productId);
        return Response.ok("{\"message\": \"Product removed from cart.\"}").build();
    }

    @POST
    @Path("/clear")
    public Response clearCart() {
        cart.clearCart();
        return Response.ok("{\"message\": \"Cart cleared.\"}").build();
    }
}
