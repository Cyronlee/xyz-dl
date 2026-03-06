#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const { extractEpisodeInfo, downloadAudio, downloadFile, generateFilename, embedCover } = require('./extractor.js');
const fs = require('fs');
const path = require('path');

/**
 * 解析小宇宙播客列表页
 */
async function parsePodcastPage(podcastUrl) {
  console.log(`📖 解析播客主页：${podcastUrl}`);

  const response = await axios.get(podcastUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }
  });

  const $ = cheerio.load(response.data);
  const episodes = [];
  const podcastName = $('h1').first().text().trim() || '未知播客';
  const podcastCover = $('meta[property="og:image"]').attr('content');

  $('a[href*="/episode/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    const title = $(elem).text().trim();
    
    if (href && title) {
      const episodeId = href.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
      if (episodeId && !episodes.find(e => e.id === episodeId)) {
        episodes.push({
          id: episodeId,
          url: href.startsWith('http') ? href : `https://www.xiaoyuzhoufm.com${href}`,
          title
        });
      }
    }
  });

  console.log(`✓ 找到 ${episodes.length} 集节目`);

  return { podcastName, podcastCover, podcastUrl, episodes };
}

/**
 * 从链接列表文件解析
 */
function parseLinkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在：${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const episodes = [];

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const episodeId = trimmed.match(/episode\/([a-zA-Z0-9]+)/)?.[1];
      if (episodeId) {
        episodes.push({
          id: episodeId,
          url: trimmed.startsWith('http') ? trimmed : `https://www.xiaoyuzhoufm.com/episode/${episodeId}`,
          title: null
        });
      }
    }
  });

  console.log(`✓ 从文件读取 ${episodes.length} 个链接`);
  return { episodes };
}

/**
 * 批量处理播客
 */
async function batchProcess(episodes, options = {}) {
  const { outputDir = './downloads', action = 'list', limit = 0, delay = 1000, force = false, embedCover = true } = options;
  const results = { success: [], failed: [], skipped: [] };

  if (action === 'download' && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\n📁 创建目录：${outputDir}`);
  }

  const total = limit > 0 ? Math.min(episodes.length, limit) : episodes.length;
  console.log(`\n📋 处理 ${total}/${episodes.length} 集节目\n`);

  for (let i = 0; i < total; i++) {
    const episode = episodes[i];
    console.log(`[${i + 1}/${total}] ${episode.title || episode.id}`);
    console.log(`    ${episode.url}`);

    try {
      if (action === 'list') {
        console.log(`    ✓ 待处理\n`);
        results.success.push(episode);
        continue;
      }

      const info = await extractEpisodeInfo(episode.url);
      
      if (action === 'extract') {
        console.log(`    ✓ 音频：${info.audioUrl.substring(0, 60)}...`);
        if (info.coverUrl) console.log(`    ✓ 封面：${info.coverUrl.substring(0, 60)}...`);
        results.success.push(info);
      } else if (action === 'download') {
        const filename = generateFilename(info);
        const outputPath = path.join(outputDir, filename);

        if (fs.existsSync(outputPath) && !force) {
          console.log(`    ⏭️  已存在，跳过\n`);
          results.skipped.push({ ...info, file: filename });
          continue;
        }

        console.log(`    📥 下载：${filename}`);
        let lastProgress = 0;
        await downloadAudio(info.audioUrl, outputPath, (downloaded, totalSize) => {
          const percent = Math.round((downloaded / totalSize) * 100);
          if (percent >= lastProgress + 10 || percent === 100) {
            process.stdout.write(`\r       进度：${percent}%`);
            lastProgress = percent;
          }
        });
        console.log('\n    ✅ 音频完成');

        if (embedCover && info.coverUrl) {
          try {
            await embedCover(outputPath, info.coverUrl, info);
            console.log('    ✅ 封面已嵌入');
          } catch (e) {
            console.log(`    ⚠️  封面失败：${e.message}`);
          }
        }
        results.success.push({ ...info, file: filename });
      }
    } catch (error) {
      console.log(`    ❌ 失败：${error.message}`);
      results.failed.push({ ...episode, error: error.message });
    }

    if (i < total - 1 && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.log('');
  }

  return results;
}

/**
 * 打印统计
 */
function printStats(results) {
  console.log('\n📊 处理统计:');
  console.log(`  成功：${results.success.length}`);
  console.log(`  失败：${results.failed.length}`);
  console.log(`  跳过：${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log('\n  失败的条目:');
    results.failed.forEach(item => console.log(`    - ${item.title || item.id}: ${item.error}`));
  }

  const resultFile = `result-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 结果已保存：${resultFile}`);
}

// 导出函数
module.exports = { parsePodcastPage, parseLinkFile, batchProcess, printStats };

// CLI 处理
async function main() {
  const args = process.argv.slice(2);
  const cmdIndex = args.indexOf('--cmd');
  const command = cmdIndex >= 0 ? args[cmdIndex + 1] : 'parse';
  const cleanArgs = cmdIndex >= 0 ? [...args.slice(0, cmdIndex), ...args.slice(cmdIndex + 2)] : args;

  if (cleanArgs.includes('-h') || cleanArgs.includes('--help')) {
    console.log(`
🎵 xyz-dl - 批量解析器

用法:
  npx xyz-dl parse <播客主页> [选项]
  npx xyz-dl batch <链接文件> [选项]

选项:
  -a, --action <动作>     list | extract | download
  -o, --output <目录>     下载目录
  -l, --limit <数量>      限制数量
  -d, --delay <毫秒>      请求间隔
  --force                 覆盖文件
  --no-cover              不嵌入封面
`);
    process.exit(0);
  }

  let source = cleanArgs[0];
  let fromFile = command === 'batch';

  if (cleanArgs[0] === '-f' || cleanArgs[0] === '--file') {
    fromFile = true;
    source = cleanArgs[1];
  }

  if (!source) {
    console.log('用法：npx xyz-dl parse <播客主页>');
    process.exit(0);
  }

  const action = cleanArgs.includes('-a') ? cleanArgs[cleanArgs.indexOf('-a') + 1] : 
                 cleanArgs.includes('--action') ? cleanArgs[cleanArgs.indexOf('--action') + 1] : 'list';
  const outputDir = cleanArgs.includes('-o') ? cleanArgs[cleanArgs.indexOf('-o') + 1] : 
                    cleanArgs.includes('--output') ? cleanArgs[cleanArgs.indexOf('--output') + 1] : './downloads';
  const limit = parseInt(cleanArgs.includes('-l') ? cleanArgs[cleanArgs.indexOf('-l') + 1] : 
                         cleanArgs.includes('--limit') ? cleanArgs[cleanArgs.indexOf('--limit') + 1] : '0');
  const delay = parseInt(cleanArgs.includes('-d') ? cleanArgs[cleanArgs.indexOf('-d') + 1] : 
                         cleanArgs.includes('--delay') ? cleanArgs[cleanArgs.indexOf('--delay') + 1] : '1000');
  const force = cleanArgs.includes('--force');
  const embedCoverFlag = !cleanArgs.includes('--no-cover');

  console.log('🎵 xyz-dl - 批量解析器\n');

  const data = fromFile ? parseLinkFile(source) : await parsePodcastPage(source);
  const results = await batchProcess(data.episodes, { action, outputDir, limit, delay, force, embedCover: embedCoverFlag });
  printStats(results);
}

if (require.main === module) {
  main();
}
