/**
 * 配置管理器 - 管理前端本地保存的 LLM 配置
 *
 * 本地存储约定（仅本文件负责本地配置维度）：
 * - smart-diagram-local-configs      本地配置列表（数组）
 * - smart-diagram-active-local-config 当前选中的本地配置 ID
 *
 * 兼容历史版本：
 * - smart-diagram-configs            旧版本地配置列表
 * - smart-diagram-active-config      旧版激活配置 ID（现在仅用于迁移）
 */

class ConfigManager {
  constructor() {
    // 新版 key
    this.LOCAL_CONFIGS_KEY = 'smart-diagram-local-configs';
    this.ACTIVE_LOCAL_CONFIG_KEY = 'smart-diagram-active-local-config';

    // 旧版 key（仅在首次 load 时尝试迁移）
    this.LEGACY_CONFIGS_KEY = 'smart-diagram-configs';
    this.LEGACY_ACTIVE_CONFIG_KEY = 'smart-diagram-active-config';

    this.configs = [];
    this.activeConfigId = null;
    this.isLoaded = false;
  }

  /**
   * 生成唯一 ID
   */
  generateId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2)
    );
  }

  /**
   * 确保配置已从 localStorage 加载
   */
  ensureLoaded() {
    if (!this.isLoaded) {
      this.loadConfigs();
    }
  }

  /**
   * 从 localStorage 加载配置（包含一次性迁移逻辑）
   */
  loadConfigs() {
    if (typeof window === 'undefined') return;

    try {
      let usedLegacy = false;

      // 1) 读取配置列表：优先使用新 key
      const storedNew = localStorage.getItem(this.LOCAL_CONFIGS_KEY);
      if (storedNew) {
        this.configs = JSON.parse(storedNew);
      } else {
        const storedLegacy = localStorage.getItem(this.LEGACY_CONFIGS_KEY);
        this.configs = storedLegacy ? JSON.parse(storedLegacy) : [];
        if (storedLegacy) {
          usedLegacy = true;
        }
      }

      // 2) 读取当前激活的本地配置 ID
      let activeId = localStorage.getItem(this.ACTIVE_LOCAL_CONFIG_KEY);
      if (!activeId) {
        const legacyActiveId = localStorage.getItem(this.LEGACY_ACTIVE_CONFIG_KEY);
        if (legacyActiveId) {
          activeId = legacyActiveId;
          usedLegacy = true;
        }
      }

      this.activeConfigId = activeId || null;
      this.isLoaded = true;

      // 3) 如果还没有激活配置但列表非空，则默认第一个为激活配置
      if (!this.activeConfigId && this.configs.length > 0) {
        this.activeConfigId = this.configs[0].id;
        usedLegacy = true;
      }

      // 4) 如果本次读取涉及旧 key，则在保存时迁移到新 key，并清理旧 key
      if (usedLegacy) {
        this.saveConfigs();
        this.saveActiveConfigId();
        try {
          localStorage.removeItem(this.LEGACY_CONFIGS_KEY);
          localStorage.removeItem(this.LEGACY_ACTIVE_CONFIG_KEY);
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      this.configs = [];
      this.activeConfigId = null;
      this.isLoaded = true;
    }
  }

  /**
   * 将配置列表写入 localStorage
   */
  saveConfigs() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.LOCAL_CONFIGS_KEY, JSON.stringify(this.configs));
    } catch (error) {
      console.error('Failed to save configs:', error);
    }
  }

  /**
   * 将当前激活配置 ID 写入 localStorage
   */
  saveActiveConfigId() {
    if (typeof window === 'undefined') return;

    try {
      if (this.activeConfigId) {
        localStorage.setItem(this.ACTIVE_LOCAL_CONFIG_KEY, this.activeConfigId);
      } else {
        localStorage.removeItem(this.ACTIVE_LOCAL_CONFIG_KEY);
      }
    } catch (error) {
      console.error('Failed to save active config ID:', error);
    }
  }

  /**
   * 获取当前激活的本地配置 ID
   */
  getActiveConfigId() {
    this.ensureLoaded();
    return this.activeConfigId;
  }

  /**
   * 获取所有本地配置（浅拷贝）
   */
  getAllConfigs() {
    this.ensureLoaded();
    return [...this.configs];
  }

  /**
   * 根据 ID 获取配置
   */
  getConfig(id) {
    this.ensureLoaded();
    return this.configs.find((cfg) => cfg.id === id) || null;
  }

  /**
   * 获取当前激活的本地配置
   */
  getActiveConfig() {
    this.ensureLoaded();
    if (!this.activeConfigId) return null;
    return this.getConfig(this.activeConfigId);
  }

  /**
   * 设置当前激活的本地配置
   */
  setActiveConfig(id) {
    this.ensureLoaded();
    const cfg = this.getConfig(id);
    if (!cfg) {
      throw new Error('配置不存在');
    }

    this.activeConfigId = id;
    this.saveActiveConfigId();
    return cfg;
  }

  /**
   * 创建配置
   */
  createConfig(configData) {
    this.ensureLoaded();

    const now = new Date().toISOString();
    const newConfig = {
      id: this.generateId(),
      name: configData.name || '未命名配置',
      type: configData.type || 'openai',
      baseUrl: configData.baseUrl || '',
      apiKey: configData.apiKey || '',
      model: configData.model || '',
      description: configData.description || '',
      createdAt: now,
      updatedAt: now,
      ...configData,
    };

    this.configs.push(newConfig);

    // 如果目前还没有激活配置，则将新建的配置设为激活配置
    if (!this.activeConfigId) {
      this.activeConfigId = newConfig.id;
      this.saveActiveConfigId();
    }

    this.saveConfigs();
    return newConfig;
  }

  /**
   * 更新配置
   */
  updateConfig(id, updateData) {
    this.ensureLoaded();
    const index = this.configs.findIndex((cfg) => cfg.id === id);
    if (index === -1) {
      throw new Error('配置不存在');
    }

    const now = new Date().toISOString();
    this.configs[index] = {
      ...this.configs[index],
      ...updateData,
      id,
      updatedAt: now,
    };

    this.saveConfigs();
    return this.configs[index];
  }

  /**
   * 删除配置
   */
  deleteConfig(id) {
    this.ensureLoaded();
    const index = this.configs.findIndex((cfg) => cfg.id === id);
    if (index === -1) {
      throw new Error('配置不存在');
    }

    const deletingActive = this.activeConfigId === id;
    this.configs.splice(index, 1);

    if (deletingActive) {
      this.activeConfigId = this.configs[0]?.id || null;
      this.saveActiveConfigId();
    }

    this.saveConfigs();
  }

  /**
   * 校验配置字段是否合法
   */
  validateConfig(config) {
    const errors = [];
    if (!config.name || !config.name.trim()) {
      errors.push('配置名称不能为空');
    }

    if (!config.type || !['openai', 'anthropic'].includes(config.type)) {
      errors.push('配置类型必须是 openai 或 anthropic');
    }

    if (!config.baseUrl || !config.baseUrl.trim()) {
      errors.push('API 地址不能为空');
    } else {
      try {
        // 仅用于校验格式，不关心结果
        // eslint-disable-next-line no-new
        new URL(config.baseUrl);
      } catch {
        errors.push('API 地址格式不正确');
      }
    }

    if (!config.apiKey || !config.apiKey.trim()) {
      errors.push('API Key 不能为空');
    }

    if (!config.model || !config.model.trim()) {
      errors.push('模型名称不能为空');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// 导出单例
export const configManager = new ConfigManager();
export default ConfigManager;

