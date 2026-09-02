# Ayu 聊天测试页

独立网页测试版，给别人发链接就能聊。完整聊天记录存在对方浏览器本地，模型请求只带滚动摘要和最近 20 条消息。

## 本地运行

```bash
cd /Users/jun/felha-ai-chat-web
cp .env.example .env.local
# 把 OPENROUTER_API_KEY 改成真实 Key
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 部署到 Vercel（公开测试链接）

不需要你们自己的服务器。

1. 把这个目录推到 GitHub 仓库。
2. 打开 [https://vercel.com/new](https://vercel.com/new)，导入该仓库。
3. 在 Environment Variables 增加：
   - Name: `OPENROUTER_API_KEY`
   - Value: 现有 OpenRouter Key
4. Deploy 完成后把生成的网址发给测试的人。

Key 只放在 Vercel 环境变量里，不会进网页源码。额度上限由 OpenRouter 账号自己控制。

## 功能

- 内置 Ayu 人设，已整理成可编辑的 LangGPT 模板
- 可改人设、恢复默认人设
- 收费模型：MiniMax M3、DeepSeek V4 Flash、DeepSeek V4 Pro、Gemini 3.7 Flash、Qwen3.8 Flash
- 历史只存在当前浏览器；清理网站数据后不可恢复
- 发给模型的是：人设 + 滚动摘要 + 最近 20 条
