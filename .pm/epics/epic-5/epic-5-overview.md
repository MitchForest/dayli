# Epic 5: Marketing Website - Beautiful Landing Page

**Duration**: 7 days (4 sprints)  
**Goal**: Create a stunning marketing website that captures dayli's radical philosophy of "Stop managing your work. Start doing it."

## Epic Overview

The marketing website is our primary conversion tool - it must communicate dayli's unique value proposition through exceptional design and user experience. The site should feel premium, minimal, and focused - reflecting the product's core values of simplicity and decision elimination.

## Success Criteria

- [ ] Beautiful, modern SaaS landing page that matches dayli's aesthetics
- [ ] Smooth animations and interactions using Framer Motion
- [ ] Perfect responsive design across all devices
- [ ] Light/dark mode with smooth transitions
- [ ] < 3s load time with optimized performance
- [ ] SEO-ready with proper meta tags
- [ ] Conversion-optimized with clear CTAs
- [ ] Accessible (WCAG 2.1 AA compliant)

## Design Principles

1. **Radical Simplicity**: Like the product, the website shows less, not more
2. **Premium Feel**: High-quality animations, beautiful typography, thoughtful spacing
3. **Story-Driven**: Lead with the problem, reveal the solution
4. **Trust Through Design**: Every pixel should communicate "this will simplify your life"
5. **Mobile-First**: Perfect experience on all devices

## Technical Approach

- **Framework**: Next.js 14 (existing setup)
- **Styling**: Tailwind CSS with existing design system
- **Animations**: Framer Motion (already installed)
- **Components**: Reuse existing UI components where possible
- **Theme**: Leverage existing light/dark mode system
- **Fonts**: Continue using Geist Sans

## Sprint Structure

### Sprint 5.1: Foundation & Hero (2 days)
- Marketing site routing and layout
- Hero section with compelling copy
- Smooth scroll header implementation
- Hero visual/animation component
- OAuth and desktop download CTAs

### Sprint 5.2: Features & How It Works (2 days)
- Features section with 6 core benefits
- "How It Works" interactive timeline
- Day preview components
- Smooth scroll animations
- Section transitions

### Sprint 5.3: Social Proof & Pricing (2 days)
- Twitter-card style testimonials
- Pricing section (Free + Professional)
- FAQ accordion component
- Trust badges and security info
- Footer with links

### Sprint 5.4: Polish & Launch (1 day)
- Performance optimization
- SEO implementation
- Analytics setup
- Cross-browser testing
- Launch preparation

## Key Design Decisions

### Color Usage
- Primary teal (#0D7377) for key CTAs and accents
- Warm off-white (#FAF9F5) background in light mode
- True dark (#0A0A0A) in dark mode
- Semantic colors for different block types in previews

### Animation Strategy
- Subtle, purposeful animations (no excessive motion)
- Stagger animations for lists and cards
- Smooth scroll reveals with Intersection Observer
- Hero visual with gentle hover effects
- Respect prefers-reduced-motion

### Content Strategy
- Lead with the core problem: decision fatigue
- Show, don't tell - use visual examples
- Real user stories and outcomes
- Clear, jargon-free language
- Focus on benefits, not features

## Risk Mitigation

1. **Performance**: Lazy load images, optimize bundle size
2. **SEO**: Server-side rendering, proper meta tags
3. **Conversion**: A/B test CTAs, track user behavior
4. **Accessibility**: Test with screen readers, keyboard nav
5. **Browser Support**: Test on all major browsers

## Dependencies

- Existing UI components from main app
- Design system (colors, typography, spacing)
- Framer Motion for animations
- Next.js Image for optimization
- Google OAuth integration (existing)

## Definition of Done

- [ ] All sections implemented and responsive
- [ ] Animations smooth on all devices
- [ ] Light/dark mode working perfectly
- [ ] Page load < 3s on 3G connection
- [ ] Passes Lighthouse audit (>90 all categories)
- [ ] Cross-browser tested (Chrome, Safari, Firefox, Edge)
- [ ] Mobile tested (iOS Safari, Chrome Android)
- [ ] Analytics implemented
- [ ] Ready for production deployment 