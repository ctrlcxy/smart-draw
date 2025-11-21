/**
 * SSE (Server-Sent Events) 流式响应解析器
 * 统一处理不同分隔符的 SSE 流
 */

/**
 * 解析 SSE 流式响应
 * @param {Response} response - Fetch 响应对象
 * @param {Object} options - 配置选项
 * @param {Function} options.onChunk - 每次接收到内容时的回调 (content) => void
 * @param {string} options.delimiter - 事件分隔符,默认 '\n\n' (标准 SSE)
 * @returns {Promise<string>} 完整累积的内容
 */
export async function parseSSEStream(response, { onChunk, delimiter = '\n\n' } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // 将新数据添加到缓冲区
      buffer += decoder.decode(value, { stream: true });

      // 按分隔符分割事件
      const events = buffer.split(delimiter);
      // 保留最后一个不完整的块
      buffer = events.pop() || '';

      // 处理每个完整的事件
      for (const event of events) {
        const trimmed = event.trim();
        if (!trimmed) continue;

        // 跳过 [DONE] 信号
        if (trimmed === 'data: [DONE]') continue;

        // 提取 data: 后的 JSON
        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.slice(6);
            const data = JSON.parse(jsonStr);

            // 检查错误
            if (data.error) {
              throw new Error(data.error);
            }

            // 累积内容
            if (typeof data.content === 'string') {
              accumulated += data.content;
              if (onChunk) {
                onChunk(accumulated);
              }
            }
          } catch (e) {
            console.error('SSE 解析错误:', e, 'Event:', trimmed);
            throw new Error(`流式响应解析失败: ${e.message}`);
          }
        }
      }
    }

    return accumulated;
  } catch (error) {
    console.error('SSE stream error:', error);
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

/**
 * 标准 SSE 解析 (分隔符 \n\n)
 */
export async function parseSSEStreamStandard(response, { onChunk } = {}) {
  return parseSSEStream(response, { onChunk, delimiter: '\n\n' });
}

/**
 * 备用 SSE 解析 (分隔符 \n,用于某些非标准实现)
 */
export async function parseSSEStreamAlt(response, { onChunk } = {}) {
  return parseSSEStream(response, { onChunk, delimiter: '\n' });
}
