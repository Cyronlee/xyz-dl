#!/usr/bin/env node

/**
 * xiaoyuzhou-dl - 小宇宙播客下载器
 * 
 * 命令行入口文件
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const commands = {
  'extract': 'extractor.js',
  'info': 'extractor.js',
  'download': 'extractor.js',
  'parse': 'batch.js',
  'batch': 'batch.js',
  'list': 'batch.js'
};

function showHelp() {
  console.log(`
🎵 xiaoyuzhou-dl - 小宇宙播客下载器

用法:
  npx xiaoyuzhou-dl <command> [options]
  或全局安装后：xiaoyuzhou-dl <command> [options]

命令:
  extract <链接>           提取音频地址和封面
  info <链接>              显示播客详细信息
  download <链接>          下载音频并嵌入封面
  parse <播客主页>         解析播客列表页
  batch <链接文件>         批量处理链接列表

全局选项:
  -h, --help              显示帮助

示例:
  npx xiaoyuzhou-dl extract https://www.xiaoyuzhoufm.com/episode/xxx
  npx xiaoyuzhou-dl download https://... -o ./podcasts
  npx xiaoyuzhou-dl parse https://www.xiaoyuzhoufm.com/podcast/xxx
  npx xiaoyuzhou-dl batch episodes.txt -a download

选项:
  -o, --output <目录>     下载目录
  -n, --name <文件名>     自定义文件名
  --no-cover              不嵌入封面
  -l, --limit <数量>      限制处理数量 (parse 命令)
  -d, --delay <毫秒>      请求间隔 (parse 命令)
  -f, --force             覆盖已存在的文件

---
💡 提示：需要安装 ffmpeg 以支持封面嵌入
   macOS: brew install ffmpeg
   Linux: sudo apt install ffmpeg
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') {
    showHelp();
    process.exit(command ? 0 : 1);
  }

  const scriptFile = commands[command];
  if (!scriptFile) {
    console.error(`❌ 未知命令：${command}`);
    console.log('使用 xiaoyuzhou-dl --help 查看可用命令');
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, '..', 'lib', scriptFile);
  
  // 为 batch/parse 命令添加特殊处理
  if (['parse', 'batch', 'list'].includes(command)) {
    // 添加命令标识到参数中
    const newArgs = ['--cmd', command, ...args.slice(1)];
    const child = spawn('node', [scriptPath, ...newArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('error', (err) => {
      console.error(`❌ 执行失败：${err.message}`);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    return;
  }

  const child = spawn('node', [scriptPath, ...args.slice(1)], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (err) => {
    console.error(`❌ 执行失败：${err.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
