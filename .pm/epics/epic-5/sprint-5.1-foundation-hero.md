# Sprint 5.1: Foundation & Hero

**Duration**: 2 days  
**Goal**: Set up the marketing site structure and create a compelling hero section that captures attention and drives conversions.

## Sprint Overview

This sprint establishes the foundation for our marketing website with a focus on the hero section - the most critical part of our landing page. We'll implement smooth animations, responsive design, and a clear value proposition.

## Success Criteria

- [ ] Marketing site routing properly separated from app
- [ ] Hero section with two-column layout (content + visual)
- [ ] Smooth scroll header that appears after hero
- [ ] Light/dark mode toggle in header
- [ ] Google OAuth CTA button
- [ ] Desktop download button
- [ ] Hero visual with animated schedule preview
- [ ] Fully responsive design
- [ ] Smooth animations with Framer Motion

## Technical Implementation

### 1. Marketing Route Structure

```
apps/web/app/
├── (marketing)/
│   ├── layout.tsx          # Marketing-specific layout
│   ├── page.tsx           # Landing page
│   └── components/
│       ├── MarketingHeader.tsx
│       ├── Hero.tsx
│       ├── HeroVisual.tsx
│       └── MarketingFooter.tsx
└── (app)/                 # Existing app routes
    ├── focus/
    ├── login/
    └── settings/
```

### 2. Key Components

#### MarketingHeader
- Fixed position, appears on scroll
- Smooth opacity/transform animation
- Navigation links with hover states
- Light/dark mode toggle
- Sign In / Get Started CTAs
- Mobile hamburger menu

#### Hero Section
- Two-column grid on desktop
- Compelling headline with accent color
- Clear value proposition
- Dual CTAs (OAuth + Download)
- Trust indicator ("Free forever")
- Responsive stacking on mobile

#### HeroVisual
- Animated schedule preview
- Time blocks with staggered entrance
- AI chat bubble preview
- Subtle hover effects
- Glow/shadow for depth

### 3. Animation Strategy

```typescript
// Stagger animations for visual impact
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  }
};
```

### 4. Responsive Breakpoints

- Mobile: < 640px (single column, centered)
- Tablet: 640px - 1024px (adjusted spacing)
- Desktop: > 1024px (two columns, full layout)

## Implementation Details

### Hero Copy

**Headline**: "Stop managing your work. Start doing it."  
**Subheadline**: "Your AI executive assistant that makes every decision about what you should work on, so you don't have to. No task lists. No priorities. Just focus."  
**CTA Primary**: "Get Started with Google"  
**CTA Secondary**: "Download for Mac"  
**Trust**: "Free forever for personal use • No credit card required"

### Visual Design

The hero visual showcases a simplified version of the dayli interface:
- Clean schedule view with 4 time blocks
- Different block types (focus, email, break, meeting)
- Subtle animations on load
- AI chat preview in corner
- Matches app's design system

### Performance Considerations

- Lazy load hero visual component
- Optimize animations for 60fps
- Use CSS transforms for animations
- Minimize JavaScript bundle
- Preload critical fonts

## Testing Checklist

- [ ] Desktop: Chrome, Safari, Firefox, Edge
- [ ] Mobile: iOS Safari, Chrome Android
- [ ] Animations smooth on all devices
- [ ] Header scroll behavior correct
- [ ] CTAs properly linked
- [ ] Dark mode toggle works
- [ ] Responsive at all breakpoints
- [ ] No layout shifts on load
- [ ] Keyboard navigation works
- [ ] Screen reader friendly

## File Structure

```
apps/web/app/(marketing)/
├── layout.tsx
├── page.tsx
└── components/
    ├── MarketingHeader.tsx
    ├── Hero.tsx
    ├── HeroVisual.tsx
    ├── TimeBlock.tsx
    └── MarketingFooter.tsx
```

## Next Steps

After completing the hero section:
1. Review with team for feedback
2. A/B test different headlines
3. Optimize load performance
4. Begin Sprint 5.2 (Features section)

## Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Hero Section Best Practices](https://www.nngroup.com/articles/hero-image/) 