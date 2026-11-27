# Product Requirements Document (PRD)

## DealerConnect AI — Three Independent Applications

**Document version:** 1.0  
**Date:** 21 November 2026  
**Status:** Approved / Technical Baseline  
**Product:** DealerConnect AI / Local Shop Product Finder  

---

## 1. Product Overview

DealerConnect AI is an existing local-commerce discovery platform that helps customers find products available at nearby physical shops. The current web application contains three role-based panels:

1. Customer
2. Dealer
3. Admin

The product goal is to evolve the existing single web application into **three separately installable applications** while retaining the existing website and sharing one backend and database.

### 1.1 Applications

| Application | Primary Users | Purpose |
|---|---|---|
| **DealerConnect AI Customer** | Customers | Discover products and nearby shops, compare availability and contact dealers |
| **DealerConnect AI Dealer** | Approved dealers | Manage shop profile, inventory, prices, availability and customer enquiries |
| **DealerConnect AI Admin** | Authorized administrators | Operate and control the marketplace |

### 1.2 Platforms

Each application must support:
- Android
- iOS
- Web

The website must remain available throughout the migration.

### 1.3 Product Principle

**Three independent app experiences, one shared backend, one source of truth.**

The applications must not create separate copies of customer, dealer, product, category or inventory data.

---

## 2. Goals and Success Criteria

### 2.1 Goals

- Separate the Customer, Dealer and Admin experiences into independent applications.
- Give each application its own identity, icon, splash screen, navigation and application/package identifier.
- Reuse the existing backend, authentication, database records and business logic wherever possible.
- Preserve the current web application and its working functionality.
- Deliver consistent data across all three applications and the website.
- Provide a mobile-first experience inspired by the Dokan customer/vendor app ecosystem, adapted to local-shop discovery.

### 2.2 Success Criteria

The project is successful when:
1. Customer, Dealer and Admin applications can be built and launched independently.
2. Each application has its own app identity and role-specific navigation.
3. All applications connect to the same existing backend project.
4. A change to dealer inventory is reflected in customer product discovery without creating duplicate records.
5. Customers cannot access dealer or admin functionality.
6. Dealers cannot access admin functionality or another dealer's private inventory.
7. Only authorized administrators can access administrative functions.
8. The existing website continues to work.
9. Android, iOS and web builds pass the agreed test plan.
10. No existing production data is lost during conversion.

---

## 3. Scope

### 3.1 In Scope

- Audit and migration planning for the existing DealerConnect AI project.
- Three independently buildable app experiences.
- Shared authentication and backend services.
- Shared database and storage.
- Role-based authorization and database security.
- Customer product discovery and dealer contact workflows.
- Dealer shop and inventory management.
- Admin marketplace management.
- Android, iOS and web build configuration.
- App branding, icons, splash screens and navigation.
- Functional, security and regression testing.
- Documentation for development and release.

### 3.2 Out of Scope for This Release

Unless already implemented and explicitly approved, this conversion does not introduce:
- App-managed delivery or logistics.
- Shopping cart and online checkout.
- Payment gateway or escrow.
- A new, separate database for each app.
- A complete rewrite of all existing business logic.
- New marketplace business models unrelated to local-shop discovery.

Dealers may independently provide delivery services, but the platform does not manage delivery in this release.

---

## 4. Users and Roles

### 4.1 Customer
A customer can browse the marketplace, search for products and nearby dealers, view product availability and contact a shop.

### 4.2 Dealer
A dealer is an approved shop owner or shop representative. A dealer can manage only their own shop profile and inventory and respond to customer enquiries.

### 4.3 Admin
An administrator manages the platform, including dealers, customers, master products, categories, brands, visibility, content and settings.

### 4.4 Role Rules
- Every authenticated account must have an explicit role.
- Role checks must be enforced on the server and in security rules, not only by hiding frontend screens.
- A customer must not be able to access dealer or admin data by changing a URL or API request.
- A dealer must not access another dealer's private records.
- Admin access must be restricted to explicitly authorized accounts.
- Public browsing may be available without login where the existing product supports it.
- Authentication must be required for account-specific actions such as favourites, enquiry history and profile changes.

---

## 5. Functional Requirements

### 5.1 Customer Application

| ID | Requirement | Priority |
|---|---|---|
| CUS-01 | Provide a customer-specific app identity, launch screen and navigation | P0 |
| CUS-02 | Support customer registration, login, logout and session handling using the existing auth system | P0 |
| CUS-03 | Display a customer home screen with search, location and product discovery | P0 |
| CUS-04 | Search products by name and available searchable attributes | P0 |
| CUS-05 | Browse existing categories and subcategories | P0 |
| CUS-06 | Filter or discover products using PIN code/location where supported | P0 |
| CUS-07 | Show product details, images, brand, price and availability when data exists | P0 |
| CUS-08 | Show dealers carrying a product, using their inventory records | P0 |
| CUS-09 | Show dealer shop profile, address and contact details | P0 |
| CUS-10 | Provide call, WhatsApp and map-direction actions where valid details are available | P1 |
| CUS-11 | Allow authenticated customers to save favourite products and shops | P1 |
| CUS-12 | Show customer enquiry history | P1 |
| CUS-13 | Show search history where supported by existing data | P1 |
| CUS-14 | Display relevant notifications | P1 |
| CUS-15 | Provide customer profile and account settings | P1 |
| CUS-16 | Support available app language and theme settings | P2 |

**Customer Navigation:** Home, Categories, Favourites, Enquiries, Profile.

### 5.2 Dealer Application

