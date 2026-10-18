/**
 * 福利情报的「编辑部」数据：返佣福利榜 + 免费额度播报。
 *
 * 与价格雷达不同，这部分是**人工审核过的事实**（哪个平台给多少、什么条件），
 * 没法从快照自动算出。每条都带 `checkedAt` 复核日期，过期条目要重新核实。
 *
 * 引擎分工：
 *   - 价格雷达（welfare.ts）：全自动，每 12h 随 sync 刷新；
 *   - 福利榜 / 播报（本文件）：人工维护事实，站点随部署更新；
 *   - 工具速报：复用 data/changelog.json 的 issue + RSS 机制。
 *
 * 红线：只写核实的数字；活动结束就下架，别挂过期的「送钱」承诺。
 */

export interface RebateEntry {
  id: string;
  /** 平台名 */
  name: string;
  /** 奖励内容，一句话说清 */
  reward: string;
  /** 参与条件 */
  condition: string;
  /** 你的推广链接；没有码就用官网首页并标注 */
  url: string;
  /** 链接是否带返佣（决定 rel 与「广告」措辞） */
  affiliate: boolean;
  /** 复核日期 ISO */
  checkedAt: string;
}

export const REBATES: RebateEntry[] = [
  {
    id: 'siliconflow',
    name: '硅基流动推荐官',
    reward: '实名认证送 16 元代金券；每邀 1 人注册认证，双方各得 16 元，人数不设上限',
    condition: '注册 + 实名认证，活动持续至 2026-12-31',
    url: 'https://cloud.siliconflow.cn/i/x6cMnHEd',
    affiliate: true,
    checkedAt: '2026-10-17',
  },
  {
    id: 'volcengine',
    name: '火山引擎联盟计划',
    reward: 'CPA ¥4/有效注册（通过 CakeGrowth 联盟归因，隔日回传，月度结算）',
    condition: '需在 CakeGrowth 以流量主身份申请，审核通过后推广',
    url: 'https://cakegrowth.cn/affiliate-program/volcengine',
    affiliate: false,
    checkedAt: '2026-10-17',
  },
  {
    id: 'loomy',
    name: 'Loomy',
    reward: 'CPA ¥8/有效用户',
    condition: 'CakeGrowth 联盟项目，流量主申请制',
    url: 'https://cakegrowth.cn/affiliate-program/loomy',
    affiliate: false,
    checkedAt: '2026-10-17',
  },
  {
    id: 'aliyun',
    name: '阿里云邀新有礼',
    reward: 'AI 大模型产品邀新返佣，官方活动最高 3000 元',
    condition: '注册阿里云并成为云大使，按邀新消费返佣',
    url: 'https://dashi.aliyun.com/activity/oss',
    affiliate: false,
    checkedAt: '2026-10-17',
  },
];

export interface WelfareNews {
  date: string;
  title: string;
  text: string;
  link?: string;
}

/** 免费额度播报：新条目放最上面。过期/结束的条目降级为「已结束」并写清。 */
export const WELFARE_NEWS: WelfareNews[] = [
  {
    date: '2026-10-17',
    title: 'Novita 邀请活动已结束',
    text: 'Novita 的「Give $10, Earn $10」referral 活动已下线，官网 referral 页仅引导加入 Discord。不再挂它的返佣位。',
  },
  {
    date: '2026-10-17',
    title: '硅基流动「推荐官」计划进行中',
    text: '实名认证领 16 元通用代金券；邀请好友注册认证后双方各得 16 元，无人数上限，活动至 2026-12-31。代金券可抵 API 账单，连 Pro 模型都能用。',
    link: 'https://www.siliconflow.cn/news/od7wj9rr23p95uhihmhrombp',
  },
  {
    date: '2026-10-17',
    title: 'OpenRouter 返佣入口已取消',
    text: 'OpenRouter 官网不再提供公开的 affiliate/referral 计划，收入模式仅充值手续费。相关推荐位已撤下。',
  },
];
