/**
 * 多语言。首版只有中文，英文放第二期。
 *
 * 架子的设计要点：所有页面文案都由结构化数据套模板生成，不展示上游返回的任何自由文本，
 * 所以增加一门语言 = 增加一份字典，不需要翻译服务，也不存在「新模型出现时英文版滞后」的问题。
 * 视图组件一律接收 `lang` 参数，第二期只需新增 src/app/en/ 这层薄路由即可。
 */

export const LANGS = ['zh', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'zh';

export interface Dict {
  siteName: string;
  siteTagline: string;
  siteDescription: string;

  nav: {
    plaza: string;
    chronicle: string;
    leaderboard: string;
    compare: string;
    changelog: string;
    welfare: string;
  };

  continent: {
    west: string;
    east: string;
  };

  /** 擂台赛道名。键与 Benchmarks 的字段以及派生指标对应。 */
  track: {
    eci: string;
    swe_bench_verified: string;
    value: string;
    memory: string;
    cheap: string;
    hardcore: string;
    webdev_arena_elo: string;
  };

  /** 角色属性的展示标签 */
  attr: {
    releaseDate: string;
    knowledgeCutoff: string;
    contextWindow: string;
    maxOutput: string;
    inputPrice: string;
    outputPrice: string;
    params: string;
    license: string;
    openWeights: string;
    modalities: string;
    toolCall: string;
    reasoning: string;
    promptCaching: string;
    /** 模型类型（文本 / 视觉 / …），见 kind.ts */
    kind: string;
  };

  /**
   * 模型类型的名称与一句话解释。键对应 kind.ts 的 ModelKind。
   * 名称要短到能当筛选按钮，解释要让外行一眼明白判定依据。
   */
  kind: {
    label: Record<'text' | 'vision' | 'omni' | 'image-gen' | 'video-gen' | 'speech', string>;
    hint: Record<'text' | 'vision' | 'omni' | 'image-gen' | 'video-gen' | 'speech', string>;
    /** 上游没标模态时的兜底 */
    unknown: string;
    /** 筛选条上「类型」这一组的标题 */
    filterLabel: string;
    /** 跨类的「多模态」筛选：除纯文本以外的全部 */
    multimodal: string;
    multimodalHint: string;
    /** 首页「按类型看」那一块的标题 */
    sectionTitle: string;
    /** 每张类型卡上大数字后面的单位 */
    countUnit: string;
    /** 卡片悬停提示：「点开看全部 N 个 xx 模型」 */
    viewAll: (n: number, label: string) => string;
  };

  /** 数据缺失与可信度提示。这些措辞是这个站的诚信底线，改动需谨慎。 */
  unknown: {
    /** 完全拿不到参数量时的提示。对应角色身上的雾化斗篷。 */
    sizeEstimated: string;
    /** 有参数量但来自型号名推断而非官方权重文件时的提示 */
    sizeApprox: string;
    notRanked: string;
    noData: string;
    singleSource: string;
    /** 只被多源发现收录、缺少价格与上下文的模型 */
    incomplete: string;
    /** 只精确到月的发布日期 */
    monthOnly: (year: number, month: number) => string;
  };

  status: {
    newborn: string;
    retired: string;
    /** 距今天数 */
    ageDays: (days: number) => string;
    ageYears: (years: number) => string;
  };

  /** 头顶冠冕的说明 */
  crown: {
    gold: string;
    laurel: string;
    silver: string;
  };

  /** 首页广场 */
  plaza: {
    /** 区域标题后的计数 */
    vendorCount: (n: number) => string;
    /** 折叠区：数据太少、进不了默认广场的厂商 */
    moreVendors: (n: number) => string;
    /** 按厂商实力分的街区。分组依据见 roster.ts 的 tierOf */
    tier: {
      top: string;
      main: string;
      unscored: string;
    };
    tierHint: {
      top: string;
      main: string;
      unscored: string;
    };
    /** 本家有更新的型号、但它没资格换下门面时，屋子下面那条提示 */
    newer: (name: string) => string;
    newerHint: (name: string, date: string) => string;
  };

  /** 首屏「今日格局」冠军横条 */
  champions: {
    title: string;
    smart: string;
    code: string;
    value: string;
    cheap: string;
    memory: string;
    newest: string;
    east: string;
    open: string;
  };

  /** 顶栏状态 */
  hud: {
    updatedAt: (date: string) => string;
    modelCount: (models: number, vendors: number) => string;
  };

  footer: {
    dataFrom: string;
    artFrom: string;
    credits: string;
    /** 站长署名前缀，拼成「作者：jeremy」 */
    author: string;
    /** 开源仓库入口 */
    sourceCode: string;
    sourceCodeHint: string;
    /** 二次开发来源声明（MIT 要求保留版权声明） */
    basedOn: string;
  };

  /**
   * 模型详情页名牌上的站外入口。本站只给链接不搬运正文：
   * B 站搜索词由模型名现算，新模型上线当天链接就是通的，没有要维护的清单。
   * 出处与免责写在按钮的悬停提示里，不占版面。
   */
  reviews: {
    video: string;
    videoHint: (name: string) => string;
  };
}

/*
 * 文案原则（第三次改版后定下来的）：
 *
 * 1. **直说**。「西岸都会 / 东方城邦」改成「国外 / 国内」，「往生堂」改成「已退役」，
 *    「听你说话的价格」改成「输入价格」。拟人化留给画面和角色，界面文字负责让人一秒看懂。
 * 2. **不说废话**。「每个大模型都是这个世界里的一个人 · 此刻住着 42 位」这类
 *    自我介绍全部删掉——用户点进来是看格局的，不是来听站点自述的。
 * 3. 保留少量有信息量的拟人词：「刚出生」比「新发布」多传达了「时间很短」的语气，
 *    「记性」比「上下文窗口」对外行更好懂，这类留着。
 */
const zh: Dict = {
  siteName: '大模型王者峡谷',
  siteTagline: '一眼看懂大模型英雄的当下格局',
  siteDescription:
    '把每个大模型画成一位峡谷英雄，用能力条和排行榜把「谁最聪明、谁最会编程、谁最便宜」摆在明面上。数据来自第三方公开评测，每 12 小时自动同步。',

  nav: {
    plaza: '峡谷',
    chronicle: '时间线',
    leaderboard: '排行榜',
    compare: '对比',
    changelog: '更新',
    welfare: '福利',
  },

  continent: {
    west: '国外',
    east: '国内',
  },

  track: {
    eci: '综合智力',
    swe_bench_verified: '编程',
    value: '性价比',
    memory: '上下文',
    cheap: '最便宜',
    hardcore: '硬核推理',
    webdev_arena_elo: '实战口碑',
  },

  attr: {
    releaseDate: '发布日期',
    knowledgeCutoff: '知识截止',
    contextWindow: '上下文窗口',
    maxOutput: '单次最大输出',
    inputPrice: '输入价格',
    outputPrice: '输出价格',
    params: '参数量',
    license: '开源许可',
    openWeights: '开放权重',
    modalities: '支持的输入',
    toolCall: '工具调用',
    reasoning: '深度思考',
    promptCaching: '提示缓存',
    kind: '模型类型',
  },

  kind: {
    label: {
      text: '文本',
      vision: '视觉',
      omni: '全模态',
      'image-gen': '图像生成',
      'video-gen': '视频生成',
      speech: '语音',
    },
    hint: {
      text: '只读文字、只写文字的对话模型',
      vision: '除了文字还能看图片或视频，输出文字',
      omni: '能听声音、也能看图，文字、图、声音一起理解',
      'image-gen': '能生成图片',
      'video-gen': '能生成视频',
      speech: '语音识别、语音合成或语音对话，不看图',
    },
    unknown: '类型未知',
    filterLabel: '类型',
    multimodal: '多模态',
    multimodalHint: '除纯文本以外的全部：能看图、能听声、能出图出视频',
    sectionTitle: '按类型看',
    countUnit: '个',
    viewAll: (n, label) => `查看全部 ${n} 个${label}模型`,
  },

  unknown: {
    sizeEstimated: '体型为估算值，官方从未公布参数量',
    sizeApprox: '参数量由型号名推断，非官方权重实测',
    notRanked: '未定级',
    noData: '暂无数据',
    singleSource: '单源数据，未经交叉校验',
    incomplete: '资料不全',
    monthOnly: (year, month) => `${year} 年 ${month} 月`,
  },

  status: {
    newborn: '刚出生',
    retired: '已退役',
    ageDays: (days) => `${days} 天前发布`,
    ageYears: (years) => `发布 ${years} 年`,
  },

  crown: {
    gold: '峡谷第一',
    laurel: '峡谷前五',
    silver: '峡谷前十',
  },

  plaza: {
    vendorCount: (n) => `${n} 家`,
    moreVendors: (n) => `还有 ${n} 家资料不全的厂商`,
    tier: {
      top: '王者',
      main: '星耀',
      unscored: '未定级',
    },
    tierHint: {
      top: '实力排名前十的厂商，按各家头号模型的综合智力算',
      main: '参加过第三方综合评测的厂商',
      unscored: '还没有任何第三方综合评测成绩',
    },
    newer: (name) => `本家更新：${name}`,
    newerHint: (name, date) =>
      `${name} 发布于 ${date}，比屋里这位更新。\n` +
      '屋里站的是这家当下实力第一的一位，而新型号往往还没拿到第三方评测成绩，\n' +
      '所以不会仅因为「更新」就换人。点这行可以直接去看它。',
  },

  champions: {
    title: '峡谷之巅',
    smart: '最聪明',
    code: '最会编程',
    value: '最划算',
    cheap: '最便宜',
    memory: '记性最好',
    newest: '最新发布',
    east: '国内第一',
    open: '开源第一',
  },

  hud: {
    updatedAt: (date) => `数据更新于 ${date}`,
    modelCount: (models, vendors) => `${models} 个模型 · ${vendors} 家厂商`,
  },

  footer: {
    dataFrom: '数据来自',
    artFrom: '字体',
    credits: '素材署名',
    author: '作者',
    sourceCode: '源码开源',
    sourceCodeHint: '本站代码、数据管线与抓取脚本全部开源（MIT），在 GitHub 上',
    basedOn: '本站基于 liyupi/ai-model-world 二次开发（MIT），原版权归原作者',
  },

  reviews: {
    video: '查看评测视频',
    videoHint: (name) => `站外链接：到 B 站搜「${name} 测评」，看别人实测的视频`,
  },
};

/**
 * 第二期在这里加 `en`。视图层已经全部按 lang 参数化，届时是纯增量改动。
 */
const dictionaries: Partial<Record<Lang, Dict>> = { zh };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang] ?? zh;
}

export function htmlLang(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : 'en';
}
