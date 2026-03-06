# 发布指南

## GitHub 已发布

仓库已创建并推送：
https://github.com/Cyronlee/xyz-dl

## 发布到 npm

### 1. 登录 npm

```bash
npm login
```

输入你的 npm 用户名、密码和邮箱。

### 2. 发布

```bash
cd /Users/siyuan.li/.openclaw/workspace/xyz-dl
npm publish
```

### 3. 验证

访问 https://www.npmjs.com/package/xyz-dl 查看包页面。

### 4. 测试

```bash
# 等待几分钟后测试
npx xyz-dl --help
npx xyz-dl info https://www.xiaoyuzhoufm.com/episode/69a7ae58de29766da9595b6d
```

## 后续更新

修改版本号后发布：

```bash
# 修改 package.json 中的 version
npm version patch  # 1.0.0 -> 1.0.1
# 或
npm version minor  # 1.0.0 -> 1.1.0

npm publish
git push --follow-tags
```
