# DESIGN.md — 可乐爱上课

> 儿童课表打卡与盲盒抽奖 PWA · 移动端优先 · 暖色童趣风格
> 目标用户：4-6 岁小朋友及家长 · 基于 awesome-design-md v1.0

---

## 1. Visual Theme & Atmosphere

**设计哲学**: 温暖、童趣、鼓励式交互。像一个会说话的卡通伙伴，用色彩和动效引导小朋友完成打卡、赚积分、抽盲盒。

**视觉基调**: 明亮暖色调 · 圆润柔和 · 轻快动画

**核心关键词**: `playful` `warm` `rounded` `bouncy` `encouraging`

**光影质感**: 软阴影 + 微渐变 + 柔和发光。卡片带圆角边框，按钮有浮动感。不使用毛玻璃，保持清晰直接，适合儿童认知。

---

## 2. Color Palette & Roles

### Primary Colors

| Token | HEX | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Primary | `#FF6B35` | `--primary` | 主按钮、活跃态、品牌标识、积分强调 |
| Primary Dark | `#E55A2B` | `--primary-dark` | 主色按压态、深色变体 |
| Primary Light | `#FF8C5A` | (gradient stop) | 渐变终点、按钮 hover 发光 |

### Brand & Accent

| Token | HEX | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Secondary | `#4ECDC4` | `--secondary` | 次要强调、标题渐变、成功备选 |
| Accent Yellow | `#FFE66D` | `--accent` | 高亮、进度条、积分条背景 |
| Gold | `#FFD700` | (inline) | 盲盒按钮渐变、奖品卡片 |

### Semantic Colors

| Token | HEX | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Success | `#6BCB77` | `--success` | 已打卡状态、完成标记、绿色日历格 |
| Danger | `#FF6B6B` | `--danger` | 漏打卡、删除按钮、红色日历格 |
| Warning | `#F59E0B` | (inline) | 请假标记、黄色日历格 |
| Purple | `#A78BFA` | `--purple` | 课程颜色选项 |
| Pink | `#F472B6` | `--pink` | 课程颜色选项 |
| Blue | `#60A5FA` | `--blue` | 今日高亮、课程颜色选项 |

### Neutral / Gray Scale

| Token | HEX | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Text Primary | `#2D3436` | `--text` | 正文、标题 |
| Text Secondary | `#636E72` | `--text-light` | 次要文字、标签 |
| Text Muted | `#B2BEC3` | `--text-muted` | 占位符、禁用态、提示文字 |

### Surface & Borders

| Token | HEX | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Background | `#FFF8E7` | `--bg` | 页面主背景（温暖奶油色） |
| Card Surface | `#FFFFFF` | `--bg-card` | 卡片、按钮、输入框背景 |
| Border | `#F0E6D3` | `--border` | 卡片边框、分割线 |
| Border Highlight | `#FFCC80` | (inline) | 积分条边框、强调边框 |

### Shadow Colors

| Token | Value | Usage |
|-------|-------|-------|
| Shadow Default | `rgba(0,0,0,0.08)` | 卡片投影 |
| Shadow Large | `rgba(0,0,0,0.12)` | 弹窗投影 |
| Shadow Primary | `rgba(255,107,53,0.3)` | 主按钮发光 |
| Shadow Gold | `rgba(255,160,0,0.5)` | 盲盒按钮发光 |

---

## 3. Typography Rules

### Font Family

```css
--font-main: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-title: "PingFang SC", "Microsoft YaHei", sans-serif;
```

- 正文使用系统默认中文字体栈，确保跨平台一致性
- 标题使用苹方/微软雅黑，字重更丰富
- 不引入 Web Font，保持加载速度

### Type Scale

| Level | Size (px) | Weight | Line Height | Letter Spacing | Usage |
|-------|-----------|--------|-------------|----------------|-------|
| Hero | 32px | 900 | 1.2 | -0.5px | 积分大数字 |
| H1 | 28px | 800 | 1.3 | 2px | 应用标题 |
| H2 | 24px | 900 | 1.3 | 0 | 弹窗标题、奖品名 |
| H3 | 20px | 800 | 1.3 | 0 | 模态框标题 |
| H4 | 17-18px | 700 | 1.4 | 0 | 卡片标题、课程名 |
| Body | 15px | 400-600 | 1.5 | 0 | 正文、按钮文字 |
| Body Sm | 14px | 400-600 | 1.5 | 0 | Tab 按钮、列表 |
| Caption | 13px | 400-600 | 1.5 | 0 | 辅助信息、标签 |
| Small | 12px | 400 | 1.5 | 0 | 图例、次要提示 |
| Nano | 11px | 400 | 1.4 | 0 | 日历头部、极小文字 |

