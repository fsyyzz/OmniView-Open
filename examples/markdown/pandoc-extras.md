# Pandoc 扩展：定义列表与 Emoji

本示例验证 OmniView 对 Pandoc 风格定义列表与 emoji shortcode 的支持。

## 定义列表

Apple
: A common fruit, crisp and sweet.

Banana
: A long yellow fruit.

Mermaid
PlantUML
: Diagram engines supported by OmniView.
: Both can be embedded in Markdown fences.

## 带空行与续行

Release Notes

: First paragraph of the definition.

  Second paragraph still belongs to the same definition item.

## Emoji shortcode

状态：:white_check_mark: 通过 · :warning: 警告 · :x: 失败

发布：:rocket: Ship it · :tada: 庆祝 · :fire: Hotfix

互动：:thumbsup: :+1: :thinking_face: :heart_eyes:

未知短码保持原样：:not_a_real_emoji_zz:

## 代码中不受影响

行内：`:rocket:` 与定义样例：

```md
Term
: Definition
:fire:
```
