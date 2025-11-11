import { addConversationIfMissing, putMessage, listConversations, getConversationMessages, deleteConversation, clearAllStores, putBlob, generateId as idbGenerateId } from './indexeddb';

class HistoryManager {
  constructor() {
    this.ready = false;
  }

  async ensureReady() {
    if (typeof window === 'undefined') return;
    if (this.ready) return;
    this.ready = true;
  }

  generateId() {
    return idbGenerateId();
  }

  /**
   * Add a history entry as part of a conversation. If the conversation does not exist, creates it.
   * This stores two messages (user + assistant) and any binary attachments in IndexedDB.
   *
   * data = {
   *   conversationId, chartType, userInput, generatedCode, config,
   *   images: [{ file, name, type }],
   *   files: [{ file, name, type, size }]
   * }
   */
  async addHistory(data) {
    await this.ensureReady();
    const conversationId = data.conversationId || this.generateId();
    const now = Date.now();

    // Ensure conversation exists
    await addConversationIfMissing({
      id: conversationId,
      title: data.userInput?.slice?.(0, 30) || '对话',
      chartType: data.chartType,
      config: data.config || null,
    });

    // Save binary attachments (if any) as blobs and collect references
    const attachmentRefs = [];
    const saveBlob = async (fileObj) => {
      try {
        const blobId = this.generateId();
        const file = fileObj?.file; // File or Blob
        if (!file) return null;
        const name = fileObj?.name || file.name || 'file';
        const type = fileObj?.type || file.type || 'application/octet-stream';
        const size = fileObj?.size || file.size || 0;
        await putBlob({ id: blobId, blob: file, name, type, size });
        return { blobId, name, type, size };
      } catch {
        return null;
      }
    };

    // images
    if (Array.isArray(data.images) && data.images.length > 0) {
      for (const im of data.images) {
        const ref = await saveBlob(im);
        if (ref) attachmentRefs.push({ ...ref, kind: 'image' });
      }
    }
    // files
    if (Array.isArray(data.files) && data.files.length > 0) {
      for (const f of data.files) {
        const ref = await saveBlob(f);
        if (ref) attachmentRefs.push({ ...ref, kind: 'file' });
      }
    }

    // Create user message
    const userMsg = {
      id: this.generateId(),
      conversationId,
      role: 'user',
      content: data.userInput || '',
      type: 'text',
      attachments: attachmentRefs,
      createdAt: now,
    };
    await putMessage(userMsg);

    // Create assistant message (XML)
    const assistantMsg = {
      id: this.generateId(),
      conversationId,
      role: 'assistant',
      content: data.generatedCode || '',
      type: 'xml',
      attachments: [],
      createdAt: now + 1,
    };
    await putMessage(assistantMsg);

    return { conversationId, userMessageId: userMsg.id, assistantMessageId: assistantMsg.id };
  }

  /**
   * Return conversation previews compatible with existing HistoryModal UI.
   * Each item includes: { id, chartType, userInput, generatedCode, config, timestamp }
   */
  async getHistories() {
    await this.ensureReady();
    const convs = await listConversations();
    const results = [];
    for (const c of convs) {
      const msgs = await getConversationMessages(c.id);
      const lastAssistantXml = [...msgs].reverse().find(m => m.role === 'assistant' && m.type === 'xml');
      const lastUser = [...msgs].reverse().find(m => m.role === 'user');

      // Derive a user preview: if there was no typed content but there are image attachments,
      // show a friendly hint like "来自图片: xxx" similar to file-only messages behavior.
      let userPreview = (lastUser?.content || '').trim();
      try {
        if (!userPreview && lastUser && Array.isArray(lastUser.attachments) && lastUser.attachments.length > 0) {
          const imageNames = lastUser.attachments
            .filter(att => att && att.kind === 'image')
            .map(att => (att.name || 'image').toString());
          if (imageNames.length > 0) {
            // Limit to a few names for preview brevity
            const shown = imageNames.slice(0, 3);
            const suffix = imageNames.length > 3 ? ` 等${imageNames.length}张` : '';
            userPreview = `来自图片: ${shown.join('、')}${suffix}`;
          }
        }
      } catch {}
      results.push({
        id: c.id,
        chartType: c.chartType || 'auto',
        userInput: userPreview,
        generatedCode: lastAssistantXml?.content || '',
        config: c.config || null,
        timestamp: c.updatedAt || c.createdAt || Date.now(),
      });
    }
    return results;
  }

  async deleteHistory(id) {
    await this.ensureReady();
    await deleteConversation(id);
  }

  async clearAll() {
    await this.ensureReady();
    await clearAllStores();
  }

  async getConversationMessages(id) {
    await this.ensureReady();
    return getConversationMessages(id);
  }
}

export const historyManager = new HistoryManager();
