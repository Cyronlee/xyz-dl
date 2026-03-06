# 🎵 xyz-dl

下载小宇宙播客音频，自动嵌入专辑封面和元数据。

## ✨ 特性

- 🎧 **一键下载** - 无需登录，直接下载音频
- 🖼️ **自动封面** - 提取专辑封面并嵌入到音频文件
- 📝 **元数据** - 自动写入标题、播客名、专辑信息
- 📦 **批量处理** - 支持解析播客主页，批量下载全部集数
- 🚀 **npx 运行** - 无需安装，开箱即用

## 🚀 快速开始

### 使用 npx（推荐，无需安装）

```bash
# 下载单集（自动嵌入封面）
npx xyz-dl download https://www.xiaoyuzhoufm.com/episode/xxx

# 查看播客信息
npx xyz-dl info https://www.xiaoyuzhoufm.com/episode/xxx

# 解析播客主页并下载全部
npx xyz-dl parse https://www.xiaoyuzhoufm.com/podcast/xxx -a download
```

### 全局安装

```bash
npm install -g xyz-dl

# 之后可直接使用
xyz-dl download https://...
```

### 作为库使用

```javascript
const xyz = require('xyz-dl');

async function main() {
  const result = await xyz.download(
    'https://www.xiaoyuzhoufm.com/episode/xxx',
    { outputDir: './podcasts' }
  );
  console.log('下载完成:', result.file);
}
```

## 📖 命令详解

### download - 下载单集

```bash
npx xyz-dl download <链接> [选项]

选项:
  -o, --output <目录>     下载目录 (默认：当前目录)
  -n, --name <文件名>     自定义文件名
  --no-cover              不嵌入封面
  -f, --force             覆盖已存在的文件

示例:
  npx xyz-dl download https://... -o ./podcasts
  npx xyz-dl download https://... -n my-episode
```

### info - 查看信息

```bash
npx xyz-dl info <链接>

输出:
  📻 播客信息:
     标题：EP7 给人文工作者的 AI 使用指南
     播客：诗梳风
  🎵 音频地址: ...
  📷 封面地址: ...
```

### parse - 解析播客主页

```bash
npx xyz-dl parse <播客主页> [选项]

选项:
  -a, --action <动作>     list(默认) | extract | download
  -o, --output <目录>     下载目录
  -l, --limit <数量>      限制处理数量 (0=全部)
  -d, --delay <毫秒>      请求间隔 (默认：1000)
  --no-cover              不嵌入封面
  --force                 覆盖已有文件

示例:
  # 列出所有集数
  npx xyz-dl parse https://www.xiaoyuzhoufm.com/podcast/xxx

  # 下载全部
  npx xyz-dl parse https://... -a download -o ./podcasts

  # 下载最新 10 集
  npx xyz-dl parse https://... -a download -l 10

注意：小宇宙页面为动态加载，部分播客可能无法直接解析。
      推荐使用 batch 命令 + 链接列表文件方式。
```

### batch - 批量处理链接列表（推荐）

```bash
npx xyz-dl batch <链接文件> [选项]

链接文件格式 (episodes.txt):
  # 这是注释
  https://www.xiaoyuzhoufm.com/episode/xxx
  https://www.xiaoyuzhoufm.com/episode/yyy

示例:
  # 从文件下载全部
  npx xyz-dl batch episodes.txt -a download

  # 下载前 10 个链接
  npx xyz-dl batch episodes.txt -a download -l 10
```

### 💡 如何获取播客全部链接

1. **手动收集**：在小宇宙 APP 或网页中复制每集链接
2. **使用 RSS**：如果播客提供 RSS feed，可从中提取 episode 链接
3. **分享列表**：从小宇宙分享功能获取多集链接

## 📋 输出示例

```bash
$ npx xyz-dl download https://www.xiaoyuzhoufm.com/episode/69a7ae58de29766da9595b6d

✅ 找到音频:
   标题：EP7 给人文工作者的 AI 使用指南 · Thoughts
   播客：诗梳风
   地址：https://media.xyzcdn.net/...
   封面：https://image.xyzcdn.net/...

📥 开始下载...
   文件：[诗梳风] EP7 给人文工作者的 AI 使用指南 · Thoughts.m4a
   进度：100% (49.9MB / 49.9MB)

✅ 音频下载完成!

🎨 处理封面...
  📷 正在下载封面...
  ✓ 封面已下载
  🎬 使用 ffmpeg 嵌入封面...
  ✓ 封面已嵌入 (ffmpeg)

✅ 全部完成!
```

## 🔧 依赖

### 必需

- Node.js >= 14.0.0

### 可选（推荐）

- **ffmpeg** - 用于嵌入封面到 M4A 文件

```bash
# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

没有 ffmpeg 时，封面嵌入功能将不可用（但音频下载仍正常工作）。

## 📁 文件名格式

默认格式：`[播客名] 标题.m4a`

示例：
- `[诗梳风] EP7 给人文工作者的 AI 使用指南 · Thoughts.m4a`
- `[文化有限] EP100 我们为什么需要阅读.m4a`

## ⚠️ 注意事项

1. **版权** - 仅供个人学习使用，请尊重播客创作者版权
2. **时效性** - 音频 URL 可能有过期时间，建议及时下载
3. **速率限制** - 批量下载时添加延迟，避免请求过快
4. **网站更新** - 小宇宙可能更新网站结构，如失效请提 issue

## 🛠️ 开发

```bash
git clone https://github.com/USER/xyz-dl.git
cd xyz-dl
npm install

# 本地测试
node bin/cli.js download <链接>

# 链接到全局
npm link
```

## 📄 License

MIT

## 🙏 致谢

感谢小宇宙平台提供优质的播客内容。

---

**享受播客！** 🎧
