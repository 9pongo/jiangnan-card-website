# 江南寶卡本機 QA 檢核矩陣

## 1. 範圍與前提

本文件驗收目前本機可用的官網、管理後台、PostgreSQL API 與本機 Banner 物件儲存。**帳號建立／公司 SSO 實際串接、付款金流回呼、退款、出貨與寄售售出結算不在本輪驗收範圍。**

本機以 Docker 的 `AUTH_MODE=demo` 驗證角色流程；正式環境必須改為 `AUTH_MODE=oidc`。測試期間產生的商品、訂單、公告、寄售案件與 Banner 都是測試資料，不得作為正式營運資料。

## 2. 啟動與入口

```powershell
cd outputs
docker compose up --build
python -m http.server 4173
```

| 目標 | 網址 | 預期結果 |
| --- | --- | --- |
| 公開首頁 | `http://localhost:4173/` | 顯示江南寶卡首頁、商品、活動、公告、購物車與廣告版位。 |
| Banner 後台 | `http://localhost:4173/admin/` | 連線訊息顯示「已連線本機 API」，不是展示模式。 |
| 商品後台 | `http://localhost:4173/admin/products.html` | 可讀取資料、建立商品、送審與審核操作。 |
| 活動公告後台 | `http://localhost:4173/admin/content.html` | 可建立與編輯活動、公告、優惠。 |
| 寄售後台 | `http://localhost:4173/admin/consignment.html` | 可建立案件，按規則推進狀態。 |
| 訂單後台 | `http://localhost:4173/admin/orders.html` | 只讀顯示訂單意圖與保留到期時間。 |
| 成員與稽核 | `http://localhost:4173/admin/members.html` | 顯示遮罩電子信箱、角色與不可變更的稽核紀錄。 |

## 3. 視覺檢核

桌面以 1440 x 900、手機以 390 x 844 驗收。各頁不得有橫向溢位、重疊文字、截斷按鈕或未載入的必要圖片。

| 頁面／元件 | 預期視覺與互動 |
| --- | --- |
| 首頁桌面 | 深藍導覽、店名「江南寶卡」與江南街 105 號在第一屏可辨識；主視覺後方可見首頁橫幅廣告版位。 |
| 首頁手機 | 漢堡選單可開關；購物車數量徽章與側欄廣告不壓住商品按鈕；側欄廣告移至商品區之後。 |
| 商品卡 | 預購商品顯示售價、訂金和到貨日；現貨顯示庫存；設定 `originalPriceCents` 時原價劃線、活動價清楚顯示。 |
| 購物車 | 加入商品後開啟右側面板，金額等於所有訂金／現貨售價合計；移除後徽章、項目和總額同步變更。 |
| Banner | 第三方素材有「廣告」標示；店內活動素材顯示「店內活動」；Banner 不可破版且連結不覆蓋其他控制項。 |
| 後台 | 左側導覽在桌面固定、手機變成可水平捲動導覽；表格可水平捲動但欄名與操作按鈕可辨識。 |
| 商品價格審核 | 已發布商品旁顯示「調價待審」和待審價格；歷程對話框列出提出人、審核人、時間與駁回原因。 |
| 公告管理 | 新增與編輯使用同一對話框；編輯時標題、slug、摘要、內文、日期與狀態均回填。 |

## 4. 功能與資料一致性檢核

