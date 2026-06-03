# 轻食备餐教练

本地运行的 AI 做菜产品 MVP，面向健康减脂和家庭备餐。用户填写自己的 DeepSeek API Key 后，产品生成一周餐单、热量/蛋白估算、购物清单和批量备餐流程。

## 运行

```powershell
npm test
npm start
```

默认地址：`http://localhost:4317`

## API Key 处理

DeepSeek API Key 只保存在浏览器 `localStorage`。生成计划时，前端把 Key 随请求发送给本地后端，后端只负责代理到 DeepSeek，不把 Key 写入文件或数据库。

## 第一版限制

- 热量和营养是 AI 估算，不是医疗或营养师处方。
- 未接入食材营养数据库。
- 未做账号系统和云同步。
