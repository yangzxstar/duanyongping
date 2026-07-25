# 测试样本说明

## conversations-sample.json

从 `data/normalized.json`（本仓库抓取产物，未入版本库）中抽出的 10 条发言记录，
共聚成 5 个展示单元，用于给 `build/lib/conversations.mjs` 的 `toConversations`
做不依赖 `data/` 的断言测试：

| 展示单元 | 类型 | 覆盖场景 |
| --- | --- | --- |
| `20318852` | thread | 多发言 thread（5 条），带 `conversation.root` |
| `126988939` | thread | 跨年对话（2019 / 2022 两个年份） |
| `solo-233464435` | original | 独立原创（`thread_root_id` 为 null），带 `stocks` 标签 |
| `solo-401883730` | original | 独立原创，带 `stocks` 标签 |
| `solo-126825649` | original | 独立原创，无标签、极短正文 |

抽样时只保留了 `toConversations` 实际读取的字段
（`id, url, created_at, year, type, thread_root_id, own_text, char_count, stocks, conversation, stats`），
`text_html` / `text_plain` 等大字段已剔除，文件因此控制在 10 KB 以内。

## 版权与用途

样本内容是段永平在雪球的**公开发言片段**，版权归原作者所有。
本仓库仅作个人研究归档，此文件只作为单元测试的输入样本存在，不用于任何形式的传播或再发布。
每条记录都保留了 `url` 字段指向雪球原帖，任何引用都应链回原帖。

## page1.json

抓取阶段（子项目一）的原始接口响应样本，用于解析器/规整器的测试，同样是公开内容、
版权归原作者。
