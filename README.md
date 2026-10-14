<div align="center">

# ⚡ SplitUP (Web Edition)

**Split Expenses Easily with Friends & Track Personal Finances Seamlessly**

[![Live Demo](https://img.shields.io/badge/Demo-splitupweb.vercel.app-00bfa5?style=for-the-badge&logo=vercel&logoColor=white)](https://splitupweb.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Turso](https://img.shields.io/badge/Database-Turso%20(libSQL)-00e699?style=for-the-badge&logo=sqlite&logoColor=black)](https://turso.tech/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

</div>

---

## 📖 Overview

**SplitUP Web** is a modern, responsive, and privacy-friendly expense-sharing web application built with **React 19**, **Vite**, and **Turso (libSQL)**. It allows roommates, travel companions, and friends to split shared group expenses, simplify settlement debts, and manage personal expenses (such as groceries, shopping, books, food, utilities, and bills)—all within an intuitive, eye-soothing user interface.

Whether on desktop or mobile, SplitUP provides real-time cloud synchronization, multi-currency support, JSON backup/restore capabilities, and Google OAuth login.

---

## 🌟 Key Features

### 👥 Group Expense Splitting
- **Quick Group Creation & Join Codes**: Create shared expense groups or join existing ones with a short 6-character alphanumeric code.
- **Fair Bill Splitting**: Split bills equally or customize participant shares with zero hassle.
- **Smart Debt Simplification**: Automatically computes optimal repayment transactions between members to settle all debts with minimal payments.
- **Settle Up Modal**: Record settlements directly (Cash, UPI/MFS, Card) with instantaneous balance updates.

### 💳 Personal Wallet & Expense Tracker
- **Custom Categorization**: Keep track of personal expenditures like groceries, shopping, food & dining, books, utilities, and bills.
- **Independent Tracking**: Keep personal finances separate from group balances while viewing unified summaries.

### 📊 Analytics & Visual Insights
- **Category Breakdowns**: Interactive breakdown of where money was spent across various categories.
- **Monthly & Weekly Trends**: Clear summary cards highlighting total expenses, pending receivables, and owed balances.

### 🌐 Multi-Currency Support (31 Currencies)
- Native support for 31 international currencies with flag icons and dynamic formatting (BDT `৳`, USD `$`, EUR `€`, GBP `£`, INR `₹`, CAD `C$`, etc.).
- Switch currency instantly from settings with global dashboard re-calculation.

### 🌓 Eye-Soothing Adaptive Themes
- **Soft Dark Mode**: Carefully calibrated dark palette with glassmorphism and subtle accents that reduce eye strain.
- **Crisp Light Mode**: High-contrast, clean modern aesthetic.
- **System Default**: Automatically syncs with your operating system's theme preference.

### 💾 Data Management (Backup & Restore)
- **JSON Data Export**: Download a full snapshot of your groups, members, expenses, and settlements with one click.
- **JSON Data Import**: Easily restore or migrate your entire database anytime.

### 👤 Profile & Bio Management
- Customize profile name and personal status / short bio note (`shortProfile`).
- Live "Online" status indicator and Google avatar integration.

### 📱 Mobile-First Responsive Experience
- Optimized layout with a **5-Tab Bottom Navigation Bar** (*Dashboard, Groups, Expenses, Analytics, Settings*).
- Touch-friendly modal sheets and responsive card grids.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Routing** | [React Router DOM v7](https://reactrouter.com/) |
| **Database** | [Turso Database](https://turso.tech/) (`@libsql/client/web`) SQLite Cloud |
| **Authentication** | Custom Email/Password & [Google OAuth](https://developers.google.com/identity) (`@react-oauth/google`) |
| **Iconography** | [Phosphor Icons](https://phosphoricons.com/) (`@phosphor-icons/web`) |
| **Styling** | Vanilla CSS (CSS Variables, Glassmorphism, Responsive Grid/Flexbox) |
| **Deployment** | [Vercel](https://vercel.com/) with SPA Rewrite Configuration |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or later)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- A free [Turso Database](https://turso.tech/) account (optional for offline testing, recommended for cloud sync)

### 1. Clone the Repository
```bash
git clone https://github.com/Roy-29/SplitUP-Web.git
cd SplitUP-Web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):

```env
# Turso Database Configuration
VITE_TURSO_DATABASE_URL=libsql://your-database-name.turso.io
VITE_TURSO_AUTH_TOKEN=your-turso-database-auth-token

# Google OAuth Client ID (Optional, for Google Sign-In)
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

> **Note**: If Turso environment variables are omitted, SplitUP will automatically fall back to browser `localStorage` for offline testing.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```
The compiled production bundle will be generated inside the `dist/` directory.

---

## 🗄️ Database Architecture (Turso / SQLite)

SplitUP uses automated schema migrations initialized via `tursoClient.batch()`:

- **`users`**: User ID, name, email, hashed credentials, short profile bio, creation timestamp.
- **`groups`**: Group ID, group name, creator ID, unique 6-character `joinCode`, creation timestamp.
- **`members`**: Member ID, name, email, assigned `groupId`, linked `userId`.
- **`expenses`**: Expense ID, `groupId`, `userId`, `isPersonal` flag, title, amount, payer info, date, category, currency code, notes, and split participants.
- **`settlements`**: Settlement ID, `groupId`, payer name, recipient name, amount, date, and payment method (`CASH`, `UPI`, `CARD`).

---

## 🌐 Deployment to Vercel

The application is pre-configured with `vercel.json` for seamless Single Page Application (SPA) routing:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Deploy in one command with the Vercel CLI:
```bash
vercel --prod
```

Configure your environment variables in the Vercel Project Settings:
- `VITE_TURSO_DATABASE_URL`
- `VITE_TURSO_AUTH_TOKEN`
- `VITE_GOOGLE_CLIENT_ID`

---

## 📂 Project Structure

```text
webapp/
├── public/
│   ├── favicon.svg             # Custom SplitUP branded favicon
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── AnalyticsView.jsx   # Expense breakdown & spending charts
│   │   ├── AuthScreen.jsx      # Login & Signup with Google OAuth
│   │   ├── DashboardView.jsx   # Overview balances, quick actions, debts
│   │   ├── ExpensesView.jsx    # Group & Personal expense feed
│   │   ├── GroupCard.jsx       # Group item with join code and badges
│   │   ├── GroupsView.jsx      # Groups listing & join modal trigger
│   │   ├── JoinGroupModal.jsx  # Code-based group joining
│   │   ├── NewExpenseModal.jsx # Add expense (Group / Personal)
│   │   ├── NewGroupModal.jsx   # Create new group
│   │   ├── SettingsView.jsx    # Preferences, Backup/Restore, Bio, About
│   │   └── SettleUpModal.jsx   # Settle balances between members
│   ├── lib/
│   │   ├── BalanceCalculator.js# Debt simplification & net balance math
│   │   ├── CurrencyManager.js  # 31 currency definitions & formatting
│   │   └── turso.js            # Turso client, auth & CRUD operations
│   ├── store/
│   │   └── db.js               # Offline local database fallback
│   ├── App.jsx                 # Top-level routing & layout shell
│   ├── App.css                 # Responsive layout & navigation styling
│   ├── index.css               # Design tokens, variables & typography
│   └── main.jsx                # Application root entrypoint
├── vercel.json                 # Vercel SPA rewrite rules
├── package.json
└── README.md
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">
Made with ❤️ by the <b>SplitUP Team</b>
</div>
