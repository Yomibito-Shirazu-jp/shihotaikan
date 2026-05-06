import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const OAuth2 = google.auth.OAuth2;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email API route utilizing Gmail API
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html } = req.body;

      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN || !process.env.GMAIL_USER) {
        console.warn("Gmail API configuration is missing. Email not sent.");
        res.json({ success: true, message: "Simulated email send (Gmail API not configured)" });
        return;
      }

      const myOAuth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );

      myOAuth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      const myAccessToken = await myOAuth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
           type: "OAuth2",
           user: process.env.GMAIL_USER, // Your gmail account
           clientId: process.env.GMAIL_CLIENT_ID,
           clientSecret: process.env.GMAIL_CLIENT_SECRET,
           refreshToken: process.env.GMAIL_REFRESH_TOKEN,
           accessToken: myAccessToken?.token || ""
        }
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        html,
      });

      res.json({ success: true, message: "Email sent via Gmail API successfully" });
    } catch (error) {
      console.error("Email sending Error:", error);
      res.status(500).json({ success: false, error: "Failed to send email" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // We are in production. The dist folder will be created correctly.
    // esbuild runs from project root when compiled
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
