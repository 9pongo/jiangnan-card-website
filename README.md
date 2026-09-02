# 江南寶卡官網原型

這是江南寶卡的公開網站前端與後端基礎，包含卡牌新品、預購訂金購物車、現貨商品、二手卡牌寄售流程規劃、店內活動公告與廣告版位。

`/admin/` 提供店長可檢視的後台展示，具備店內活動／第三方廣告的 Banner 分流、版位、排程、優先權與送審操作。正式版 API、PostgreSQL 和容器設定位於 `server/`；部署與安全要求見 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 本機預覽

在此資料夾啟動靜態網站伺服器後，開啟 `index.html` 即可預覽。當瀏覽器位於 `localhost` 或 `127.0.0.1` 時，`runtime-config.js` 會自動連到 Docker demo API；GitHub Pages 保持展示資料。正式部署由發布流程覆寫 API origin，首頁會讀取已發布商品、公告與活動，並以 API 建立訂單意向。

`product.html?id=...` 與 `post.html?slug=...` 是商品、公告與活動的公開詳細頁，皆只會顯示目前已發布且在有效期間內的資料。訂單意向會由伺服器重新計算應付訂金／金額並交易式扣減現貨庫存；這不等同付款完成。公開寄售預約會建立待收件案件，正式上線前仍須完成金流回呼驗證、會員身分、寄售表單人機驗證與完整個資告知。`/admin/` 在 localhost 使用 demo 角色驗收；GitHub Pages 的 `/admin/` 只作展示，不可接到正式 API。

## 發布至 GitHub Pages

此倉庫設定為從 `main` 分支的 `/` 根目錄部署 GitHub Pages。部署完成後，可將 Pages 網址提供給店主檢視與提出修改意見。
