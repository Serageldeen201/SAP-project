using { sap.supplier.product as my } from '../db/schema';

/**
 * Catalog Service providing CRUD operations and custom actions
 * for Suppliers, Products, and Product Reviews.
 */
service CatalogService @(path: '/catalog') {

    @Capabilities: {
        InsertRestrictions.Insertable: true,
        UpdateRestrictions.Updatable: true,
        DeleteRestrictions.Deletable: true
    }
    entity Suppliers as projection on my.Supplier;

    @Capabilities: {
        InsertRestrictions.Insertable: true,
        UpdateRestrictions.Updatable: true,
        DeleteRestrictions.Deletable: true
    }
    entity Products as projection on my.Product;

    @Capabilities: {
        InsertRestrictions.Insertable: true,
        UpdateRestrictions.Updatable: true,
        DeleteRestrictions.Deletable: true
    }
    entity ProductReviews as projection on my.ProductReview;

    /**
     * Action to submit a review for a specific product,
     * calculate the updated average rating, and persist it on the product.
     */
    action submitReview(
        productID : UUID,
        rating    : Integer,
        comment   : String
    ) returns Products;
}
