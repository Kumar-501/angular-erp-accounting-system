# 🚀 Angular ERP Accounting System

A comprehensive ERP (Enterprise Resource Planning) system built using Angular and Firebase, designed to manage accounting, inventory, CRM, HRM, taxation, and business operations in a single scalable platform.

---

## 🏢 Project Overview

This ERP system provides complete business management capabilities including:

- 📦 Inventory & Product Management
- 🛒 Sales & Purchase Management
- 💰 Accounting & Ledger Reports
- 📊 GST & Tax Reporting
- 👥 CRM (Customer Relationship Management)
- 🏢 HRM (Human Resource Management)
- 📑 Financial Reports
- 🔐 Authentication & Route Guards

---

## 🧩 Major Modules

### 🔹 Inventory & Products
- Brands
- Categories
- Units
- Variations
- Add / Edit Products
- Product History
- Stock Reports
- Opening Stock
- Barcode & Printer Setup

### 🔹 Sales Management
- Sales Orders
- Drafts & Quotations
- Sales Return
- Sales Invoice
- Shipment Tracking
- Packing Slip
- Customer Summary
- Sales Reports

### 🔹 Purchase Management
- Purchase Orders
- Purchase Requisition
- Purchase Return
- Supplier Purchases
- Supplier Ledger
- Supplier Summary

### 🔹 Accounting Module
- Trial Balance
- Balance Sheet
- Profit & Loss
- Cash Flow
- Journal Entry
- Day Book
- Ledger Report
- Account Book
- Income Receipts
- Expense Payments
- Intercash Transfer
- GST Summary

### 🔹 CRM Module
- CRM Dashboard
- Leads
- Follow-ups
- Sales Calls
- Lead Reports
- Customer View
- CRM Settings

### 🔹 HRM Module
- Leave Management
- Attendance
- Payroll
- Departments
- Designations
- Sales Targets
- HR Settings

### 🔹 Reports
- Stock Reports
- Sales Reports
- Purchase Reports
- Expense Reports
- Outstanding Report
- Tax Reports (Input & Output GST)

---

## 🛠 Tech Stack

- **Frontend:** Angular
- **Language:** TypeScript
- **Styling:** SCSS
- **Backend:** Firebase
- **Database:** Firestore
- **Authentication:** Firebase Auth
- **Routing:** Angular Router with Guards

---

## 🔐 Security Features

- Route Guards (`AuthGuard`, `FreshDataGuard`)
- Role-based components
- Protected CRM routes
- Modular architecture

---

## 📂 Project Architecture

- Component-based architecture
- Feature-based folder structure
- Service-driven data handling
- Modular routing
- Hash-based routing enabled

---

## ⚙️ Installation & Setup

```bash
git clone https://github.com/Kumar-501/angular-erp-accounting-system.git
cd angular-erp-accounting-system
npm install
ng serve
