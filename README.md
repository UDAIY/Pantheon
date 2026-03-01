# Secure Login and Registration System

## Setup Instructions

1. **Install dependencies:**
   Make sure you have Node.js installed, then run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   - Copy `.env.template` and rename it to `.env`:
     ```bash
     cp .env.template .env
     ```
   - Open `.env` and replace `MONGO_URI` with your actual MongoDB connection string.
   - You can also change `JWT_SECRET` to a secure random string.

3. **Start the server:**
   ```bash
   node server.js
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.
