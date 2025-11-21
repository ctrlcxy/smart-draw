/**
 * 代码处理管道 - 提供可组合的代码后处理步骤
 * 使用管道模式 (Pipeline Pattern) 处理 LLM 生成的代码
 */

import fixUnclosed, { fixJSON } from './fixUnclosed.js';
import { optimizeExcalidrawCode } from './optimizeArrows.js';

/**
 * 代码处理器类 - 管道模式实现
 */
export class CodeProcessor {
  constructor(steps = []) {
    this.steps = steps;
  }

  /**
   * 执行处理管道
   */
  process(code) {
    return this.steps.reduce((result, step) => {
      try {
        return step(result);
      } catch (error) {
        console.error('Code processor step error:', error);
        return result; // 返回上一步的结果，继续执行
      }
    }, code);
  }

  /**
   * 添加处理步骤
   */
  addStep(step) {
    this.steps.push(step);
    return this;
  }
}

// ==================== 通用处理步骤 ====================

/**
 * 清理 BOM 和零宽字符
 */
export const cleanBOM = (code) => {
  if (!code || typeof code !== 'string') return code;
  return code
    .replace(/\ufeff/g, '') // 清理 BOM
    .replace(/[\u200B-\u200D\u2060]/g, '') // 清理零宽字符
    .trim();
};

/**
 * 提取代码块（支持指定语言或任意代码块）
 * @param {string} code - 原始代码
 * @param {string|null} lang - 语言标识符 (如 'xml', 'json')，null 表示任意代码块
 * @returns {string} 提取的代码
 */
export const extractCodeFence = (code, lang = null) => {
  if (!code || typeof code !== 'string') return code;

  if (lang) {
    // 提取特定语言的代码块
    const pattern = new RegExp(`\`\`\`\\s*${lang}\\s*([\\s\\S]*?)\`\`\``, 'i');
    const match = code.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // 回退：提取任意代码块
  const fencedAnyMatch = code.match(/```\s*([\s\S]*?)```/);
  if (fencedAnyMatch && fencedAnyMatch[1]) {
    return fencedAnyMatch[1].trim();
  }

  return code.trim();
};

/**
 * HTML 反转义
 */
export const unescapeHTML = (code) => {
  if (!code || typeof code !== 'string') return code;

  // 只在需要时才进行反转义（检测是否包含 HTML 实体但不包含原始标签）
  if (!/[<][a-z!?]/i.test(code) && /&lt;\s*[a-z!?]/i.test(code)) {
    return code
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  return code;
};

// ==================== XML 专用处理步骤 ====================

/**
 * 提取 XML 主要内容块
 */
export const extractXML = (code) => {
  if (!code || typeof code !== 'string') return code;

  const start = code.search(/<(mxfile|mxGraphModel|diagram)([\s>])/i);
  const end = code.lastIndexOf('>');

  if (start !== -1 && end !== -1 && end > start) {
    return code.slice(start, end + 1);
  }

  return code;
};

/**
 * 修复 XML 未闭合标签
 */
export const fixXML = (code) => {
  if (!code || typeof code !== 'string') return code;
  return fixUnclosed(code, { mode: 'xml' });
};

// ==================== JSON 专用处理步骤 ====================

/**
 * 提取 JSON 主要内容块
 */
export const extractJSON = (code) => {
  if (!code || typeof code !== 'string') return code;

  const objStart = code.indexOf('{');
  const objEnd = code.lastIndexOf('}');
  const arrStart = code.indexOf('[');
  const arrEnd = code.lastIndexOf(']');

  // 优先提取数组（如果数组开始在对象之前）
  if (arrStart !== -1 && arrEnd !== -1 && (objStart === -1 || arrStart < objStart)) {
    return code.slice(arrStart, arrEnd + 1);
  }

  // 否则提取对象
  if (objStart !== -1 && objEnd !== -1) {
    return code.slice(objStart, objEnd + 1);
  }

  return code;
};

/**
 * 修复 JSON 格式问题
 */
export const repairJSON = (code) => {
  if (!code || typeof code !== 'string') return code;
  return fixJSON(code);
};

/**
 * 更严格的 JSON 数组提取:
 * - 从首个 `[` 开始, 按括号深度找到匹配的 `]`
 * - 忽略字符串内部的括号
 * - 如果无法完整匹配, 回退到 extractJSON 的行为
 *
 * 主要用于 Excalidraw, 避免简单的 indexOf/lastIndexOf 误截断外层数组。
 */
export const extractJSONArrayStrict = (code) => {
  if (!code || typeof code !== 'string') return code;

  const text = code;
  const len = text.length;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < len; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      escaped = false;
      continue;
    }

    if (ch === '[') {
      if (start === -1) {
        start = i;
      }
      depth += 1;
    } else if (ch === ']') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          // 找到完整的最外层数组
          return text.slice(start, i + 1);
        }
      }
    }
  }

  // 如果没能匹配出完整数组, 回退到原有逻辑
  return extractJSON(code);
};

