# 秒茄 (mcigar.com) 网站克隆

本项目是对 [https://mcigar.com/](https://mcigar.com/) 的**完整离线克隆**，重点完成了**首页**和**海淘**两个页面，做到与原站「一摸一样」。其余页面（工具 / 补货 / 我）暂未实现（待定）。

## 已完成

- **首页 (`/index.html`)**
  - 顶部搜索框 + 论坛按钮
  - 秒茄热门品牌（高希霸 / 乌普曼 / 好友 / 蒙特 / 帕特加斯）
  - 三个分类标签页：**古巴品牌 / 非古巴品牌 / 斗草品牌**（可切换）
  - 全部品牌列表（438 个雪茄品牌 + 625 个斗草品牌），按首字母分组
  - 右侧 A–Z 字母索引（点击滚动定位）
  - 搜索过滤、底部导航、悬浮按钮、ICP 备案信息
- **海淘 (`/shop.html`)**
  - 顶部搜索框
  - 四个分类标签页：**欧行 / 水站 / 非古 / 斗草**（可切换）
  - 每个标签下的子分类筛选（德国LCDH / 瑞士 / 荷兰 …）
  - 132 个海淘站点卡片（含评分、运费、点评、站点图标）
  - 「未收录」站点（含复制 / 访问按钮）
  - 使用说明、底部导航、悬浮按钮

## 还原方式

页面结构与样式直接来自原站**渲染后的真实 DOM**，并复用原站编译后的 Tailwind CSS，因此视觉上与原站一致。所有图片（991 张品牌 / 斗草 / 站点图标）、字体（11 个 woff2）、数据（品牌、斗草、站点 JSON）均已下载到本地，**完全离线可用**。

## 运行

```bash
npm install      # 仅首次（用于抓取脚本依赖 playwright，运行站点不需要）
npm start        # 启动本地服务器
```

然后浏览器打开 [http://localhost:8099](http://localhost:8099)。

> 运行站点本身无需任何依赖，`server.js` 是零依赖的 Node 静态服务器。也可用任意静态服务器托管 `site/` 目录。

## 目录结构

```
site/                      # 网站本体（可直接部署）
  index.html               # 首页
  shop.html                # 海淘
  favicon.ico
  assets/
    app.css                # 原站编译后的 Tailwind 样式
    fonts/                 # Geist 字体
    data/                  # brands.json / pipe-brands.json / sites.json
  images/brands/<slug>/    # 雪茄品牌 logo
  images/pipe_brands/<id>/ # 斗草品牌 logo
  icons/                   # 海淘站点图标
server.js                  # 零依赖静态服务器
scrape/                    # 抓取 / 还原脚本（用于重新生成）
```

## 重新抓取 / 更新数据

```bash
node scrape/capture.js         # 重新抓取各页面渲染结果与接口数据
node scrape/download-assets.js # 下载图片 / 字体 / CSS / 数据
node scrape/fix-fonts.js       # 处理 CSS 中字体路径
node scrape/bake.js            # 生成 site/index.html 与 site/shop.html
node scrape/verify.js          # 截图对比本地与原站
```

## 数据来源接口（原站）

- `GET /brands.json` — 雪茄品牌
- `GET /pipe-brands.json` — 斗草品牌
- `GET /api/sites` — 海淘站点（原站有 Referer 校验，已由浏览器抓取保存到 `site/assets/data/sites.json`）
