
admin-dashboard/
├── public/
│   ├── images/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── error.tsx
│   │   │   ├── products/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [productId]/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── suppliers/page.tsx
│   │   │   ├── orders/page.tsx
│   │   │   ├── customers/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── api/                 # Optional Next.js API routes
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn components
│   │   ├── layout/
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── app-header.tsx
│   │   │   └── breadcrumbs.tsx
│   │   ├── shared/
│   │   │   ├── page-header.tsx
│   │   │   ├── confirm-dialog.tsx
│   │   │   └── data-table/
│   │   └── providers/
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── api/
│   │   │   └── types/
│   │   ├── products/
│   │   │   ├── components/
│   │   │   │   ├── product-table.tsx
│   │   │   │   ├── product-form.tsx
│   │   │   │   └── product-filters.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-products.ts
│   │   │   │   └── use-product-filters.ts
│   │   │   ├── api/
│   │   │   │   └── products-api.ts
│   │   │   ├── schemas/
│   │   │   │   └── product-schema.ts
│   │   │   ├── types/
│   │   │   │   └── product.ts
│   │   │   └── utils/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   └── reports/
│   │
│   ├── hooks/                   # Generic shared hooks
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── utils.ts
│   │   └── env.ts
│   ├── stores/                  # Shared client-side state
│   ├── types/                   # Truly global types
│   └── config/
│       ├── navigation.ts
│       └── app-config.ts
│
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── components.json
├── next.config.ts
├── package.json
└── tsconfig.json




features/products/
├── api/
│   └── products-api.ts       # HTTP requests
├── components/
│   ├── product-table.tsx     # Table UI
│   ├── product-form.tsx      # Create/edit form
│   ├── product-dialog.tsx    # Dialog UI
│   └── product-toolbar.tsx   # Search and filters
├── hooks/
│   ├── use-products.ts       # Server data
│   └── use-product-filters.ts
├── schemas/
│   └── product-schema.ts     # Zod validation
└── types/
    └── product.ts            # TypeScript types



features/products/
├── api/
│   └── products-api.ts
├── components/
│   ├── product-table.tsx
│   ├── product-form.tsx
│   ├── product-dialog.tsx
│   └── product-toolbar.tsx
├── hooks/
│   ├── use-products.ts
│   └── use-product-filters.ts
├── schemas/
│   └── product-schema.ts
├── types/
│   └── product.ts
└── utils/
    └── product-formatters.ts


1. Build in this order

1. components/layout/
Start here
- app-sidebar.tsx — navigation menu
- app-header.tsx — search, user menu, notifications
- breadcrumbs.tsx — current page location
- dashboard-shell.tsx — combines sidebar, header, and content




2. components/shared/
- page-header.tsx — page title, description, actions
- confirm-dialog.tsx — reusable delete confirmation
- data-table/ — reusable table, pagination, sorting, selection




3. components/providers/
- query-provider.tsx — TanStack Query
- theme-provider.tsx — light/dark mode, if needed
- Authentication provider, if your auth solution requires one




4. app/(dashboard)/

Assemble the shared layout, create the dashboard overview page, and verify navigation before adding business features.