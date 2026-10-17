/**
 * 返佣联盟链接——网站的「饮料钱」来源。
 *
 * 玩法：把 AI 模型的读者导流到 API 平台，平台按注册/消费给返佣。
 * 对读者是「找便宜 API 的入口」，对网站是 CPS 收入，双方都不反感。
 *
 * **换成你自己的推广码**：下面每个 `ref` 都是占位符，登录各平台的推广后台
 * （硅基流动 → 邀请返现；OpenRouter → 邀请链接；火山引擎 → 推广联盟）把专属链接填进来。
 * 没有推广码的条目先删掉或留官方首页，不要挂着别人的码。
 *
 * 合规底线：
 * - 带 `ref` 参数的才算返佣链接，一律 rel="nofollow sponsored"；
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
    id: 'openrouter',
    name: 'OpenRouter',
    hint: '一个入口调所有海外模型，按 token 计费',
    url: 'https://openrouter.ai/?ref=YOUR_CODE',
  },
  {
    id: 'volcano',
    name: '火山方舟',
    hint: '字节的模型 API 平台，豆包/DeepSeek 都能调',
    url: 'https://www.volcengine.com/product/ark?ref=YOUR_CODE',
  },
];
