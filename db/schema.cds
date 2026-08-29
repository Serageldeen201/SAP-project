namespace sap.supplier.product;

using { cuid, managed } from '@sap/cds/common';

/**
 * Entity representing a Product Supplier
 */
entity Supplier : cuid, managed {
    name     : String(100) not null;
    email    : String(100);
    rating   : Integer; // Validated between 1 and 5
    products : Association to many Product on products.supplier = $self;
}

/**
 * Entity representing a Product managed in the catalog
 */
entity Product : cuid, managed {
    name           : String(100) not null;
    price          : Decimal(10, 2) not null; // Validated > 0
    category       : String(50) not null;
    externalRating : Decimal(3, 2); // Fetched asynchronously from FakeStoreAPI on creation
    averageRating  : Decimal(3, 2); // Recalculated and persisted via submitReview action
    supplier       : Association to Supplier;
    reviews        : Composition of many ProductReview on reviews.product = $self;
}

/**
 * Entity representing a Review for a Product
 */
entity ProductReview : cuid, managed {
    product  : Association to Product;
    rating   : Integer not null; // Validated between 1 and 5
    comment  : String(500);
    reviewer : String(100);
}
