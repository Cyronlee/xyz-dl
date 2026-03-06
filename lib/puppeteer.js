const puppeteer = require('puppeteer');

/**
 * 使用 Puppeteer 提取小宇宙音频地址
 * 适用于动态加载内容的页面
 */

async function extractAudioWithPuppeteer(episodeUrl) {
  console.log('🚀 启动浏览器...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 监听网络请求，捕获音频资源
    let audioUrl = null;
    
    page.on('request', request => {
      const url = request.url();
      // 捕获媒体资源请求
      if (url.includes('media.xyzcdn.net') || 
          url.match(/\.(m4a|mp3|aac|wav)(\?.*)?$/i)) {
        audioUrl = url;
        console.log('📡 捕获到音频请求:', url);
      }
    });

    console.log(`📖 正在加载页面：${episodeUrl}`);
    await page.goto(episodeUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // 等待音频播放器加载
    await page.waitForSelector('audio', { timeout: 5000 }).catch(() => {
      console.log('⚠️ 未找到 audio 元素，继续尝试其他方法...');
    });

    // 如果通过网络请求没找到，尝试从页面提取
    if (!audioUrl) {
      audioUrl = await page.evaluate(() => {
        // 方法 1: 查找 audio 标签
        const audio = document.querySelector('audio');
        if (audio) {
          return audio.src || audio.querySelector('source')?.src;
        }

        // 方法 2: 在 window 对象中查找
        if (window.__NEXT_DATA__) {
          try {
            const data = JSON.parse(window.__NEXT_DATA__.textContent || window.__NEXT_DATA__);
            const audioUrl = data.props?.pageProps?.episode?.audio;
            if (audioUrl) return audioUrl;
          } catch (e) {}
        }

        // 方法 3: 查找包含音频 URL 的全局变量
        for (const key in window) {
          try {
            const obj = window[key];
            if (obj && typeof obj === 'object' && obj.audio) {
              if (obj.audio.includes('media.xyzcdn.net')) {
                return obj.audio;
              }
            }
          } catch (e) {}
        }

        return null;
      });
    }

    if (audioUrl) {
      console.log('✅ 找到音频地址');
      return audioUrl;
    }

    throw new Error('未找到音频地址');

  } finally {
    await browser.close();
    console.log('🔒 浏览器已关闭');
  }
}

// 主函数
async function main() {
  const episodeUrl = process.argv[2] || 'https://www.xiaoyuzhoufm.com/episode/69a7ae58de29766da9595b6d';
  
  console.log('🎵 小宇宙音频提取器 (Puppeteer 版)\n');
  console.log(`目标链接：${episodeUrl}\n`);

  try {
    const audioUrl = await extractAudioWithPuppeteer(episodeUrl);
    console.log(`\n✅ 音频地址：${audioUrl}`);
    console.log('\n💡 下载命令:');
    console.log(`   curl -L -o episode.m4a "${audioUrl}"`);
    console.log(`   或 wget -O episode.m4a "${audioUrl}"`);
  } catch (error) {
    console.error(`\n❌ 错误：${error.message}`);
    process.exit(1);
  }
}

main();
