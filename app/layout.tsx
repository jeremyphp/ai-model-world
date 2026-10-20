import type { Metadata } from 'next';
import './globals.css';
import { Tracker } from '@/components/Tracker';

export const metadata: Metadata = {
  title: 'AI 物料工坊 · 出图即印刷',
  description: '输入主题生成吧唧、立牌、小卡设计，自动套出血线与裁切线，导出 300dpi 印刷文件。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Tracker />
      </body>
    </html>
  );
}
