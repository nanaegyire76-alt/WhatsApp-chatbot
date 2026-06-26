/**
 * index.js
 * Main server — handles WhatsApp Cloud API webhooks
 * Receives messages → passes to Claude → sends reply back
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const config = require("./config");
const { generateReply } = require("./agent");
const { addMessage } = require("./history");

const app = express();
app.use(express.json());

// Track processed message IDs to avoid duplicate replies
const processedMessages = new Set();

// ============================================================
// WEBHOOK VERIFICATION
// Meta calls this once when you set up the webhook
// ============================================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verified by Meta");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// ============================================================
// INCOMING MESSAGES WEBHOOK
// Meta sends all incoming WhatsApp messages here
// ============================================================
app.post("/webhook", async (req, res) => {
  // Always respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  try {
    const body = req.body;

    // Validate it's a WhatsApp message event
    if (
      body.object !== "whatsapp_business_account" ||
      !body.entry?.[0]?.changes?.[0]?.value?.messages
    ) {
      return;
    }

    const value = body.entry[0].changes[0].value;
    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Only handle text messages for now
    if (message.type !== "text") {
      console.log(`⏭️ Skipping non-text message type: ${message.type}`);
      return;
    }

    const messageId = message.id;
    const senderPhone = message.from;
    const senderName = contact?.profile?.name || null;
    const incomingText = message.text.body;

    // Skip if already processed (Meta sometimes sends duplicates)
    if (processedMessages.has(messageId)) {
      console.log(`⏭️ Duplicate message skipped: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);

    // Clean up old message IDs after 10 minutes to save memory
    setTimeout(() => processedMessages.delete(messageId), 10 * 60 * 1000);

    console.log(`📨 Message from ${senderName || senderPhone}: ${incomingText}`);

    // Store incoming message in history
    addMessage(senderPhone, "user", incomingText);

    // Small human-like delay before replying
    await new Promise((r) => setTimeout(r, config.REPLY_DELAY_MS));

    // Generate AI reply
    const reply = await generateReply(senderPhone, incomingText, senderName);

    console.log(`🤖 Replying: ${reply}`);

    // Store reply in history
    addMessage(senderPhone, "assistant", reply);

    // Send the reply via WhatsApp Cloud API
    await sendWhatsAppMessage(senderPhone, reply);

  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
  }
});

// ============================================================
// SEND MESSAGE VIA WHATSAPP CLOUD API
// ============================================================
async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`✅ Reply sent to ${to}`);
  } catch (error) {
    console.error(
      "❌ Failed to send WhatsApp message:",
      error.response?.data || error.message
    );
  }
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get("/", (req, res) => {
  res.json({
    status: "running",
    agent: "Nana AI WhatsApp Agent",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(config.PORT, () => {
  console.log(`🚀 Nana AI WhatsApp Agent running on port ${config.PORT}`);
  console.log(`📡 Webhook URL: https://YOUR_DOMAIN/webhook`);
});
