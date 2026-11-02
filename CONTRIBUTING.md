# EWUmate Admin Panel — Contributing Guidelines

Thank you for contributing to the **EWUmate Admin Panel**! This is a web application built with **React, TypeScript, Vite, and Tailwind CSS** for managing academic datasets, advising schedules, user feedback, and portal operations.

---

## 🛠️ Getting Started

1. **Prerequisites:**
   - Node.js 18+ (or 20+)
   - npm / pnpm

2. **Setup:**
   ```bash
   # Install dependencies
   npm install

   # Configure environment
   cp .env.example .env
   ```

3. **Development Server:**
   ```bash
   npm run dev
   ```

4. **Production Build & Lint:**
   ```bash
   npm run build
   npm run lint
   ```

---

## 📐 Project Structure

- `src/pages/`: Admin routes (Users, Courses, AcademicData, Diagnostics, etc.)
- `src/components/`: Reusable Tailwind components (Dialog, Table, Badges, etc.)
- `src/lib/`: Supabase client integration & utility helpers

---

## 🔒 Security
- All sensitive database write actions are protected by Supabase Row Level Security (RLS) policies requiring administrative role tokens.
- Never commit `.env` or Service Role keys to source control.