| 編號 | 操作 | 預期結果與必查證據 |
| --- | --- | --- |
| P-01 | 新增現貨商品並選「上架」 | API 回 `pending_review`；公開首頁尚未顯示；`audit_log` 有 `product.created`。 |
| P-02 | 由不同角色核准 P-01 | 商品變為 `published` 並顯示於首頁；`product.approved` 稽核存在。建立人自行核准必須回 403。 |
| P-03 | 修改已發布商品的售價與原價 | 公開售價在核准前不變；後台有待審變更；核准後才切換活動價。原價低於售價必須回 400。 |
| P-04 | 建立預購商品 | 必填訂金與到貨日；結帳應付金額使用訂金，不是全額。 |
| O-01 | 將一個現貨商品加入購物車並建立訂單 | API 以 UUID 冪等鍵建立 `pending_payment`；現貨庫存扣減，重送相同 key 不重複扣庫存。 |
| O-02 | 讓訂單超過保留時間並呼叫內部到期端點 | 訂單變 `expired`，保留庫存只釋回一次，產生 `order.expired` 稽核。 |
| C-01 | 建立公告或活動 | `slug` 僅小寫字母、數字與連字號；有效結束時間必須晚於開始時間；公開頁僅顯示已發布且在期間內資料。 |
| C-02 | 編輯已建立內容 | 表格立刻顯示新標題；`content_posts` 與 `content.updated` 稽核同時存在。 |
| B-01 | 上傳 PNG、JPG 或 WebP Banner | 先取得上傳意圖，再 PUT 素材，再完成驗證；本機 `local` provider 下圖片公開 URL 可讀取。GIF 或超過 5 MB 必須被拒絕。 |
| B-02 | 建立、送審、核准 Banner | 未驗證素材不得建立；草稿 -> 待審 -> 發布／排程；店內活動優先權至少 900 時必須優先於同版位第三方廣告。 |
| B-03 | 點擊第三方 Banner | 外連使用新分頁與 `noopener sponsored`；事件端點以 UUID event key 去重。 |
| G-01 | 建立寄售案件 | 產生 `JC-YYYYMMDD-XXXXXX` 案件編號、品項數正確、`consignment.created` 稽核存在。 |
| G-02 | 推進寄售狀態 | 僅允許 `submitted -> received -> listed -> returned`，或 `submitted -> cancelled`；錯誤轉換回 409，狀態不變。 |
| A-01 | 讀取成員與稽核頁 | 電子信箱遮罩；稽核只讀。直接對 `audit_log` 做 UPDATE 或 DELETE 必須被資料庫拒絕。 |

## 5. API 安全回歸檢核

| 編號 | 檢查 | 預期結果 |
| --- | --- | --- |
| S-01 | 拿掉 `x-demo-role` 或改成無權限角色呼叫管理 API | demo 預設帳號只限本機；正式模式一律以 OIDC JWT 與資料庫角色決定權限。 |
| S-02 | `AUTH_MODE=oidc` 但未設定 issuer/audience | 回 503，不得降級成 demo 權限。 |
| S-03 | 使用未知 OIDC subject | 回 403，不能自動建立應用程式帳號。 |
| S-04 | 對商品、內容、寄售的 id 使用非 UUID | 回 400，資料庫不應新增或更新。 |
| S-05 | 嘗試在公開訂單請求修改價格或訂金 | 伺服器一律由資料庫商品資料重算；前端傳入值不影響應付金額。 |
| S-06 | 訂單到期端點未附／附錯 token | 回 401 且不改動訂單或庫存。 |
| S-07 | 以 `NODE_ENV=production` 啟動且設定 `ASSET_STORAGE_PROVIDER=local` | Banner 上傳意圖回 503。 |
| S-08 | 執行 `npm audit --omit=dev` | 回報 0 known vulnerabilities；此結果不取代原始碼與雲端設定審查。 |

## 6. 自動與人工證據

每一項測試需留下：測試日期、環境／commit、測試資料 ID、實際結果、截圖或 API 回應，以及對應的 `audit_log` 查詢結果。發現缺陷以「編號、嚴重度、重現步驟、預期／實際、截圖、log」紀錄。

目前可執行的基線指令：

```powershell
node --check server/src/server.js
node --check server/src/storage.js
node --check admin/admin-api.js
node --check admin/content.js
git diff --check
cd server; npm audit --omit=dev; npm test
```

`npm test` 現在尚未有測試案例；QA 不得將「0 tests passed」當作自動化通過。所有 P、O、C、B、G、A、S 項目均要以 API／資料庫與瀏覽器實際驗證。

## 7. 本輪完成定義

只有當第 3 至第 5 節皆通過，且未出現 P0／P1 缺陷時，才可宣告「本機官網與後台可驗收」。此宣告不等於可對外營運：帳號建立／SSO 實際設定、付款回呼與對帳、退款、發票、出貨、寄售售出及款項結算仍須各自完成後再進行上線驗收。
