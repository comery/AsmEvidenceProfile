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

## 构建

```bash
npm run build
```

## 依赖

- React 17
- Ant Design 4
- LINKVIEW Core (作为本地依赖)
- pako (用于解压.gz文件)

