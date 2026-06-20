# 部署指南（免费全栈）

本项目 = 静态前台（首页 / 海淘 / 产品库 / 品牌目录）+ Node 服务器（`/api/*` 接口、SQLite 数据库、后台管理 `/admin/`）。
要保留「后台管理 + 数据库」，需要一个能跑 Node 的托管平台（GitHub Pages 不行，它只能放静态文件）。

启动时服务器会自动：建表 → 首次运行填充示例产品 → 创建管理员账号（默认 `admin` / `admin123`，可用环境变量改）。

---

## 一、先把代码推到 GitHub

```bash
git init
git add .
git commit -m "雪茄老友会 网站"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

---

## 方案 A：Render（最简单，免费，推荐先试）

1. 打开 https://render.com → 用 GitHub 登录。
2. New → Web Service → 选中你的仓库。
3. 配置（仓库里已带 `render.yaml`，多数会自动识别）：
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
4. Environment 里设置管理员账号（可选但建议）：
   - `ADMIN_USER` = 你的用户名
   - `ADMIN_PASS` = 你的强密码
5. Create Web Service，等几分钟即可得到网址 `https://xxx.onrender.com`。

注意（免费版）：
- 15 分钟无访问会休眠，下次访问需等几秒唤醒。
- **磁盘是临时的**：每次重新部署/休眠重启后，数据库会重置回示例数据，后台新增的内容会丢失。
  适合演示。要持久保存数据 → 用下面的方案 B。

---

## 方案 B：Fly.io（免费额度内，数据持久，推荐长期用）

需要安装 flyctl 并绑定一张卡（免费额度内不扣费）。仓库里已带 `Dockerfile` 和 `fly.toml`。

```bash
# 安装 flyctl: https://fly.io/docs/flyctl/install/
fly auth signup           # 或 fly auth login
fly launch --no-deploy    # 识别 fly.toml，确认 app 名称/区域
fly volumes create cigar_data --size 1 --region sin   # 1GB 持久磁盘，存数据库
fly secrets set ADMIN_USER=你的用户名 ADMIN_PASS=你的强密码
fly deploy
```

数据库存放在挂载的持久卷 `/data/cigars.db`，重新部署也不会丢。

---

## 部署后

- 前台首页：`/`
- 后台管理：`/admin/`（用你设置的 `ADMIN_USER` / `ADMIN_PASS` 登录）
- ⚠️ 上线后务必把默认密码 `admin123` 改掉（通过环境变量设置）。

## 仅想免费做「纯展示」（无后台）？
用 GitHub Pages 即可，但需要把产品库改成读取静态 JSON，并把代码里的绝对路径改成相对路径。需要的话告诉我，我来改造。
