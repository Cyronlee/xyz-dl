const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 批量下载小宇宙播客
 */

async function extractAudioUrl(episodeUrl) {
  const episodeId = episodeUrl.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
  if (!episodeId) return null;

  try {
    const response = await axios.get(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // 查找 audio 标签
    const audioSrc = $('audio source[src]').attr('src') || $('audio[src]').attr('src');
    if (audioSrc) return audioSrc;

    // 在脚本中查找
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (content && content.includes('media.xyzcdn.net')) {
        const match = content.match(/https:\/\/media\.xyzcdn\.net\/[^\s"'<>]+/);
        if (match) return match[0];
      }
    }

    // 内联数据
    const inlineData = response.data.match(/"audio"\s*:\s*"([^"]+)"/);
    if (inlineData && inlineData[1]) return inlineData[1];

  } catch (error) {
    console.error(`  请求失败：${error.message}`);
  }

  return null;
}

async function downloadAudio(audioUrl, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 60000
    });

    const writer = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      let downloaded = 0;
      const total = parseInt(response.headers['content-length'] || 0);
      
      response.data.on('data', chunk => {
        downloaded += chunk.length;
        if (total > 0) {
          process.stdout.write(`\r  下载进度：${((downloaded / total) * 100).toFixed(1)}%`);
        }
      });
      
      writer.on('finish', () => {
        console.log('\n');
        resolve();
      });
      
      writer.on('error', reject);
    });
  } catch (error) {
    throw new Error(`下载失败：${error.message}`);
  }
}

async function batchDownload(episodeUrls, outputDir = './downloads') {
  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`📥 开始批量下载，共 ${episodeUrls.length} 个播客\n`);

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < episodeUrls.length; i++) {
    const url = episodeUrls[i];
    console.log(`[${i + 1}/${episodeUrls.length}] 处理：${url}`);

    try {
      const audioUrl = await extractAudioUrl(url);
      
      if (!audioUrl) {
        console.log('  ⚠️  未找到音频地址，跳过\n');
        results.failed.push({ url, reason: '未找到音频地址' });
        continue;
      }

      console.log(`  ✓ 找到音频：${audioUrl.substring(0, 60)}...`);

      // 生成文件名
      const episodeId = url.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
      const fileName = `${episodeId}.m4a`;
      const outputPath = path.join(outputDir, fileName);

      // 检查是否已下载
      if (fs.existsSync(outputPath)) {
        console.log('  ⏭️  文件已存在，跳过\n');
        continue;
      }

      // 下载
      await downloadAudio(audioUrl, outputPath);
      console.log(`  ✅ 下载完成：${fileName}\n`);
      results.success.push({ url, file: fileName });

    } catch (error) {
      console.log(`  ❌ 错误：${error.message}\n`);
      results.failed.push({ url, reason: error.message });
    }

    // 添加延迟，避免请求过快
    if (i < episodeUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 输出统计
  console.log('\n📊 下载统计:');
  console.log(`  成功：${results.success.length}`);
  console.log(`  失败：${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n  失败的链接:');
    results.failed.forEach(item => {
      console.log(`    - ${item.url} (${item.reason})`);
    });
  }

  return results;
}

// 主函数
async function main() {
  console.log('🎵 小宇宙批量下载器\n');

  // 从命令行参数或文件读取链接列表
  let episodeUrls = [];

  if (process.argv[2]) {
    // 从文件读取
    const listFile = process.argv[2];
    if (fs.existsSync(listFile)) {
      const content = fs.readFileSync(listFile, 'utf-8');
      episodeUrls = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('http'));
      console.log(`📄 从文件读取：${listFile}`);
    } else {
      // 单个链接
      episodeUrls = [process.argv[2]];
    }
  } else {
    // 示例链接
    console.log('用法:');
    console.log('  node batch-download.js <链接文件.txt>');
    console.log('  node batch-download.js <单个播客链接>');
    console.log('\n链接文件格式 (每行一个):');
    console.log('  https://www.xiaoyuzhoufm.com/episode/xxx');
    console.log('  https://www.xiaoyuzhoufm.com/episode/yyy');
    process.exit(0);
  }

  console.log(`待下载：${episodeUrls.length} 个播客\n`);

  const outputDir = process.argv[3] || './downloads';
  await batchDownload(episodeUrls, outputDir);
}

main();
