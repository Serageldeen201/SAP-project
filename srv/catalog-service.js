"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const cds_1 = __importDefault(require("@sap/cds"));
const fakestore_client_1 = require("./external/fakestore-client");
const LOG = cds_1.default.log('catalog-service');
const { SELECT, INSERT, UPDATE } = cds_1.default.ql;
class CatalogService extends cds_1.default.ApplicationService {
    async init() {
        await super.init();
        const { Products, Suppliers, ProductReviews } = this.entities;
        // =========================================================================
        // 1. INPUT VALIDATION HANDLERS
        // =========================================================================
        // Validate Product price > 0 on CREATE and UPDATE
        this.before(['CREATE', 'UPDATE'], Products, async (req) => {
            const { price } = req.data;
            if (price !== undefined && price !== null) {
                const numericPrice = Number(price);
                if (isNaN(numericPrice) || numericPrice <= 0) {
                    LOG.error(`Validation failed: Product price ${price} is not greater than 0.`);
                    return req.error(400, 'Product price must be greater than 0.', 'price');
                }
            }
        });
        // Validate Supplier rating (1-5) on CREATE and UPDATE
        this.before(['CREATE', 'UPDATE'], Suppliers, async (req) => {
            const { rating } = req.data;
            if (rating !== undefined && rating !== null) {
                const numericRating = Number(rating);
                if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
                    LOG.error(`Validation failed: Supplier rating ${rating} is not between 1 and 5.`);
                    return req.error(400, 'Supplier rating must be an integer between 1 and 5 (inclusive).', 'rating');
                }
            }
        });
        // Validate ProductReview rating (1-5) on CREATE and UPDATE
        this.before(['CREATE', 'UPDATE'], ProductReviews, async (req) => {
            const { rating } = req.data;
            if (rating !== undefined && rating !== null) {
                const numericRating = Number(rating);
                if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
                    LOG.error(`Validation failed: Product review rating ${rating} is not between 1 and 5.`);
                    return req.error(400, 'Product review rating must be an integer between 1 and 5 (inclusive).', 'rating');
                }
            }
        });
        // =========================================================================
        // 2. EXTERNAL API ENRICHMENT (On CREATE Product)
        // =========================================================================
        this.before('CREATE', Products, async (req) => {
            const { price, category, externalRating } = req.data;
            // Skip external fetch if price validation failed
            if (price !== undefined && Number(price) <= 0) {
                return;
            }
            // Only fetch if category is provided and externalRating wasn't explicitly supplied
            if (category && externalRating === undefined) {
                try {
                    LOG.info(`Enriching product with category "${category}" via FakeStoreAPI...`);
                    const fetchedRating = await (0, fakestore_client_1.fetchExternalRatingByCategory)(category);
                    if (fetchedRating !== null) {
                        req.data.externalRating = fetchedRating;
                        LOG.info(`Product enriched with external rating: ${fetchedRating}`);
                    }
                    else {
                        LOG.info(`No external rating applied for product in category "${category}".`);
                    }
                }
                catch (error) {
                    // Fail-safe: ensure product creation never fails due to external API
                    LOG.warn(`Gracefully handled external rating fetch failure: ${error?.message || error}`);
                }
            }
        });
        // =========================================================================
        // 3. CUSTOM ACTION: submitReview
        // =========================================================================
        this.on('submitReview', async (req) => {
            const { productID, rating, comment } = req.data;
            LOG.info(`Executing submitReview action for productID: ${productID}`);
            // Validation: productID required
            if (!productID) {
                return req.error(400, 'Product ID is required.', 'productID');
            }
            // Validation: rating required and between 1 and 5
            const numericRating = Number(rating);
            if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
                LOG.error(`submitReview validation failed: Rating ${rating} is not an integer between 1 and 5.`);
                return req.error(400, 'Rating must be an integer between 1 and 5 (inclusive).', 'rating');
            }
            // Run within transactional context
            const tx = cds_1.default.tx(req);
            // 1. Verify target Product exists
            const product = await tx.run(SELECT.one.from(Products).where({ ID: productID }));
            if (!product) {
                LOG.warn(`submitReview failed: Product ${productID} not found.`);
                return req.error(404, `Product with ID '${productID}' not found.`);
            }
            // 2. Create new ProductReview record linked to productID
            const newReviewId = cds_1.default.utils.uuid();
            const reviewerName = req.user?.id && req.user.id !== 'anonymous'
                ? req.user.id
                : 'Customer';
            await tx.run(INSERT.into(ProductReviews).entries({
                ID: newReviewId,
                product_ID: productID,
                rating: numericRating,
                comment: comment || '',
                reviewer: reviewerName
            }));
            LOG.info(`Created ProductReview ${newReviewId} for product ${productID}`);
            // 3. Recalculate average rating across all reviews for this product
            const reviews = await tx.run(SELECT.from(ProductReviews).where({ product_ID: productID }));
            const totalRating = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
            const recalculatedAverage = reviews.length > 0
                ? Number((totalRating / reviews.length).toFixed(2))
                : 0;
            LOG.info(`Product ${productID} has ${reviews.length} reviews. Calculated average: ${recalculatedAverage}`);
            // 4. Persist the new averageRating on the Product entity
            await tx.run(UPDATE(Products, productID).with({
                averageRating: recalculatedAverage
            }));
            LOG.info(`Updated Product ${productID} averageRating to ${recalculatedAverage}`);
            // 5. Return updated Product
            const updatedProduct = await tx.run(SELECT.one.from(Products).where({ ID: productID }));
            return updatedProduct;
        });
    }
}
module.exports = CatalogService;