**设计哲学**: 大字号 + 高字重 = 清晰易读。儿童和家长都需要一眼看清。标题字重 700-900，正文保持 400-600。行高宽松 (1.4-1.5)，避免拥挤感。

---

## 4. Component Stylings

### Buttons

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, #FF6B35, #FF8C5A);
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(255,107,53,0.3);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-primary:hover { transform: translateY(-1px); }
.btn-primary:active { transform: scale(0.97); }
```

#### Ghost Button
```css
.btn-ghost {
  background: #F5F5F5;
  color: #636E72;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
```

#### Danger Button
```css
.btn-danger {
  background: #FF6B6B;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
```

#### Check-in Button (Go)
```css
.checkin-btn.go {
  background: linear-gradient(135deg, #FF6B35, #FF8C5A);
  color: #FFFFFF;
  border: none;
  border-radius: 25px;
  padding: 10px 18px;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(255,107,53,0.4);
  animation: btnBounce 2s ease-in-out infinite;
}
```

#### Check-in Button (Done)
```css
.checkin-btn.done {
  background: #E8F5E9;
  color: #6BCB77;
  border: none;
  border-radius: 25px;
  padding: 8px 16px;
  font-size: 20px;
}
```

#### Blind Box Entry Button
```css
.blindbox-entry.ready {
  background: linear-gradient(135deg, #FFD700, #FFA000);
  color: #5D4037;
  border: none;
  border-radius: 20px;
  padding: 16px;
  font-size: 18px;
  font-weight: 800;
  box-shadow: 0 6px 24px rgba(255,160,0,0.5);
  animation: glowPulse 1.5s ease-in-out infinite;
}
.blindbox-entry.locked {
  background: #F5F5F5;
  color: #B2BEC3;
  cursor: not-allowed;
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 2px solid #F0E6D3;
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  transition: all 0.3s;
}
```

### Inputs

```css
.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #F0E6D3;
  border-radius: 12px;
  font-size: 15px;
  font-family: var(--font-main);
  background: #FAFAFA;
  transition: border-color 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: #FF6B35;
  background: #FFFFFF;
}
.form-input::placeholder {
  color: #B2BEC3;
}
```

### Navigation (Tab Bar)

```css
.tab-btn {
  flex: 1;
  padding: 12px 8px;
  border: 2px solid #F0E6D3;
  border-radius: 12px;
  background: #FFFFFF;
  font-size: 14px;
  font-weight: 600;
  color: #636E72;
  cursor: pointer;
  transition: all 0.25s;
}
.tab-btn.active {
  background: linear-gradient(135deg, #FF6B35, #FF8C5A);
  color: #FFFFFF;
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(255,107,53,0.3);
  transform: translateY(-2px);
}
```

### Badges / Tags

```css
.badge {
  background: #FF6B6B;
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.course-tag {
  display: inline-block;
  background: #FFF3E0;
  color: #FF6B35;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
}
```

### Calendar Day Cells

```css
.cal-day {
  aspect-ratio: 1;
  border-radius: 12px;
  background: #F8F9FA;
  border: 2px solid transparent;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.cal-day.checked  { background: #E8F5E9; border-color: #6BCB77; color: #2E7D32; }
.cal-day.missed   { background: #FFEBEE; border-color: #FF6B6B; color: #C62828; }
.cal-day.absent   { background: #FEF3C7; border-color: #F59E0B; color: #92400E; }
.cal-day.today    { background: #E3F2FD; border-color: #60A5FA; color: #1565C0; }
.cal-day.no-course{ background: #F5F5F5; color: #B2BEC3; cursor: default; }
```

### Modals / Dialogs

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}
.modal-sheet {
  background: #FFFFFF;
  border-radius: 24px 24px 0 0;
  padding: 24px 20px 36px;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

/* Prize Reveal (居中弹窗) */
.prize-reveal-overlay {
  background: rgba(0,0,0,0.8);
  z-index: 2000;
  /* flex + center */
}
.prize-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 30px;
  max-width: 320px;
  width: 90%;
  animation: prizeBounceIn 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}
```

---

## 5. Layout Principles

### Spacing System

基数: **4px**，常用倍数为 4, 8, 12, 16, 20, 24, 32

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标间距、网格 gap |
| sm | 8px | 组件内间距 |
| md | 12px | 列表项间距 |
| lg | 16px | 卡片间距、区块 margin |
| xl | 20px | 卡片 padding |
| 2xl | 24px | 弹窗 padding-top |

### Grid System

- **列数**: 7 列（周历、打卡日历）
- **间距**: 4px
- **内容最大宽度**: 480px（移动端优先）
- **Container**: `max-width: 480px; margin: 0 auto;`

### Responsive Container

```css
.app-container {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
```

### Section Spacing

- 卡片间距: 16px
- Tab 内容 padding: `0 16px 100px`（底部给导航栏留空间）
- Header padding: `16px 20px 12px`
- 表单组间距: 16px

### 留白哲学

充裕留白营造轻松感。儿童应用不能拥挤。卡片之间保持 16px 间距，内容区内边距 20px。底部预留 100px 防遮挡导航栏。

---

## 6. Depth & Elevation

### Shadow System

```css
/* Level 0 — Flat */
--shadow-none: none;

/* Level 1 — Card / Surface (默认) */
--shadow-sm: 0 2px 8px rgba(0,0,0,0.04);

/* Level 2 — Elevated Card */
--shadow: 0 4px 20px rgba(0,0,0,0.08);

/* Level 3 — Floating Element / Active Tab */
--shadow-md: 0 4px 16px rgba(255,107,53,0.3);

/* Level 4 — Modal / Dialog */
--shadow-lg: 0 8px 32px rgba(0,0,0,0.12);

/* Level 5 — Prize Reveal */
--shadow-xl: 0 8px 32px rgba(0,0,0,0.2);

/* Special — Blind Box Glow */
--shadow-glow: 0 6px 24px rgba(255,160,0,0.5);
--shadow-glow-peak: 0 6px 40px rgba(255,160,0,0.8), 0 0 60px rgba(255,215,0,0.4);
```

### Z-index Scale

| Layer | z-index | Usage |
|-------|---------|-------|
| Content | 0 | 主内容 |
| Header | 100 | 顶部导航（sticky） |
| Bottom Bar | 100 | 底部状态栏 |
| Tab Nav | 99 | 标签导航（sticky） |
| Install Banner | 500 | PWA 安装提示 |
| Modal Overlay | 1000 | 普通弹窗 |
| Prize Reveal | 2000 | 盲盒揭晓（最高层） |
| Confetti Canvas | 2001 | 撒花特效 |
| Toast | 3000 | 提示消息 |

### Backdrop Effects

不使用 backdrop-filter（毛玻璃）。遮罩层使用纯色半透明：
- 普通弹窗遮罩: `rgba(0,0,0,0.5)`
- 盲盒揭晓遮罩: `rgba(0,0,0,0.8)`（更沉浸）

---

## 7. Do's and Don'ts

### Do's ✅

1. **使用渐变 + 圆角** — 按钮和活跃态必须用 `linear-gradient` 配合 `border-radius: 12px+`
2. **动画要有弹跳感** — 使用 `cubic-bezier(0.68, -0.55, 0.27, 1.55)` 弹性曲线
3. **emoji 作为图标主力** — 不用SVG图标库，emoji对儿童更友好
4. **状态用颜色+边框双重编码** — 已打卡=绿色背景+绿色边框，漏打卡=红色背景+红色边框
5. **积分数字要大要粗** — 32px + 900 weight，成就感拉满
6. **按钮要有反馈动画** — hover 上浮、active 缩放、idle 浮动
7. **卡片用2px实色边框** — 不用阴影区分卡片，边框更清晰适合儿童
8. **背景加装饰性渐变光晕** — 固定的径向渐变光晕让页面不死板

### Don'ts ❌

1. **不要用纯文字按钮** — 所有可点击元素必须有视觉重量（背景色或边框）
2. **不要用小于11px的文字** — 儿童和家长都需要看得清
3. **不要使用直角** — 最小圆角 8px，默认 12px，卡片 20px
4. **不要省略动画** — 打卡、抽盲盒等关键时刻必须有动效反馈
5. **不要用暗淡配色表达成功** — 成功=鲜绿 `#6BCB77`，不用暗绿
6. **不要让内容撑满屏幕宽度** — 始终 max-width: 480px 居中
7. **不要用纯黑文字** — 正文用 `#2D3436`（深灰），比纯黑柔和

---

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile S | `< 360px` | 小屏手机 |
| Mobile | `360px - 480px` | 标准手机 |
| Tablet+ | `> 480px` | 平板/桌面（居中显示） |

### Touch Targets

- **最小触摸区域**: 36×36px（icon-btn）
- **推荐触摸区域**: 44×44px（emoji图标容器）
- **按钮最小高度**: 40px（含 padding）

### 折叠策略

- **移动端**: 单列布局，480px 最大宽度，底部固定栏
- **平板/桌面**: 内容居中 480px，两侧留白
- **周历**: 始终 7 列 grid，gap 4px
- **日历**: 始终 7 列 grid，gap 4px，格内字体随屏幕缩放
- **弹窗**: 移动端从底部滑出 (bottom sheet)，盲盒揭晓居中弹出

### Font Scaling

- 标题在小屏 (`< 360px`) 从 28px 缩至 24px
- Tab 按钮字体从 14px 缩至 12px
- 正文和功能文字不做缩放，保持可读性

---

## 9. Agent Prompt Guide

### Quick Reference

```
项目: 可乐爱上课 — 儿童课表打卡 PWA
主色: #FF6B35 (暖橙) | 辅色: #4ECDC4 (青绿) | 强调: #FFE66D (暖黄)
背景: #FFF8E7 | 卡片: #FFFFFF | 边框: #F0E6D3
字体: 系统中文栈，标题 700-900 weight
圆角: 12px(小) / 20px(卡片) | 阴影: 0 4px 20px rgba(0,0,0,0.08)
动画: bounce/ease-in-out/glowPulse | 弹窗: bottom-sheet + slideUp
图标: emoji 优先 | 状态: 颜色+边框双重编码
```

### Component Prompts

**生成课程卡片:**
```
创建一张今日课程卡片，包含：左侧圆形emoji图标（52px，背景用课程颜色），右侧课程名(17px/700)+时间(13px/text-light)，最右侧打卡按钮(圆角25px，渐变橙色，带btnBounce浮动动画)。卡片白色背景，2px #F0E6D3边框，20px圆角，padding 18px，shadow: 0 4px 20px rgba(0,0,0,0.08)。
```

**生成积分进度条:**
```
创建积分进度组件：顶部左侧"总积分"标签(14px)，右侧大数字(32px/900/橙色/#FF6B35)。下方14px高进度条，圆角12px，背景半透明白，填充渐变(#FF6B35 → #FF8C5A → #FFE66D)，transition width 0.5s ease。进度条内有白色高光线。整体包裹在渐变暖黄背景(#FFF3E0 → #FFE0B2)的容器中，2px #FFCC80边框，20px圆角。
```

**生成盲盒组件:**
```
创建盲盒抽奖区域：居中布局。顶部状态文字(15px)，中部200x200px盲盒区域，emoji 🎁 100px居中。ready态：boxFloat动画(上下浮动10px, 2s循环)；opening态：boxShake动画(左右摇晃+缩放)。下方提示文字(14px)，ready态橙色加粗+pulse动画。底部可选按钮：locked态灰色#F5F5F5禁用；ready态金渐变(#FFD700→#FFA000)带glowPulse发光动画。
```

**生成设置面板:**
```
创建设置面板：分组布局，每组有标题(13px/700/text-light)，下方白色按钮列表(14px padding, 2px border, 12px圆角，宽度100%，左对齐)。特殊样式：.primary变体橙色边框+浅橙背景；.danger变体红色边框+红色文字。每组底部12px灰色提示文字。组间用1px #F0E6D3分割线。
```

**生成打卡日历:**
```
创建月度打卡日历：7列grid(gap 4px)，顶部星期头(11px/700/text-muted，周末红色)。日期格aspect-ratio:1，12px圆角。状态配色：checked=#E8F5E9背景+#6BCB77边框+#2E7D32文字；missed=#FFEBEE背景+#FF6B6B边框+#C62828文字带pulseMissed动画；absent=#FEF3C7背景+#F59E0B边框+#92400E文字；today=#E3F2FD背景+#60A5FA边框+#1565C0文字；no-course=#F5F5F5背景+#B2BEC3文字无指针。图例行用11px文字水平排列。
```

### Iteration Guide

1. **先定色板，再写组件** — 确保所有颜色来自 DESIGN.md 的调色板
2. **移动端优先** — 先在 375px 视口设计，再考虑放大适配
3. **emoji 图标一致性** — 同一功能始终用同一 emoji，不混用
4. **动画时长统一** — 微交互 0.2s，弹窗进出 0.3s，庆祝动画 0.6s
5. **状态覆盖完整** — 每个组件至少考虑 default / hover / active / disabled 四态
6. **边框+颜色双重表达状态** — 不只靠颜色，边框变化增强可访问性
7. **渐变方向统一 135deg** — 所有 linear-gradient 使用 135deg 方向
8. **阴影只用一种色相** — 所有 box-shadow 使用 rgba(0,0,0,x) 或 rgba(255,107,53,x)
9. **圆角层级分明** — 小组件 8px，标准 12px，卡片 20px，弹窗顶部 24px
10. **新组件先检查现有模式** — 对照已有组件的 border/radius/shadow/padding 保持一致