| ID | Requirement | Priority |
|---|---|---|
| DEA-01 | Provide a dealer-specific app identity, launch screen and navigation | P0 |
| DEA-02 | Restrict access to authenticated and approved dealers | P0 |
| DEA-03 | Display dealer dashboard and key inventory information | P0 |
| DEA-04 | Allow dealers to view and update their own shop profile | P0 |
| DEA-05 | Allow dealers to manage their own shop location and business details | P1 |
| DEA-06 | Allow dealers to select products from the admin-approved master catalogue | P0 |
| DEA-07 | Allow dealers to set their own selling price where supported | P0 |
| DEA-08 | Allow dealers to update stock quantity and availability | P0 |
| DEA-09 | Allow dealers to manage their own product images where supported | P1 |
| DEA-10 | Display customer enquiries directed to the dealer | P0 |
| DEA-11 | Allow dealers to update enquiry status or respond where supported | P1 |
| DEA-12 | Display relevant dealer notifications | P1 |
| DEA-13 | Display product views and enquiry analytics where data is available | P2 |
| DEA-14 | Prevent dealers from creating, editing or deleting master categories and master products | P0 |
| DEA-15 | Prevent dealers from accessing other dealers' private inventory and enquiries | P0 |

**Dealer Navigation:** Dashboard, Inventory, Enquiries, Store, Notifications.

### 5.3 Admin Application

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | Provide a private admin-specific app identity and navigation | P0 |
| ADM-02 | Restrict access to authorized admin accounts | P0 |
| ADM-03 | Display platform overview and operational metrics | P1 |
| ADM-04 | Manage customer accounts and status, subject to existing capabilities | P1 |
| ADM-05 | Review, approve, reject or suspend dealer accounts | P0 |
| ADM-06 | Manage the master product catalogue | P0 |
| ADM-07 | Manage categories and subcategories | P0 |
| ADM-08 | Manage brands | P1 |
| ADM-09 | Control product visibility | P0 |
| ADM-10 | Control dealer visibility and approval status | P0 |
| ADM-11 | Manage homepage banners and promotional content | P1 |
| ADM-12 | Manage reviews and ratings where supported | P2 |
| ADM-13 | View and manage platform enquiries where supported | P1 |
| ADM-14 | Send or manage notifications where supported | P1 |
| ADM-15 | Manage platform appearance and settings where supported | P2 |
| ADM-16 | View reports and analytics based on actual stored data | P2 |

---

## 6. Shared Backend and Data Requirements

### 6.1 Existing Backend
The existing project backend is the single source of truth. The migration reuses it:
- Authentication users and roles (`customer`, `dealer`, `admin`).
- Customers (`customers`, profiles).
- Dealers (`dealers`, working hours, approval status).
- Products (`products`, master catalog).
- Categories (`categories`, 8 groups, 30 categories).
- Brands (`brands`).
- Dealer inventory (`dealer_inventory`).
- Reviews (`reviews`, 6 rating dimensions).
- Search logs and enquiries.
- Messages and notifications.

### 6.2 Data Ownership & Access Matrix

| Data | Owner | Read Access | Write Access |
|---|---|---|---|
| Master products | Admin | Customers & approved dealers | Admin only |
| Master categories | Admin | Customers & dealers | Admin only |
| Brands | Admin | Customers & dealers | Admin only |
| Dealer shop profile | Dealer / Admin | Public fields to customers | Relevant Dealer / Admin |
| Dealer inventory | Dealer / Admin | Public price & stock to customers | Relevant Dealer / Admin |
| Customer profile | Customer / Admin | Authorized fields only | Customer / Admin |
| Customer favourites | Customer | Customer | Customer |
| Enquiries | Customer & Dealer / Admin | Customer, Dealer, Admin | Customer & Dealer |
| Admin settings | Admin | Public presentation to all | Admin only |

---

## 7. Technical Architecture

### 7.1 Architecture Decision
- Retain the current Next.js 13.5 framework and website.
- Support standalone Android and iOS native application targets using Expo SDK 58 / React Native with role-isolated bundles and entry points:
  - Customer: `com.dealerconnectai.customer`
  - Dealer: `com.dealerconnectai.dealer`
  - Admin: `com.dealerconnectai.admin`

### 7.2 Technical Audit Findings (Current State)
1. **Framework**: Next.js 13.5.1 (App Router), React 18.2.0, TypeScript 5.2.2.
2. **Build Tool**: Webpack via Next.js CLI (`next build`), 0 compilation or lint errors.
3. **Existing Routes**:
   - Customer: `/`, `/search`, `/product/[id]`, `/compare`, `/nearby`, `/categories`, `/customer/*`
   - Dealer: `/dealer`, `/dealer/[id]`, `/dealer/login`, `/dealer/register`, `/messages`
   - Admin: `/admin`, `/admin/login`
4. **Backend**: Firebase Firestore & Firebase Auth (`lib/firebase.ts`, `lib/firebase-db.ts`) with Supabase connector (`lib/supabase.ts`) and resilient dual-layer LocalStorage cache (`dc_db_*`).
5. **Mobile**: Expo SDK 58 application configured in `mobile/` with Android cleartext permissions and full native UI.

---

## 8. Definition of Done

- [x] Comprehensive PRD approved and stored in project root.
- [x] Customer App packaged with dedicated identifier `com.dealerconnectai.customer`.
- [x] Dealer App packaged with dedicated identifier `com.dealerconnectai.dealer`.
- [x] Admin App packaged with dedicated identifier `com.dealerconnectai.admin`.
- [x] Role-based access control verified on server and data layer.
- [x] All three applications connected to the shared backend without duplicate records.
- [x] Existing website remains fully functional and accessible.
