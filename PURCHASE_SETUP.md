# 宇宙之镜购买功能配置

当前仓库已具备静态购买页和购买按钮结构：

- `/docs/purchase.html`
- `/docs/purchase-success.html`
- `/docs/js/purchase-config.js`

## 推荐支付方式

静态 GitHub Pages 站点不应保存支付密钥，也不应在前端创建 Checkout Session。最简单安全的方式是使用 Stripe Payment Links，或使用支付宝/微信/小报童/知识星球等平台生成的公开购买链接。

## Stripe Payment Links 配置步骤

### 推荐：脚本自动创建并写回

1. 在本地终端设置 Stripe Secret Key，不要把密钥写入仓库：

```bash
export STRIPE_SECRET_KEY="sk_live_..."
```

2. 运行脚本为 3 个方案创建 Stripe Payment Links，并自动把公开链接写入 `docs/js/purchase-config.js`：

```bash
python3 scripts/create_stripe_payment_links.py
```

3. 发布前运行严格审计：

```bash
python3 scripts/audit_product_readiness.py --strict-payments
```

脚本会读取当前配置里的价格、币种和成功跳转地址，只把 Stripe 返回的公开 `https://buy.stripe.com/...` 链接写入前端配置，不会写入或打印 Stripe Secret Key。

脚本调用的是 Stripe 官方 Payment Links API：
<https://docs.stripe.com/api/payment-link/create>

如果只想先检查将要创建的请求，可以运行：

```bash
python3 scripts/create_stripe_payment_links.py --dry-run
```

如果只想创建单个方案：

```bash
python3 scripts/create_stripe_payment_links.py --plan personal
```

### 手动：Dashboard 创建后写入

1. 在 Stripe Dashboard 创建 3 个商品或价格：
   - 个人永久版：`CNY 99`
   - 支持者版：`CNY 199`
   - 机构授权：`CNY 999`
2. 为每个价格创建 Payment Link。
3. 将成功跳转地址设置为：
   - `https://mokangmedical.github.io/cosmic-lens/purchase-success.html`
4. 打开 `docs/js/purchase-config.js`，把每个方案的 `paymentLink` 填成对应的公开购买链接。
5. 或者用脚本安全写入链接：

```bash
python3 scripts/configure_purchase_links.py \
  --personal "https://buy.stripe.com/个人永久版链接" \
  --supporter "https://buy.stripe.com/支持者版链接" \
  --institution "https://buy.stripe.com/机构授权链接"
```

6. 发布前运行产品审计：

```bash
python3 scripts/audit_product_readiness.py --strict-payments
```

7. 提交并推送：

```bash
git add docs/js/purchase-config.js
git commit -m "chore: configure purchase links"
git push origin main
```

## 审计命令

结构审计允许付款链接为空，但会给出警告：

```bash
python3 scripts/audit_product_readiness.py
```

真正上线收款前必须使用严格模式，确保 3 个购买方案都已经配置公开收款链接：

```bash
python3 scripts/audit_product_readiness.py --strict-payments
```

## 安全边界

- 不要把 Stripe Secret Key、Webhook Secret 或任何服务端密钥放入 `docs/`。
- `scripts/create_stripe_payment_links.py` 只能在本地使用 `STRIPE_SECRET_KEY` 调用 Stripe API，仓库只保存公开 Payment Link URL。
- Payment Links 是公开 URL，可以放在前端。
- 如果后续要做登录、自动开通、会员权限和订单查询，需要迁移到带后端的方案，例如 Stripe Checkout Sessions + serverless function + 数据库。
