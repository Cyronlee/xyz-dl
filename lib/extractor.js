#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const { execSync } = require('child_process');

/**
 * 小宇宙播客音频提取器 - 支持封面嵌入
 */

async function extractEpisodeInfo(episodeUrl) {
  const episodeId = episodeUrl.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
  if (!episodeId) {
    throw new Error('无效的播客链接，无法提取 episode ID');
  }

  console.log(`正在分析 episode: ${episodeId}`);

  const response = await axios.get(episodeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
  });

  const $ = cheerio.load(response.data);
  
  // 提取标题
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('title').text().replace('小宇宙', '').replace('- 播客', '').trim();
  }

  // 提取播客名称
  let podcastName = $('.podcast-name').text().trim();
  if (!podcastName) {
    podcastName = $('[class*="podcast"]').first().text().trim();
  }

  // 提取封面图片 URL
  let coverUrl = null;
  
  // 方法 1: 查找 og:image
  coverUrl = $('meta[property="og:image"]').attr('content');
  
  // 方法 2: 查找 JSON-LD 中的图片
  if (!coverUrl) {
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data.image) {
          coverUrl = Array.isArray(data.image) ? data.image[0] : data.image;
        }
      } catch (e) {}
    }
  }

  // 方法 3: 查找页面中的大图片
  if (!coverUrl) {
    coverUrl = $('img[alt*="封面"], img[class*="cover"], img[class*="poster"]').first().attr('src');
  }

  // 提取音频 URL
  let audioUrl = null;

  // 方法 1: 查找 audio 标签
  audioUrl = $('audio source[src]').attr('src') || $('audio[src]').attr('src');

  // 方法 2: 在页面脚本中查找
  if (!audioUrl) {
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = $(scripts[i]).html();
      if (scriptContent && scriptContent.includes('media.xyzcdn.net')) {
        const match = scriptContent.match(/https:\/\/media\.xyzcdn\.net\/[^\s"'<>]+/);
        if (match) {
          audioUrl = match[0];
          break;
        }
      }
    }
  }

  // 方法 3: 查找内联数据
  if (!audioUrl) {
    const inlineData = response.data.match(/"audio"\s*:\s*"([^"]+)"/);
    if (inlineData && inlineData[1]) {
      audioUrl = inlineData[1];
    }
  }

  // 方法 4: 尝试 API
  if (!audioUrl) {
    try {
      const apiUrl = `https://www.xiaoyuzhoufm.com/v1/episode/${episodeId}`;
      const apiResponse = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': episodeUrl,
        }
      });
      if (apiResponse.data?.data?.audio) {
        audioUrl = apiResponse.data.data.audio;
      }
      if (apiResponse.data?.data?.image && !coverUrl) {
        coverUrl = apiResponse.data.data.image;
      }
    } catch (e) {}
  }

  if (!audioUrl) {
    throw new Error('未找到音频地址');
  }

  // 清理标题，生成安全文件名
  const safeTitle = title.replace(/[<>:"/\\|？*]/g, '').substring(0, 100);
  const safePodcast = podcastName ? podcastName.replace(/[<>:"/\\|？*]/g, '').substring(0, 50) : '';

  return {
    episodeId,
    title: safeTitle,
    podcastName: safePodcast,
    audioUrl,
    coverUrl,
    episodeUrl,
    originalTitle: title,
    originalPodcastName: podcastName
  };
}

/**
 * 下载文件
 */
async function downloadFile(url, outputPath) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 120000,
    maxRedirects: 5
  });

  const writer = fs.createWriteStream(outputPath);
  
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

/**
 * 下载音频文件（带进度）
 */
async function downloadAudio(audioUrl, outputPath, progressCallback) {
  const response = await axios({
    method: 'GET',
    url: audioUrl,
    responseType: 'stream',
    timeout: 120000,
    maxRedirects: 5
  });

  const writer = fs.createWriteStream(outputPath);
  
  return new Promise((resolve, reject) => {
    let downloaded = 0;
    const total = parseInt(response.headers['content-length'] || 0);
    
    response.data.on('data', chunk => {
      downloaded += chunk.length;
      if (progressCallback && total > 0) {
        progressCallback(downloaded, total);
      }
    });
    
    response.data.pipe(writer);
    
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

/**
 * 生成安全的文件名
 */
function generateFilename(info, format = 'm4a') {
  const prefix = info.podcastName ? `[${info.podcastName}] ` : '';
  return `${prefix}${info.title}.${format}`;
}

/**
 * 嵌入封面到音频文件
 * 使用 ffprobe + ffmpeg 或 node-id3
 */
async function embedCover(audioPath, coverUrl, info) {
  console.log('  📷 正在下载封面...');
  
  const tempCover = path.join(path.dirname(audioPath), 'temp_cover.jpg');
  
  try {
    // 下载封面
    await downloadFile(coverUrl, tempCover);
    console.log('  ✓ 封面已下载');

    // 检查是否有 ffmpeg
    let hasFfmpeg = false;
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      hasFfmpeg = true;
    } catch (e) {
      hasFfmpeg = false;
    }

    if (hasFfmpeg) {
      // 使用 ffmpeg 嵌入封面（推荐，支持 M4A）
      console.log('  🎬 使用 ffmpeg 嵌入封面...');
      const tempOutput = audioPath + '.temp.m4a';
      
      // 使用 spawn 避免 shell 转义问题
      const { spawnSync } = require('child_process');
      
      const ffmpegArgs = [
        '-i', audioPath,
        '-i', tempCover,
        '-map', '0:a',
        '-map', '1:v',
        '-c:a', 'copy',
        '-c:v', 'png',
        '-disposition:v', 'attached_pic',
        '-metadata', `title=${info.originalTitle || info.title}`,
        '-metadata', `artist=${info.originalPodcastName || info.podcastName || 'Unknown'}`,
        '-metadata', `album=${info.originalPodcastName || info.podcastName || 'Unknown'}`,
        '-y',
        tempOutput
      ];

      const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'pipe' });
      if (result.status !== 0) {
        throw new Error(result.stderr?.toString() || 'ffmpeg failed');
      }
      
      // 替换原文件
      fs.renameSync(tempOutput, audioPath);
      console.log('  ✓ 封面已嵌入 (ffmpeg)');
    } else {
      // 使用 node-id3（仅支持 MP3）
      console.log('  ⚠️  未找到 ffmpeg，尝试使用 node-id3 (仅支持 MP3)...');
      
      if (audioPath.endsWith('.mp3')) {
        const id3 = require('node-id3');
        const coverBuffer = fs.readFileSync(tempCover);
        
        const tags = {
          title: info.originalTitle || info.title,
          artist: info.originalPodcastName || info.podcastName || 'Unknown',
          album: info.originalPodcastName || info.podcastName || 'Unknown',
          image: {
            mime: 'jpeg',
            type: 3, // 封面
            description: 'Cover',
            imageBuffer: coverBuffer
          }
        };
        
        id3.write(tags, audioPath);
        console.log('  ✓ 封面已嵌入 (node-id3)');
      } else {
        console.log('  ⚠️  文件格式不支持嵌入封面（需要 ffmpeg 支持 M4A）');
        console.log('  💡 安装 ffmpeg: brew install ffmpeg');
      }
    }

    // 清理临时封面
    if (fs.existsSync(tempCover)) {
      fs.unlinkSync(tempCover);
    }

    return true;

  } catch (error) {
    console.log(`  ⚠️  封面嵌入失败：${error.message}`);
    if (fs.existsSync(tempCover)) {
      fs.unlinkSync(tempCover);
    }
    return false;
  }
}

// 导出函数
module.exports = {
  extractEpisodeInfo,
  generateFilename,
  downloadAudio,
  downloadFile,
  embedCover
};

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  function showHelp() {
    console.log(`
🎵 xyz-dl - 单集下载

用法:
  xyz-dl <链接>              提取音频地址
  xyz-dl info <链接>         显示详细信息
  xyz-dl download <链接>     下载并嵌入封面

选项:
  -o, --output <目录>     下载目录
  -n, --name <文件名>     自定义文件名
  --no-cover              不嵌入封面
  -f, --force             覆盖文件
  -h, --help              显示帮助
`);
  }

  if (command === '-h' || command === '--help' || !command) {
    showHelp();
    if (!command) process.exit(0);
  }

  let episodeUrl = '';
  let action = 'extract';

  if (command === 'download' || command === 'info') {
    action = command;
    episodeUrl = args[1];
  } else {
    episodeUrl = command;
  }

  if (!episodeUrl || !episodeUrl.startsWith('http')) {
    console.error('❌ 请提供有效的播客链接');
    showHelp();
    process.exit(1);
  }

  const outputDir = args.includes('-o') || args.includes('--output') 
    ? args[args.indexOf('-o') + 1] || args[args.indexOf('--output') + 1]
    : '.';
  
  const customName = args.includes('-n') || args.includes('--name')
    ? args[args.indexOf('-n') + 1] || args[args.indexOf('--name') + 1]
    : null;

  const embedCoverFlag = !args.includes('--no-cover');

  try {
    const info = await extractEpisodeInfo(episodeUrl);

    if (action === 'info') {
      console.log('\n📻 播客信息:');
      console.log(`   标题：${info.originalTitle || info.title}`);
      console.log(`   播客：${info.originalPodcastName || info.podcastName || '未知'}`);
      console.log(`   ID: ${info.episodeId}`);
      console.log(`\n🎵 音频地址:`);
      console.log(`   ${info.audioUrl}`);
      console.log(`\n📷 封面地址:`);
      console.log(`   ${info.coverUrl || '未找到封面'}`);
      return;
    }

    console.log(`\n✅ 找到音频:`);
    console.log(`   标题：${info.originalTitle || info.title}`);
    console.log(`   播客：${info.originalPodcastName || info.podcastName || '未知'}`);
    console.log(`   地址：${info.audioUrl.substring(0, 60)}...`);
    if (info.coverUrl) {
      console.log(`   封面：${info.coverUrl.substring(0, 60)}...`);
    }

    if (action === 'download' || args.includes('-d') || args.includes('--download')) {
      const fs = require('fs');
      const path = require('path');
      const outputDirResolved = path.resolve(outputDir);
      
      if (!fs.existsSync(outputDirResolved)) {
        fs.mkdirSync(outputDirResolved, { recursive: true });
        console.log(`\n📁 创建目录：${outputDirResolved}`);
      }

      const filename = customName 
        ? (customName.endsWith('.m4a') ? customName : `${customName}.m4a`)
        : generateFilename(info);
      
      const outputPath = path.join(outputDirResolved, filename);

      if (fs.existsSync(outputPath)) {
        console.log(`\n⚠️  文件已存在：${filename}`);
        const overwrite = process.argv.includes('--force') || process.argv.includes('-f');
        if (!overwrite) {
          console.log('   使用 --force 覆盖文件');
          return;
        }
      }

      console.log(`\n📥 开始下载...`);
      console.log(`   文件：${filename}`);

      let lastProgress = 0;
      await downloadAudio(info.audioUrl, outputPath, (downloaded, total) => {
        const percent = Math.round((downloaded / total) * 100);
        if (percent >= lastProgress + 5 || percent === 100) {
          process.stdout.write(`\r   进度：${percent}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`);
          lastProgress = percent;
        }
      });

      console.log('\n\n✅ 音频下载完成!');
      console.log(`   路径：${outputPath}`);
      console.log(`   大小：${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

      if (embedCoverFlag && info.coverUrl) {
        console.log('\n🎨 处理封面...');
        await embedCover(outputPath, info.coverUrl, info);
      }

      console.log('\n✅ 全部完成!');
    } else {
      console.log('\n💡 下载命令:');
      console.log(`   xyz-dl download ${episodeUrl}`);
    }

  } catch (error) {
    console.error(`\n❌ 错误：${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
