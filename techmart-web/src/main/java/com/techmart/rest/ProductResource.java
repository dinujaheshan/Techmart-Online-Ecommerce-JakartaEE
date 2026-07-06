package com.techmart.rest;

import com.techmart.domain.Product;
import com.techmart.service.ProductService;
import jakarta.ejb.EJB;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/products")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProductResource {

    @EJB
    private ProductService productService;

    @GET
    public List<Product> getAllProducts() {
        return productService.findAllProducts();
    }

    @GET
    @Path("/{id}")
    public Response getProductById(@PathParam("id") Long id) {
        Product product = productService.findProductById(id);
        if (product == null) {
            return Response.status(Response.Status.NOT_FOUND)
                           .entity("{\"error\": \"Product not found\"}")
                           .build();
        }
        return Response.ok(product).build();
    }

    @GET
    @Path("/sku/{sku}")
    public Response getProductBySku(@PathParam("sku") String sku) {
        Product product = productService.findProductBySku(sku);
        if (product == null) {
            return Response.status(Response.Status.NOT_FOUND)
                           .entity("{\"error\": \"Product not found by SKU\"}")
                           .build();
        }
        return Response.ok(product).build();
    }

    @POST
    public Response createProduct(Product product) {
        if (product == null || product.getName() == null || product.getSku() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                           .entity("{\"error\": \"Invalid product payload\"}")
                           .build();
        }
        Product created = productService.createProduct(product);
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @DELETE
    @Path("/{id}")
    public Response deleteProduct(@PathParam("id") Long id) {
        productService.deleteProduct(id);
        return Response.noContent().build();
    }
}
