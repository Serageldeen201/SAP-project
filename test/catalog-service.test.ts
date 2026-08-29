import cds from '@sap/cds';
import { expect } from 'chai';
import { resetFakeStoreCache } from '../srv/external/fakestore-client';

describe('CatalogService Test Suite', () => {
    const { GET, POST, PATCH, DELETE } = cds.test(__dirname + '/..');

    after(async () => {
        if (cds.db) {
            await cds.db.disconnect();
        }
        await cds.shutdown();
    });

    describe('1. CRUD Operations & Seed Data', () => {
        it('should list all seeded suppliers', async () => {
            const res = await GET('/catalog/Suppliers');
            expect(res.status).to.equal(200);
            expect(Array.isArray(res.data.value)).to.be.true;
            expect(res.data.value.length).to.be.at.least(1);
        });

        it('should list all seeded products', async () => {
            const res = await GET('/catalog/Products');
            expect(res.status).to.equal(200);
            expect(Array.isArray(res.data.value)).to.be.true;
            expect(res.data.value.length).to.be.at.least(1);
        });

        it('should list all seeded product reviews', async () => {
            const res = await GET('/catalog/ProductReviews');
            expect(res.status).to.equal(200);
            expect(Array.isArray(res.data.value)).to.be.true;
            expect(res.data.value.length).to.be.at.least(1);
        });

        it('should successfully create, update, and delete a supplier', async () => {
            // Create
            const createRes = await POST('/catalog/Suppliers', {
                name: 'Nordic Goods Oy',
                email: 'hello@nordicgoods.fi',
                rating: 4
            });
            expect(createRes.status).to.equal(201);
            expect(createRes.data.name).to.equal('Nordic Goods Oy');
            const supplierId = createRes.data.ID;

            // Update
            const patchRes = await PATCH(`/catalog/Suppliers(${supplierId})`, {
                rating: 5
            });
            expect(patchRes.status).to.equal(200);

            // Delete
            const deleteRes = await DELETE(`/catalog/Suppliers(${supplierId})`);
            expect(deleteRes.status).to.equal(204);
        });
    });

    describe('2. Input Validations', () => {
        it('should reject Product creation when price is <= 0', async () => {
            try {
                await POST('/catalog/Products', {
                    name: 'Invalid Price Item',
                    price: -15.00,
                    category: 'electronics'
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Product price must be greater than 0');
            }
        });

        it('should reject Product creation when price is 0', async () => {
            try {
                await POST('/catalog/Products', {
                    name: 'Zero Price Item',
                    price: 0,
                    category: 'electronics'
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Product price must be greater than 0');
            }
        });

        it('should reject Supplier creation when rating is greater than 5', async () => {
            try {
                await POST('/catalog/Suppliers', {
                    name: 'Over-rated Corp',
                    email: 'test@corp.com',
                    rating: 6
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Supplier rating must be an integer between 1 and 5');
            }
        });

        it('should reject Supplier creation when rating is less than 1', async () => {
            try {
                await POST('/catalog/Suppliers', {
                    name: 'Under-rated Corp',
                    email: 'test@corp.com',
                    rating: 0
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Supplier rating must be an integer between 1 and 5');
            }
        });

        it('should reject direct ProductReview creation when rating is out of bounds', async () => {
            try {
                await POST('/catalog/ProductReviews', {
                    product_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    rating: 7,
                    comment: 'Way too high rating'
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Product review rating must be an integer between 1 and 5');
            }
        });
    });

    describe('3. External API Integration (FakeStoreAPI)', () => {
        const originalFetch = global.fetch;

        beforeEach(() => {
            resetFakeStoreCache();
        });

        afterEach(() => {
            global.fetch = originalFetch;
            resetFakeStoreCache();
        });

        it('should enrich newly created product with externalRating when API matches category', async () => {
            global.fetch = async () =>
                ({
                    ok: true,
                    json: async () => [
                        { id: 1, title: 'Men Slim T-Shirt', category: "men's clothing", rating: { rate: 4.3, count: 120 } },
                        { id: 2, title: 'SanDisk SSD', category: 'electronics', rating: { rate: 4.7, count: 250 } }
                    ]
                } as any);

            const res = await POST('/catalog/Products', {
                name: 'USB-C Fast Charger',
                price: 24.99,
                category: 'electronics'
            });

            expect(res.status).to.equal(201);
            expect(res.data.name).to.equal('USB-C Fast Charger');
            expect(res.data.category).to.equal('electronics');
            expect(Number(res.data.externalRating)).to.equal(4.7);
        });

        it('should not fail product creation for non-existing category in FakeStoreAPI', async () => {
            global.fetch = async () =>
                ({
                    ok: true,
                    json: async () => [
                        { id: 1, title: 'SanDisk SSD', category: 'electronics', rating: { rate: 4.7, count: 250 } }
                    ]
                } as any);

            const res = await POST('/catalog/Products', {
                name: 'Custom Rocket Fuel',
                price: 999.00,
                category: 'aerospace-propulsion-custom'
            });

            expect(res.status).to.equal(201);
            expect(res.data.name).to.equal('Custom Rocket Fuel');
            expect(res.data.externalRating ?? null).to.be.null;
        });

        it('should gracefully degrade and succeed with product creation when external API fails', async () => {
            global.fetch = async () => {
                throw new Error('Network timeout / offline');
            };

            const res = await POST('/catalog/Products', {
                name: 'Resilient Offline Product',
                price: 49.99,
                category: 'electronics'
            });

            expect(res.status).to.equal(201);
            expect(res.data.name).to.equal('Resilient Offline Product');
            expect(res.data.externalRating ?? null).to.be.null;
        });
    });

    describe('4. Custom Action: submitReview', () => {
        it('should reject submitReview with invalid rating', async () => {
            try {
                await POST('/catalog/submitReview', {
                    productID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    rating: 6,
                    comment: 'Invalid rating'
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('400');
                expect(err.message).to.include('Rating must be an integer between 1 and 5');
            }
        });

        it('should reject submitReview for nonexistent product', async () => {
            try {
                await POST('/catalog/submitReview', {
                    productID: '00000000-0000-0000-0000-000000000000',
                    rating: 4,
                    comment: 'Does not exist'
                });
                expect.fail('Should have failed');
            } catch (err: any) {
                expect(err.message).to.include('404');
            }
        });

        it('should submit a review, calculate average rating, and persist it on Product', async () => {
            // Create a fresh test product
            const prodRes = await POST('/catalog/Products', {
                name: 'Test Smart Watch',
                price: 149.99,
                category: 'electronics'
            });
            const productId = prodRes.data.ID;

            // Submit 1st review: rating 4
            const rev1 = await POST('/catalog/submitReview', {
                productID: productId,
                rating: 4,
                comment: 'Very good smartwatch!'
            });
            expect([200, 204]).to.include(rev1.status);

            let check1 = await GET(`/catalog/Products(${productId})`);
            expect(Number(check1.data.averageRating)).to.equal(4.00);

            // Submit 2nd review: rating 2
            const rev2 = await POST('/catalog/submitReview', {
                productID: productId,
                rating: 2,
                comment: 'Battery drains quickly.'
            });
            expect([200, 204]).to.include(rev2.status);

            // Average of 4 and 2 = 3.00
            let check2 = await GET(`/catalog/Products(${productId})`);
            expect(Number(check2.data.averageRating)).to.equal(3.00);

            // Submit 3rd review: rating 5
            const rev3 = await POST('/catalog/submitReview', {
                productID: productId,
                rating: 5,
                comment: 'Latest firmware fixed all issues!'
            });
            expect([200, 204]).to.include(rev3.status);

            // Average of 4, 2, 5 = 11 / 3 = 3.67
            const check3 = await GET(`/catalog/Products(${productId})`);
            expect(Number(check3.data.averageRating)).to.equal(3.67);
        });
    });
});