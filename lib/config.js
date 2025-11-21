/**
 * LLM 配置统一读取入口
 * 简化为导出 ConfigService 实例和兼容 API
 */

export { configService, getConfig, isConfigValid, saveConfig, configManager } from './config-service.js';