/**
 * 优化 Excalidraw 箭头坐标
 */
export const optimizeArrows = (code) => {
  if (!code || typeof code !== 'string') return code;
  if (optimizeExcalidrawCode) {
    return optimizeExcalidrawCode(code);
  }

  return code;
};

/**
 * 确保 Excalidraw 代码最终为 JSON 数组字符串
 * - 支持直接数组: [ ... ]
 * - 支持对象包装: { elements: [ ... ] } / { items: [ ... ] }
 * - 如果是单个对象, 则包装为长度为 1 的数组
 * - 对于继续对话时模型只输出元素片段的情况, 尝试自动补上外层 []
 */
export const ensureExcalidrawArray = (code) => {
  if (!code || typeof code !== 'string') return code;

  const trimmed = code.trim();
  if (!trimmed) return trimmed;

  // 已经是数组形式, 优先直接验证并规范化
  if (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']') {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data)) {
        return JSON.stringify(data, null, 2);
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  try {
    const data = JSON.parse(trimmed);

    if (Array.isArray(data)) {
      return JSON.stringify(data, null, 2);
    }

    if (data && Array.isArray(data.elements)) {
      return JSON.stringify(data.elements, null, 2);
    }

    if (data && Array.isArray(data.items)) {
      return JSON.stringify(data.items, null, 2);
    }

    // 其他可解析的 JSON, 统一视为单元素数组
    return JSON.stringify([data], null, 2);
  } catch {
    // 解析失败时, 尝试为缺失外层 [] 的情况补上
    const withBrackets = `[${trimmed}]`;
    try {
      const arr = JSON.parse(withBrackets);
      if (Array.isArray(arr)) {
        return JSON.stringify(arr, null, 2);
      }
    } catch {
      // ignore
    }

    // 尝试提取内部的数组片段
    const innerMatch = trimmed.match(/\[[\s\S]*\]/);
    if (innerMatch && innerMatch[0]) {
      const inner = innerMatch[0];
      try {
        const arr = JSON.parse(inner);
        if (Array.isArray(arr)) {
          return JSON.stringify(arr, null, 2);
        }
      } catch {
        // ignore
      }
    }

    // 无法修复时, 返回原始文本
    return trimmed;
  }
};

// ==================== 预定义处理器 ====================

/**
 * Draw.io XML 处理器
 */
export const drawioProcessor = new CodeProcessor([
  cleanBOM,
  (code) => extractCodeFence(code, 'xml'),
  unescapeHTML,
  extractXML,
  fixXML,
]);

/**
 * Excalidraw JSON 处理器
 */
export const excalidrawProcessor = new CodeProcessor([
  cleanBOM,
  (code) => extractCodeFence(code, 'json'),
  extractJSONArrayStrict,
  repairJSON,
  optimizeArrows,
  ensureExcalidrawArray,
]);

// ==================== 工厂函数 ====================

/**
 * 创建自定义处理器
 * @param {Array<Function>} steps - 处理步骤数组
 * @returns {CodeProcessor}
 */
export function createProcessor(...steps) {
  return new CodeProcessor(steps);
}

/**
 * 创建 XML 处理器（可自定义步骤）
 */
export function createXMLProcessor(customSteps = []) {
  return new CodeProcessor([
    cleanBOM,
    (code) => extractCodeFence(code, 'xml'),
    unescapeHTML,
    extractXML,
    ...customSteps,
    fixXML,
  ]);
}

/**
 * 创建 JSON 处理器（可自定义步骤）
 */
export function createJSONProcessor(customSteps = []) {
  return new CodeProcessor([
    cleanBOM,
    (code) => extractCodeFence(code, 'json'),
    extractJSON,
    ...customSteps,
    repairJSON,
  ]);
}
