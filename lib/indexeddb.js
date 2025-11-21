'use client';

// Lightweight IndexedDB helper focused on simple CRUD for conversations/messages/blobs

const DB_NAME = 'smart-diagram-db';
const DB_VERSION = 2; // Upgraded for v6.0 refactor

let dbPromise = null;

export function openDB() {
  if (typeof window === 'undefined') return Promise.reject(new Error('IndexedDB unavailable on server'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion || 0;
      const tx = event.target.transaction;

      // version 1 schema
      if (oldVersion < 1) {
        // Conversations store: one record per conversation
        const conv = db.createObjectStore('conversations', { keyPath: 'id' });
        conv.createIndex('updatedAt', 'updatedAt', { unique: false });

        // Messages store: individual messages linked to conversations
        const msg = db.createObjectStore('messages', { keyPath: 'id' });
        msg.createIndex('conversationId', 'conversationId', { unique: false });
        msg.createIndex('createdAt', 'createdAt', { unique: false });

        // Blobs/attachments store: binary payloads
        db.createObjectStore('blobs', { keyPath: 'id' });
      }

      // version 2 schema (v6.0 refactor)
      if (oldVersion < 2) {
        // Add message field to messages (migrate existing data)

        const msgStore = tx.objectStore('messages');

        // Migrate messages: convert to LLM native format
        // Old format: { id, conversationId, role, content, type, attachments, createdAt }
        // New format: { id, conversationId, message: { role, content }, createdAt }
        const msgReq = msgStore.openCursor();
        msgReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const msg = cursor.value;
            // If message field doesn't exist, migrate
            if (typeof msg.message === 'undefined') {
              const newMsg = {
                id: msg.id,
                conversationId: msg.conversationId,
                message: {
                  role: msg.role || 'user',
                  content: msg.content || ''
                },
                createdAt: msg.createdAt || Date.now()
              };
              cursor.update(newMsg);
            }
            cursor.continue();
          }
        };
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function withTx(stores, mode, fn) {
  const db = await openDB();
  const tx = db.transaction(stores, mode);
  const storeMap = Object.fromEntries(stores.map((name) => [name, tx.objectStore(name)]));
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
  const res = await fn(storeMap, tx);
  await done;
  return res;
}

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addConversationIfMissing({ id, title, chartType, config, editor }) {
  const now = Date.now();
  return withTx(['conversations'], 'readwrite', async ({ conversations }) => {
    const getReq = conversations.get(id);
    const existing = await reqAsPromise(getReq);
    const record = existing || { id, title: title || '对话', chartType: chartType || 'auto', config: config || null, createdAt: now, updatedAt: now };
    if (existing) {
      record.updatedAt = now;
      if (title) record.title = title;
      if (chartType) record.chartType = chartType;
      if (config) record.config = config;
      if (editor) record.editor = editor;
    } else if (editor) {
      record.editor = editor;
    }
    await reqAsPromise(conversations.put(record));
    return record;
  });
}

export async function putMessage(message) {
  return withTx(['messages', 'conversations'], 'readwrite', async ({ messages, conversations }) => {
    await reqAsPromise(messages.put(message));
    // bump conversation updatedAt
    const conv = await reqAsPromise(conversations.get(message.conversationId));
    if (conv) {
      conv.updatedAt = Math.max(conv.updatedAt || 0, message.createdAt || Date.now());
      await reqAsPromise(conversations.put(conv));
    }
  });
}

export async function getConversationMessages(conversationId) {
  return withTx(['messages'], 'readonly', async ({ messages }) => {
    const idx = messages.index('conversationId');
    const range = IDBKeyRange.only(conversationId);
    const results = await getAllFromIndex(idx, range);
    results.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return results;
  });
}

export async function listConversations() {
  return withTx(['conversations'], 'readonly', async ({ conversations }) => {
    const all = await getAllStore(conversations);
    all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return all;
  });
}

export async function deleteConversation(conversationId) {
  // delete messages and collect blob ids, then delete conversation
  return withTx(['messages', 'conversations', 'blobs'], 'readwrite', async ({ messages, conversations, blobs }) => {
    // delete messages in conversation
    const idx = messages.index('conversationId');
    const range = IDBKeyRange.only(conversationId);
    const msgList = await getAllFromIndex(idx, range);
    const blobIds = new Set();
    for (const m of msgList) {
      if (Array.isArray(m.attachments)) {
        m.attachments.forEach((att) => { if (att && att.blobId) blobIds.add(att.blobId); });
      }
      await reqAsPromise(messages.delete(m.id));
    }
    for (const id of blobIds) {
      await reqAsPromise(blobs.delete(id));
    }
    await reqAsPromise(conversations.delete(conversationId));
  });
}

// Replace all messages of a conversation with a new ordered list.
// messages: array of LLM-native message objects { role, content, ... }
export async function replaceConversationMessages({ conversationId, messages: newMessages, editor, config, chartType }) {
  const now = Date.now();
  return withTx(['messages', 'conversations'], 'readwrite', async ({ messages, conversations }) => {
    // Remove existing messages for this conversation
    const idx = messages.index('conversationId');
    const range = IDBKeyRange.only(conversationId);
    const existing = await getAllFromIndex(idx, range);
    for (const m of existing) {
      await reqAsPromise(messages.delete(m.id));
    }

    // Ensure / update conversation record
    const existingConv = await reqAsPromise(conversations.get(conversationId));
    const convRecord = existingConv || {
      id: conversationId,
      title: '对话',
      chartType: chartType || 'auto',
      config: config || null,
      editor: editor,
      createdAt: now,
      updatedAt: now,
    };
    if (existingConv) {
      convRecord.updatedAt = now;
      if (typeof chartType !== 'undefined') convRecord.chartType = chartType;
      if (typeof config !== 'undefined') convRecord.config = config;
      if (editor) convRecord.editor = editor;
    }
    await reqAsPromise(conversations.put(convRecord));

    // Insert new messages in order
    if (Array.isArray(newMessages)) {
      let offset = 0;
      for (const msg of newMessages) {
        if (!msg) continue;
        const record = {
          id: generateId(),
          conversationId,
          message: msg,
          createdAt: now + offset,
        };
        offset += 1;
        await reqAsPromise(messages.put(record));
      }
    }
  });
}

export async function clearAllStores() {
  return withTx(['messages', 'conversations', 'blobs'], 'readwrite', async ({ messages, conversations, blobs }) => {
    await reqAsPromise(messages.clear());
    await reqAsPromise(conversations.clear());
    await reqAsPromise(blobs.clear());
  });
}

export async function putBlob({ id, blob, name, type, size }) {
  return withTx(['blobs'], 'readwrite', async ({ blobs }) => {
    await reqAsPromise(blobs.put({ id, blob, name, type, size }));
  });
}

export async function getBlob(id) {
  return withTx(['blobs'], 'readonly', async ({ blobs }) => {
    return reqAsPromise(blobs.get(id));
  });
}

// Helpers
function reqAsPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromIndex(index, range) {
  return new Promise((resolve, reject) => {
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
