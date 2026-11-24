# MiniMax 生图测试页

给测试人员的 H5：填描述、调宽高/像素/质量，生成后可下载。走 MiniMax 官方接口，Key 只放服务端。

公开地址：https://felha-ai-chat-web.vercel.app

## 本地运行

```bash
cp .env.example .env.local
# 把 MINIMAX_API_KEY 改成真实 Key
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 部署到 Vercel

1. 推到 GitHub 后 Vercel 会自动发布。
2. 在 Project Settings → Environment Variables 增加：
   - `MINIMAX_API_KEY`：MiniMax 官方 Key
   - `MINIMAX_API_HOST`：`https://api.minimax.cn`（可选，代码里已有默认值）
3. 不要把 GroupId 配进去（和这把 Key 对不上）。
4. Key 不要写进仓库。生成会扣费，测试时不要连点，默认用 1K。
