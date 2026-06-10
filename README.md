# 商城全站管理后台（独立部署）

从主商城前端剥离的全站管理后台，建议部署到独立子域，例如 `console.your-domain.com`。

## 开发

```bash
cd admin-console
npm install
npm run dev
```

默认访问 `http://localhost:5173/login`，API 开发环境指向 `http://localhost:3001`。

## 生产构建

```bash
npm run build
```

产物在 `dist/`，上传至静态服务器或 CDN 即可。

## 环境变量

复制 `.env.example` 为 `.env.production`：

```bash
VITE_API_URL=https://api.your-domain.com
```

## 路由说明

| 路径 | 说明 |
|------|------|
| `/login` | 管理员登录 |
| `/dashboard` | 仪表盘 |
| `/users` | 商城用户 |
| `/shops` | 店铺管理 |
| `/orders` | 订单管理 |
| `/warehouse` | 商品仓 |
| `/audit/*` | 审核相关 |
| `/system` | 系统管理 |

## Nginx 示例

```nginx
server {
  listen 443 ssl;
  server_name console.your-domain.com;

  root /var/www/admin-console/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 安全建议

- 配置 `robots.txt` 与页面 `noindex`（已内置）
- 使用 Cloudflare Access 或 IP 白名单限制访问
- 主商城域名不要链接到此后台地址
