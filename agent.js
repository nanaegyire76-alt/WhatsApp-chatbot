const Anthropic = require("@anthropic-ai/sdk");
const { ANTHROPIC_API_KEY, YOUR_NAME } = require("./config");
const { getHistory, isNewContact } = require("./history");

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const BASE_PERSONALITY = `
You are acting as ${YOUR_NAME}, a real person replying to WhatsApp messages while they are offline.

WHO ${YOUR_NAME} IS:
- A Ghanaian entrepreneur and digital creator based in Ghana
- Founder of "Nana The AI Guru" — helps people use AI tools to make money online
- Builds AI-powered web apps, digital products, and educational content
- Runs a content channel called MindFold76 covering psychology, history, tech, and civilization
- Friendly, smart, and straight to the point

HOW ${YOUR_NAME} TEXTS:
- Casual and warm with friends, professional with business contacts
- Uses occasional Ghanaian expressions naturally
- Keeps replies concise — no essays on WhatsApp
- Sometimes uses emojis but not excessively
- Direct and helpful

RULES:
- Never reveal you are an AI unless seriously asked
- If asked "are you a bot?", say: "Haha no, just using auto-reply while I'm away 😄"
- Never send more than 3 short paragraphs
- Never make business promises or share personal financial details
`;

function analyzeMessageStyle(message) {
  const lower = message.toLowerCase();
  const isFormal = /\b(dear|hello|good morning|sir|madam|kindly)\b/.test(lower);
  const isCasual = /\b(hey|yo|sup|lol|bruh|bro|sis)\b/.test(lower);
  const isPidgin = /\b(abeg|abi|na|wahala|chale|charle|ei|herh)\b/.test(lower);
  const isShort = message.trim().split(" ").length < 6;

  if (isPidgin) return "Reply in a casual Ghanaian style using appropriate expressions.";
  if (isFormal) return "Reply in a polished but warm professional tone.";
  if (isCasual) return "Match their energy — be relaxed, friendly, and brief.";
  if (isShort) return "Be concise and direct.";
  return "Reply in your natural warm and friendly tone.";
}

async function generateReply(contactPhone, incomingMessage, contactName) {
  const history = getHistory(contactPhone);
  const newContact = isNewContact(contactPhone);

  let systemPrompt = BASE_PERSONALITY;

  if (newContact) {
    const styleNote = analyzeMessageStyle(incomingMessage);
    systemPrompt += `\n\nThis is a NEW contact.`;
    if (contactName) systemPrompt += ` Their name is ${contactName}.`;
    systemPrompt += `\nSTYLE: ${styleNote}`;
  } else {
    systemPrompt += `\n\nExisting contact — match your established tone with them.`;
    if (contactName) systemPrompt += ` Their name is ${contactName}.`;
  }

  const messages = [
    ...history,
    { role: "user", content: incomingMessage },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemPrompt,
      messages: messages,
    });
    return response.content[0].text.trim();
  } catch (error) {
    console.error("Claude API error:", error.message);
    return "Hey! I'm a bit tied up right now, I'll get back to you soon 🙏";
  }
}

module.exports = { generateReply };
