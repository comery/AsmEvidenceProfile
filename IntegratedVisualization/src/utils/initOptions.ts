import { Options } from '@linkview/linkview-core';
import { ExtendedOptions } from './linkviewWrapper';

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
  
  // GCI相关默认值
  gciDepthHeight: 150,
  gciWindowSize: 50000,
  gciDepthMin: 0.1,
  gciDepthMax: 4.0,
  auxiliaryLines: [],
  auxiliaryLineColor: 'rgba(255, 0, 0, 0.5)',
  
  // LINKVIEW必需字段（会在运行时填充）
  layout: [],
  alignments: [],
  lenInfo: {},
  alignmentsByCtgs: {},
  intervalInfoByAlignments: {},
} as ExtendedOptions;

export default initOptions;

