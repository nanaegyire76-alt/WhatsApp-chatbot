const { MAX_HISTORY_MESSAGES } = require("./config");

const contactHistories = {};

function addMessage(contactPhone, role, content) {
  if (!contactHistories[contactPhone]) {
    contactHistories[contactPhone] = [];
  }

  contactHistories[contactPhone].push({ role, content });

  if (contactHistories[contactPhone].length > MAX_HISTORY_MESSAGES) {
    contactHistories[contactPhone] = contactHistories[contactPhone].slice(
      -MAX_HISTORY_MESSAGES
    );
  }
}

function getHistory(contactPhone) {
  return contactHistories[contactPhone] || [];
}

function isNewContact(contactPhone) {
  return (
    !contactHistories[contactPhone] ||
    contactHistories[contactPhone].length === 0
  );
}

function clearHistory(contactPhone) {
  delete contactHistories[contactPhone];
}

module.exports = { addMessage, getHistory, isNewContact, clearHistory };
