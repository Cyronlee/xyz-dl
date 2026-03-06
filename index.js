/**
 * xyz-dl - 小宇宙播客下载器
 * 
 * 程序化使用 API
 */

const {
  extractEpisodeInfo,
  generateFilename,
  downloadAudio,
  downloadFile,
  embedCover
} = require('./lib/extractor');

module.exports = {
  /**
   * 提取播客信息
   * @param {string} episodeUrl - 播客链接
   * @returns {Promise<Object>} 播客信息（标题、播客名、音频 URL、封面 URL）
   */
  extractEpisodeInfo,
  
  /**
   * 生成文件名
   * @param {Object} info - 播客信息
   * @param {string} format - 文件格式 (默认 m4a)
   * @returns {string} 文件名
   */
  generateFilename,
  
  /**
   * 下载音频
   * @param {string} audioUrl - 音频 URL
   * @param {string} outputPath - 输出路径
   * @param {Function} progressCallback - 进度回调 (downloaded, total)
   * @returns {Promise<void>}
   */
  downloadAudio,
  
  /**
   * 下载文件
   * @param {string} url - 文件 URL
   * @param {string} outputPath - 输出路径
   * @returns {Promise<void>}
   */
  downloadFile,
  
  /**
   * 嵌入封面到音频文件
   * @param {string} audioPath - 音频文件路径
   * @param {string} coverUrl - 封面 URL
   * @param {Object} info - 播客信息（用于元数据）
   * @returns {Promise<boolean>} 是否成功
   */
  embedCover,
  
  /**
   * 一站式下载（带封面）
   * @param {string} episodeUrl - 播客链接
   * @param {Object} options - 选项
   * @param {string} options.outputDir - 输出目录
   * @param {string} options.filename - 自定义文件名
   * @param {boolean} options.embedCover - 是否嵌入封面（默认 true）
   * @returns {Promise<Object>} 下载结果
   */
  async download(episodeUrl, options = {}) {
    const {
      outputDir = '.',
      filename = null,
      embedCover: shouldEmbedCover = true
    } = options;

    const fs = require('fs');
    const path = require('path');

    // 提取信息
    const info = await extractEpisodeInfo(episodeUrl);
    
    // 创建目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 生成文件名
    const outputFile = filename || generateFilename(info);
    const outputPath = path.join(outputDir, outputFile);

    // 下载音频
    console.log(`📥 下载：${outputFile}`);
    await downloadAudio(info.audioUrl, outputPath);
    console.log('✅ 音频下载完成');

    // 嵌入封面
    if (shouldEmbedCover && info.coverUrl) {
      console.log('🎨 嵌入封面...');
      await embedCover(outputPath, info.coverUrl, info);
      console.log('✅ 封面已嵌入');
    }

    return {
      success: true,
      file: outputPath,
      info
    };
  }
};
