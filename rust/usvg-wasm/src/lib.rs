//! OmniView usvg-wasm: SVG 归一化 → 序列化为 JSON 树 (ADR-0001 §10)
//!
//! **本文件为骨架实现**——仅暴露 wasm-bindgen 入口与最小的 parse/serialize
//! 接口；具体 usvg 内部 API 适配（`usvg::Tree` → `serde_json`）将在 M1 实施
//! 阶段填充。本文件编译需要 Rust ≥ 1.75 + `wasm32-unknown-unknown` target +
//! `wasm-pack`（参见 ADR-0001 §10.3）。
//!
//! 浏览器侧 TypeScript 调用方：
//! ```ts
//! import init, { parse_svg, serialize_tree } from '@omniview/usvg-wasm';
//! await init();                       // 加载 wasm
//! const treeJson = parse_svg(svgText); // 浏览器端得到归一化树 JSON
//! const svgText2 = serialize_tree(treeJson); // 反序列化
//! ```

#![forbid(unsafe_code)]

use serde::Serialize;
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// 公共 JSON DTO（与 src/features/viewers/components/drivers/svg/core/io/types.ts
// 的 UsvgTree 接口对齐；M1 阶段填充完整字段映射）
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct UsvgTreeDto {
    pub size: UsvgSizeDto,
    pub root: UsvgNodeDto,
    pub defs: Vec<UsvgNodeDto>,
}

#[derive(Serialize)]
pub struct UsvgSizeDto {
    pub width: f32,
    pub height: f32,
}

/// 简化版节点 DTO。M1 阶段填充完整字段（kind / transform / fill / stroke / 等）。
#[derive(Serialize)]
#[serde(tag = "kind")]
pub enum UsvgNodeDto {
    #[serde(rename = "group")]
    Group {
        id: String,
        transform: Vec<f32>,
        opacity: f32,
        visibility: String,
        clip_path: Option<String>,
        mask: Option<String>,
        filter: Option<String>,
        children: Vec<UsvgNodeDto>,
    },
    #[serde(rename = "path")]
    Path {
        id: String,
        transform: Vec<f32>,
        opacity: f32,
        visibility: String,
        d: String,
        // fill / stroke: M1 填充
    },
    #[serde(rename = "image")]
    Image {
        id: String,
        transform: Vec<f32>,
        opacity: f32,
        visibility: String,
        href: String,
        width: f32,
        height: f32,
    },
    #[serde(rename = "text")]
    Text {
        id: String,
        transform: Vec<f32>,
        opacity: f32,
        visibility: String,
        text: String,
        x: f32,
        y: f32,
        font_size: f32,
        font_family: String,
    },
    #[serde(rename = "use")]
    Use {
        id: String,
        transform: Vec<f32>,
        opacity: f32,
        visibility: String,
        href: String,
    },
}

// ---------------------------------------------------------------------------
// WASM 导出函数
// ---------------------------------------------------------------------------

/// 把 SVG 字符串解析为归一化树（JSON 字符串）。
///
/// M1 实施 TODO：
/// 1. 用 `usvg::Parser::new().parse_str(svg, &usvg::Options::default())`
///    解析为 `usvg::Tree`；
/// 2. 把 Tree 转为 `UsvgTreeDto`；
/// 3. 用 `serde_json::to_string` 序列化为 JS 侧字符串返回。
///
/// 当前为骨架：直接返回最小占位 JSON。
#[wasm_bindgen]
pub fn parse_svg(svg: &str) -> Result<String, JsError> {
    console_error_panic_hook::set_once();
    // TODO(M1): 实现完整 usvg::Tree → UsvgTreeDto 映射
    if svg.trim().is_empty() {
        return Err(JsError::new("empty svg input"));
    }
    Ok(serde_json::json!({
        "size": { "width": 0.0, "height": 0.0 },
        "root": {
            "kind": "group",
            "id": "",
            "transform": [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            "opacity": 1.0,
            "visibility": "visible",
            "clip_path": null,
            "mask": null,
            "filter": null,
            "children": [],
        },
        "defs": [],
        "_todo": "M1: replace with real usvg::Tree mapping",
    })
    .to_string())
}

/// 把归一化树（JSON 字符串）反序列化为 SVG 字符串。
///
/// M1 实施 TODO：
/// 1. `serde_json::from_str` 解析为 `UsvgTreeDto`；
/// 2. 用 usvg 的 `Tree::write_to` / `Writer` 输出 SVG。
///
/// 当前为骨架：直接返回占位 SVG。
#[wasm_bindgen]
pub fn serialize_tree(tree_json: &str) -> Result<String, JsError> {
    console_error_panic_hook::set_once();
    let _tree: UsvgTreeDto = serde_json::from_str(tree_json)
        .map_err(|e| JsError::new(&format!("invalid tree json: {e}")))?;
    // TODO(M1): 实现 UsvgTreeDto → usvg::Tree 重建 + svg 输出
    Ok(String::from(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
  <!-- TODO(M1): real serialize -->
</svg>"#,
    ))
}

/// 健康检查接口（供 Worker 在 init 后调用验证 WASM 模块可用）。
#[wasm_bindgen]
pub fn ping() -> String {
    "omniview-usvg-wasm ok".to_string()
}