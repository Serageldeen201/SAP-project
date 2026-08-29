using { CatalogService } from './catalog-service';

annotate CatalogService.Products with @(
    UI.HeaderInfo: {
        TypeName: 'Product',
        TypeNamePlural: 'Products',
        Title: { Value: name },
        Description: { Value: category }
    },
    UI.SelectionFields: [
        category,
        supplier_ID
    ],
    UI.LineItem: [
        { Value: name, Label: 'Product Name' },
        { Value: category, Label: 'Category' },
        { Value: price, Label: 'Price ($)' },
        { Value: externalRating, Label: 'External Rating (FakeStore)' },
        { Value: averageRating, Label: 'Average Rating' },
        { Value: supplier.name, Label: 'Supplier' }
    ],
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Product Details',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Customer Reviews',
            Target: 'reviews/@UI.LineItem'
        }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: name, Label: 'Product Name' },
            { Value: category, Label: 'Category' },
            { Value: price, Label: 'Price' },
            { Value: externalRating, Label: 'External Rating' },
            { Value: averageRating, Label: 'Average Customer Rating' },
            { Value: supplier_ID, Label: 'Supplier' }
        ]
    }
);

annotate CatalogService.Suppliers with @(
    UI.HeaderInfo: {
        TypeName: 'Supplier',
        TypeNamePlural: 'Suppliers',
        Title: { Value: name }
    },
    UI.LineItem: [
        { Value: name, Label: 'Supplier Name' },
        { Value: email, Label: 'Email' },
        { Value: rating, Label: 'Rating' }
    ]
);

annotate CatalogService.ProductReviews with @(
    UI.HeaderInfo: {
        TypeName: 'Product Review',
        TypeNamePlural: 'Product Reviews',
        Title: { Value: reviewer }
    },
    UI.LineItem: [
        { Value: reviewer, Label: 'Reviewer' },
        { Value: rating, Label: 'Rating (1-5)' },
        { Value: comment, Label: 'Comment' },
        { Value: createdAt, Label: 'Review Date' }
    ]
);
