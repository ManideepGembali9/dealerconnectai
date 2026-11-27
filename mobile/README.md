# DealerConnect AI — Three Independent Mobile Applications

This directory provides the official **Expo SDK 58** mobile applications for **DealerConnect AI**.

Under the **"Three independent app experiences, one shared backend, one source of truth"** architecture, DealerConnect AI provides three separately installable applications that share a single unified backend and database:

1. **DealerConnect AI Customer** (`com.dealerconnectai.customer`) — Product & shop discovery, live price comparison, dealer contact.
2. **DealerConnect AI Dealer** (`com.dealerconnectai.dealer`) — Shop profile, inventory management, stock/pricing controls, incoming customer leads.
3. **DealerConnect AI Admin** (`com.dealerconnectai.admin`) — Platform supervision, dealer approvals, master catalog, categories, branding.

---

## 🚀 How to Run Each Application

### 1. DealerConnect Customer App
```bash
# Run on Local Wi-Fi (LAN)
npm run mobile:customer

# Run on All Area Networks (WAN / 4G / 5G / Tunnel)
npm run mobile:customer:tunnel
```
- **Application ID**: `com.dealerconnectai.customer`
- **Initial Route**: `/` (Home, Categories, Compare, Enquiries, Profile)

---

### 2. DealerConnect Dealer App
```bash
# Run on Local Wi-Fi (LAN)
npm run mobile:dealer

# Run on All Area Networks (WAN / 4G / 5G / Tunnel)
npm run mobile:dealer:tunnel
```
- **Application ID**: `com.dealerconnectai.dealer`
- **Initial Route**: `/dealer` (Dashboard, Inventory, Leads, My Shop, Alerts)

---

### 3. DealerConnect Admin App
```bash
# Run on Local Wi-Fi (LAN)
npm run mobile:admin

# Run on All Area Networks (WAN / 4G / 5G / Tunnel)
npm run mobile:admin:tunnel
```
- **Application ID**: `com.dealerconnectai.admin`
- **Initial Route**: `/admin` (Overview, Dealer Approvals, Master Catalog, Categories, Settings)

---

## ⚙️ In-App Multi-Role Switcher

When running in development preview, you can also switch between **Customer**, **Dealer**, and **Admin** experiences directly on your phone:
1. Tap **Switch App ▾** in the top navigation bar.
2. Select any of the three applications to immediately preview its native and web workflows!
