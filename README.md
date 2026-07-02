# Centralized Inventory and Asset Management System with Automated Alert Notification

A web-based system for an integrated computing business hub, built with the MERN stack (MongoDB, Express.js, React.js, Node.js). It provides three core capabilities:

1. **Centralized Inventory Management** — track stock items, categories, suppliers, and stock-in/stock-out transactions with automatic quantity recalculation and configurable reorder levels.
2. **Asset Tracking Management** — register durable assets, assign/transfer custodianship, update condition/status, and maintain a full movement history.
3. **Automated Alert Notification** — a scheduled background job checks stock levels and asset review dates, automatically generating and emailing alerts when a threshold is crossed.

This implementation accompanies the final year project report *"A Centralized Inventory and Asset Management System with Automated Alert Notification for an Integrated Computing Business Hub."*

## Project Structure

```
app/
├── server/     Node.js + Express.js REST API, MongoDB models, scheduled alert engine
└── client/     React.js (Vite) single-page front end
```

## Tech Stack

| Layer               | Technology                          |
|---------------------|--------------------------------------|
| Front end           | React.js, React Router, Axios, Recharts |
| Back end            | Node.js, Express.js                 |
| Database            | MongoDB (Mongoose ODM)              |
| Authentication      | JSON Web Tokens (JWT), bcrypt.js    |
| Scheduled alerts    | node-cron                           |
| Email notifications | Nodemailer (SMTP)                   |

## Getting Started

### 1. Backend Setup

```bash
cd server
npm install
cp .env.example .env   # then edit .env with your MongoDB URI, JWT secret, and SMTP credentials
npm run seed            # creates a default Administrator account and sample categories
npm run dev              # starts the API on http://localhost:5000
```

Default seeded login: `admin@example.com` / `Admin@123` — change this password immediately after first login.

### 2. Frontend Setup

```bash
cd client
npm install
cp .env.example .env    # adjust VITE_API_BASE_URL if your backend runs elsewhere
npm run dev               # starts the React app on http://localhost:5173
```

### 3. Using the System

1. Log in with the seeded Administrator account.
2. Create categories, suppliers, and additional user accounts (Store Officer, Asset Custodian, Manager) from the Users page.
3. Add inventory items and record Stock-In/Stock-Out transactions from the Inventory page.
4. Register assets and assign them to custodians from the Assets page.
5. The scheduled alert engine (configured via `ALERT_CRON_SCHEDULE` in `server/.env`, default every 30 minutes) automatically checks for low-stock items and assets due for review, and emails the configured recipient. Generated alerts are also visible on the Alerts page.

## Database Design

The MongoDB collections directly mirror the Entity-Relationship Diagram (Figure 4.5) in the project report:

- `User`, `Category`, `Supplier`, `InventoryItem`, `StockTransaction`, `Asset`, `AssetMovementLog`, `Alert`

## Deployment Notes

- The front end and back end are independent applications and can be deployed to any Node-compatible hosting platform (e.g., Render, Railway) and static hosting platform (e.g., Vercel, Netlify) respectively.
- Set `CLIENT_ORIGIN` in the server's environment variables to the deployed front-end URL to enable CORS.
- Set `VITE_API_BASE_URL` in the client's environment variables to the deployed backend's API URL before building the front end for production.

## License

Developed as part of an academic final year project. Free to reuse and adapt for educational purposes.
