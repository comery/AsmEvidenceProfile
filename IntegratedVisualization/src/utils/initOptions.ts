// import { Options } from '@linkview/linkview-core';
import { ExtendedOptions } from './linkviewWrapper';
type Options = any;

const initOptions: ExtendedOptions = {
  inputContent: '',
  min_alignment_length: 0,
  max_evalue: 1e-5,
  min_identity: 0,
  min_bit_score: 1000,
  chro_thickness: 15,
  no_label: false,
  label_angle: 30,
  label_font_size: 30,
  label_pos: 'right',
  label_x_offset: 0,
  label_y_offset: 0,
  gap_length: 0.2,
  svg_height: 800,
  svg_width: 1200,
  svg_space: 0.2,
  svg_content_width: 1200 * (1 - 0.2),
  show_scale: false,
  scale: 0,
  chro_axis_pos: 'bottom',
  chro_axis_unit: 'auto',
  align: 'center',
  hl_min1px: false,
  highlightContent: '',
  karyotypeContent: '',
  parameterContent: '',
  gffContent: '',
  
  use: function (this: Options, plugin: (...args: any) => void) {
    return plugin.apply(this);
  },
  style: 'classic',
  
  // GCI相关默认值（与Python版本一致）
  depth_height: 160, // 与Python版本一致：--depth_height default=160
  panel_gap: undefined, // 默认：10% of depth_height
  top_margin: 40, // 与Python版本一致：--top_margin default=40
  window_size: 1000, // 与Python版本一致：--window-size default=1000
  max_depth_ratio: 3.0, // 与Python版本一致：--max-depth-ratio default=3.0
  min_safe_depth: 5, // 与Python版本一致：--min-safe-depth default=5
  depth_axis_ticks: 5, // 与Python版本一致：--depth_axis_ticks default=5
  depth_axis_font_size: 12, // 与Python版本一致：--depth_axis_font_size default=12
  auxiliaryLines: [],
  auxiliaryLineColor: 'rgba(255, 0, 0, 0.5)',
  
  // 向后兼容的旧参数名
  gciDepthHeight: 160,
  gciWindowSize: 1000,
  gciDepthMin: 0.5, // 旧版本使用相对值，但Python版本使用绝对值5
  gciDepthMax: 3.0,
  
  // LINKVIEW必需字段（会在运行时填充）
  layout: [],
  alignments: [],
  lenInfo: {},
  alignmentsByCtgs: {},
  intervalInfoByAlignments: {},
} as ExtendedOptions;

export default initOptions;

