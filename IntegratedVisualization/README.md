# Integrated Visualization

整合GCI深度图和LINKVIEW比对关系的交互式Web可视化工具。

## 功能特点

- **GCI深度数据可视化**: 支持上传和可视化GCI生成的`.depth.gz`文件
- **LINKVIEW比对可视化**: 支持可视化基因组比对关系
- **坐标同步对齐**: GCI深度图和LINKVIEW比对图通过基因组坐标自动对齐
- **辅助线功能**: 可以添加垂直辅助线，同步显示在所有面板上
- **可配置参数**: 支持设置分辨率、面板高度、窗口大小等参数

## 安装

```bash
cd IntegratedVisualization
npm install
```

## 运行

```bash
npm start
```

应用将在 http://localhost:3000 启动。

## 使用说明

1. **上传GCI深度文件**: 在界面左侧上传`.depth.gz`文件（可选第二个Nano数据集）
2. **输入LINKVIEW比对数据**: 在"LINKVIEW比对数据"文本框中输入比对关系
3. **添加辅助线**（可选）: 输入基因组位置添加垂直辅助线
4. **配置参数**（可选）: 在折叠面板中调整分辨率、高度等参数
5. **生成可视化**: 点击"生成可视化"按钮

## 命令行使用（生成拼接好的图片）

无需打开浏览器，直接通过命令行将输入文件拼接为 SVG 图片。

两种调用方式：
- 直接运行脚本：`node IntegratedVisualization/cli/iv-cli.js --out output.svg [参数...]`
- 使用 npm 脚本：`npm run iv-cli -- --out output.svg [参数...]`

常用参数：
- `--out` 输出 SVG 文件路径（必填）
- `--karyotype` karyotype 文件路径（推荐先提供）
- `--depth1` HiFi 深度文件（支持 `.gz`, `.depth`, `.txt`, `.bed` 单值格式）
- `--depth2` Nano 深度文件（同上）
- `--paf` PAF 比对文件（可重复多次传入多个）
- `--per-chr-json` 每条染色体的文件映射 JSON（见示例）
- `--svg-width` 输出宽度，默认 `1200`
- `--svg-height` 输出高度（不含深度面板），默认 `800`
- `--gci-window-size` 深度滑窗大小，默认 `50000`
- `--gci-depth-height` 单个深度面板高度，默认 `150`
- `--gci-depth-min` 深度最小倍数（相对均值），默认 `0.1`
- `--gci-depth-max` 深度最大倍数（相对均值），默认 `4.0`

示例：

1) 仅 karyotype + HiFi 深度（生成深度面板 + 空对齐图）：
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype data/karyotype.txt \
  --depth1 data/hifi.depth.gz
```

2) karyotype + 两个深度文件 + 对齐数据（完整整合图）：
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype data/karyotype.txt \
  --depth1 data/hifi.depth.gz \
  --depth2 data/nano.depth.gz \
  --paf data/hifi.paf \
  --paf data/nano.paf
```

3) 按染色体分别指定文件（JSON 映射）：
```json
{
  "chr1": {
    "hifiDepth": "data/chr1.hifi.depth.gz",
    "nanoDepth": "data/chr1.nano.depth.gz",
    "hifiPaf": "data/chr1.hifi.paf",
    "nanoPaf": "data/chr1.nano.paf"
  },
  "chr2": { "hifiDepth": "data/chr2.hifi.depth.gz" }
}
```
调用命令：
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out out.svg \
  --karyotype data/karyotype.txt \
  --per-chr-json data/mapping.json
```

注意：当前深度解析器支持“每行一个深度值”的 GCI 格式。若 `.bed` 文件为区间格式，需要后续适配才能解析为密度曲线。

## 最小示例数据与演示脚本

已内置一个可运行的最小示例：
- 示例数据位于 `IntegratedVisualization/examples/`
- 演示脚本位于 `IntegratedVisualization/scripts/demo.sh`

运行演示（生成 `examples/out.svg`）：
```bash
cd IntegratedVisualization
npm run demo
```
或直接：
```bash
node IntegratedVisualization/cli/iv-cli.js \
  --out IntegratedVisualization/examples/out.svg \
  --karyotype IntegratedVisualization/examples/karyotype.txt \
  --depth1 IntegratedVisualization/examples/hifi.depth.txt \
  --depth2 IntegratedVisualization/examples/nano.depth.txt \
  --alignments IntegratedVisualization/examples/alignments.txt
```

## 构建

```bash
npm run build
```

## 依赖

- React 17
- Ant Design 4
- LINKVIEW Core (作为本地依赖)
- pako (用于解压.gz文件)

## 开发者提示

- CLI 会自动识别深度文件是否为 gzip 压缩（魔数判断），支持纯文本与 `.gz`。
- 深度面板会以 karyotype 布局为基准对齐到 LINKVIEW 输出，支持两套深度数据上下对称绘制。

