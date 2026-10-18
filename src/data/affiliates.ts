/**
 * 返佣联盟链接——网站的「饮料钱」来源。
 *
 * 玩法：把 AI 模型的读者导流到 API 平台，平台按注册/消费给返佣。
 * 对读者是「找便宜 API 的入口」，对网站是 CPS/CPA 收入，双方都不反感。
 *
 * **换成你自己的推广码**：下面每个 `YOUR_CODE` 都是占位符：
 *   - 硅基流动 → 推荐官计划（活动中心 → 推荐官计划，实名认证后拿邀请码），
 *     格式 https://cloud.siliconflow.cn/i/<邀请码>；
 *   - Novita → 官网 referral 页（注册后把邀请码发给朋友即返 credits），
 *     格式 https://novita.ai/referral?invited_code=<邀请码>；
 *   - 火山方舟 → 火山引擎联盟计划（CPA ¥4/有效注册，在 CakeGrowth 联盟平台
 *     cakegrowth.cn 以流量主身份申请），拿到的推广链接整条替换 url。
 * 没有推广码的条目先删掉，不要挂着别人的码。
 *
 * 合规底线：
 * - 返佣链接一律 rel="nofollow sponsored"；
 * - 中国大陆的广告法要求标注「广告」，组件里已带；
 * - Toy 版（B 站）整块隐藏——平台审核对站外导流很敏感。
 */

export interface Affiliate {
  id: string;
  /** 链接文字，如「硅基流动」 */
  name: string;
  /** 悬停说明 */
  hint: string;
  /** 落地页，YOUR_CODE 是占位推广码 */
  url: string;
}

export const AFFILIATES: Affiliate[] = [
  {
    id: 'siliconflow',
    name: '硅基流动',
    hint: '国内 API 平台，按量计费，新用户有免费额度',
    url: 'https://cloud.siliconflow.cn/i/YOUR_CODE',
  },
  {
    id: 'novita',
    name: 'Novita',
    hint: '海外 API 平台，一个入口调 Llama/DeepSeek 等开源模型',
    url: 'https://novita.ai/referral?invited_code=YOUR_CODE',
  },
  {
    id: 'volcano',
    name: '火山方舟',
    hint: '字节的模型 API 平台，豆包/DeepSeek 都能调',
    url: 'https://www.volcengine.com/product/ark?ref=YOUR_CODE',
  },
];
