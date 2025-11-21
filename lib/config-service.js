/**
 * 统一配置服务 - 单一职责管理所有 LLM 配置
 *
 * 职责:
 * - 配置 CRUD (本地配置列表管理)
 * - 模式管理 (本地配置 vs 访问密码模式)
 * - 配置验证
 * - 统一事件通知
 * - 旧版本兼容迁移
 */

import { configManager } from './config-manager.js';

// Storage Keys
const REMOTE_CONFIG_KEY = 'smart-diagram-remote-config';
const USE_PASSWORD_KEY = 'smart-diagram-use-password';
const ACCESS_PASSWORD_KEY = 'smart-diagram-access-password';
const LEGACY_CONFIG_KEY = 'smart-excalidraw-config';

class ConfigService {
  constructor() {
    this.#migrateLegacyConfig();
  }

  /**
   * 将旧版单一配置迁移到新的多配置管理器中
   * 只在首次运行时执行一次
   */
  #migrateLegacyConfig() {
    if (typeof window === 'undefined') return;

    try {
      const legacyConfig = localStorage.getItem(LEGACY_CONFIG_KEY);
      if (legacyConfig && configManager.getAllConfigs().length === 0) {
        const config = JSON.parse(legacyConfig);
        configManager.createConfig({
          name: config.name || '迁移的配置',
          type: config.type,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.model,
          description: '从旧版本迁移的配置',
        });
        localStorage.removeItem(LEGACY_CONFIG_KEY);
      }
    } catch (error) {
      console.error('Failed to migrate legacy config:', error);
    }
  }

  /**
   * 从 localStorage 读取远程配置
   */
  #getRemoteConfig() {
    if (typeof window === 'undefined') return null;

    try {
      const raw = localStorage.getItem(REMOTE_CONFIG_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      // 安全清理: 移除可能误存的 apiKey
      if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'apiKey')) {
        delete parsed.apiKey;
        localStorage.setItem(REMOTE_CONFIG_KEY, JSON.stringify(parsed));
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse remote config:', error);
      return null;
    }
  }

  /**
   * 派发配置变更事件
   */
  #notifyChange() {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this.getCurrentConfig() },
      })
    );
  }

  /**
   * 获取当前是否启用访问密码模式
   */
  isPasswordMode() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(USE_PASSWORD_KEY) === 'true';
  }

  /**
   * 设置访问密码模式
   */
  setPasswordMode(enabled) {
    if (typeof window === 'undefined') return;

    localStorage.setItem(USE_PASSWORD_KEY, String(enabled));
    this.#notifyChange();
  }

  /**
   * 获取访问密码
   */
  getAccessPassword() {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ACCESS_PASSWORD_KEY) || '';
  }

  /**
   * 设置访问密码
   */
  setAccessPassword(password) {
    if (typeof window === 'undefined') return;

    localStorage.setItem(ACCESS_PASSWORD_KEY, password || '');
    this.#notifyChange();
  }

  /**
   * 校验配置是否有效
   */
  validateConfig(config) {
    if (!config) {
      return { isValid: false, errors: ['配置不存在'] };
    }

    const errors = [];

    // 基础字段验证
    if (!config.type) errors.push('缺少 LLM 类型');
    if (!config.baseUrl) errors.push('缺少 API 地址');
    if (!config.model) errors.push('缺少模型名称');

    // 如果有基础字段错误，直接返回
    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // 在访问密码模式下，apiKey 由服务端提供，前端配置无需包含
    if (this.isPasswordMode() && this.getAccessPassword()) {
      return { isValid: true, errors: [] };
    }

    // 本地配置模式：必须有 apiKey
    if (!config.apiKey) {
      errors.push('缺少 API Key');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查配置是否有效（简化版，返回布尔值）
   */
  isConfigValid(config) {
    return this.validateConfig(config).isValid;
  }

  /**
   * 获取当前生效的配置
   * 根据模式自动选择本地配置或远程配置
   */
  getCurrentConfig() {
    if (typeof window === 'undefined') return null;

    const usePassword = this.isPasswordMode();

    if (usePassword) {
      // 访问密码模式：使用远程配置
      const remoteConfig = this.#getRemoteConfig();
      if (this.isConfigValid(remoteConfig)) {
        return {
          name: remoteConfig.name || '远程配置',
          type: remoteConfig.type,
          baseUrl: remoteConfig.baseUrl,
          model: remoteConfig.model,
          // 访问密码模式下不返回 apiKey
        };
      }
      return null;
    } else {
      // 本地配置模式：使用当前激活的本地配置
      const activeLocalConfig = configManager.getActiveConfig();
      if (this.isConfigValid(activeLocalConfig)) {
        return {
          name: activeLocalConfig.name,
          type: activeLocalConfig.type,
          baseUrl: activeLocalConfig.baseUrl,
          apiKey: activeLocalConfig.apiKey,
          model: activeLocalConfig.model,
        };
      }
      return null;
    }
  }

  /**
   * 设置远程配置（来自 API 验证）
   */
  setRemoteConfig(config) {
    if (typeof window === 'undefined') return;

    try {
      // 确保不保存 apiKey 到本地存储
      const sanitized = {
        name: config.name || '远程配置',
        type: config.type,
        baseUrl: config.baseUrl,
        model: config.model,
      };

      localStorage.setItem(REMOTE_CONFIG_KEY, JSON.stringify(sanitized));
      this.#notifyChange();
    } catch (error) {
      console.error('Failed to set remote config:', error);
      throw error;
    }
  }

  /**
   * 清除远程配置
   */
  clearRemoteConfig() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(REMOTE_CONFIG_KEY);
    this.#notifyChange();
  }

  // ==================== 本地配置管理（委托给 configManager）====================

  /**
   * 获取所有本地配置
   */
  listLocalConfigs() {
    return configManager.getAllConfigs();
  }

  /**
   * 获取当前激活的本地配置 ID
   */
  getActiveLocalConfigId() {
    return configManager.getActiveConfigId();
  }

  /**
   * 创建本地配置
   */
  createLocalConfig(configData) {
    const newConfig = configManager.createConfig(configData);
    this.#notifyChange();
    return newConfig;
  }

  /**
   * 更新本地配置
   */
  updateLocalConfig(id, updateData) {
    const updated = configManager.updateConfig(id, updateData);
    this.#notifyChange();
    return updated;
  }

  /**
   * 删除本地配置
   */
  deleteLocalConfig(id) {
    configManager.deleteConfig(id);
    this.#notifyChange();
  }

  /**
   * 设置当前激活的本地配置
   */
  setActiveLocalConfig(id) {
    const config = configManager.setActiveConfig(id);
    this.#notifyChange();
    return config;
  }

  /**
   * 根据 ID 获取本地配置
   */
  getLocalConfig(id) {
    return configManager.getConfig(id);
  }

  /**
   * 保存配置（兼容旧版 API）
   * 如果有激活配置则更新，否则创建新配置
   */
  saveConfig(config) {
    if (typeof window === 'undefined') return;

    try {
      const activeLocal = configManager.getActiveConfig();

      if (activeLocal) {
        return this.updateLocalConfig(activeLocal.id, config);
      } else {
        return this.createLocalConfig(config);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }
}

// 导出单例
export const configService = new ConfigService();

// 兼容旧版 API
export function getConfig() {
  return configService.getCurrentConfig();
}

export function isConfigValid(config) {
  return configService.isConfigValid(config);
}

export function saveConfig(config) {
  return configService.saveConfig(config);
}

// 导出 configManager 供直接访问（向后兼容）
export { configManager };
