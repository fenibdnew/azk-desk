import { BrandSettings, Language, SlideData } from '../types/studio';

function slugifyTag(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, '');
  return cleaned ? `#${cleaned}` : '';
}

export function generateSocialCaption(params: {
  slides: SlideData[];
  activeIndex: number;
  scope: 'active' | 'all';
  brand: BrandSettings;
  lang: Language;
}): string {
  const { slides, activeIndex, scope, brand, lang } = params;
  const activeSlide = slides[activeIndex] || slides[0];
  if (!activeSlide) return '';

  const lines: string[] = [];
  const handle = brand.brandHandle.trim();
  const brandLabel = brand.brandName.trim();

  if (scope === 'all' && slides.length > 1) {
    const lead = slides[0].content;
    if (lead.hook.trim()) {
      lines.push(lead.hook.trim());
    }
    if (lead.headline.trim()) {
      lines.push(lead.headline.trim());
    }
    lines.push('');

    slides.forEach((slide, idx) => {
      const num = `${idx + 1}/${slides.length}`;
      const head = slide.content.headline.trim();
      const body = slide.content.body.trim();
      if (idx === 0) {
        if (body) lines.push(`${num} — ${body}`);
      } else {
        const piece = [head, body].filter(Boolean).join(': ');
        if (piece) lines.push(`${num} — ${piece}`);
      }
    });

    if (activeSlide.content.showWarning && activeSlide.content.warning.trim()) {
      lines.push('');
      lines.push(`⚠ ${activeSlide.content.warning.trim()}`);
    }
  } else {
    const c = activeSlide.content;
    const isQuote = activeSlide.layoutId === 'quote';
    const speakerName = (c.speakerName || '').trim();
    const speakerRole = (c.speakerRole || '').trim();

    if (c.hook.trim()) lines.push(c.hook.trim());
    if (c.headline.trim()) {
      lines.push(isQuote ? `“${c.headline.trim()}”` : c.headline.trim());
    }
    if (isQuote && (speakerName || speakerRole)) {
      const speakerLine = [speakerName ? `— ${speakerName}` : '', speakerRole]
        .filter(Boolean)
        .join(', ');
      if (speakerLine) lines.push(speakerLine);
    }
    if (c.body.trim()) {
      lines.push('');
      lines.push(c.body.trim());
    }
    if (activeSlide.layoutId === 'data-card' && c.dataRows && c.dataRows.length > 0) {
      const validRows = c.dataRows.filter((r) => r.label.trim() || r.value.trim());
      if (validRows.length > 0) {
        lines.push('');
        validRows.forEach((row) => {
          const deltaPart = row.delta?.trim() ? ` (${row.delta.trim()})` : '';
          lines.push(`• ${row.label.trim()}: ${row.value.trim()}${deltaPart}`);
        });
      }
    }
    if (c.showWarning && c.warning.trim()) {
      lines.push('');
      lines.push(`⚠ ${c.warning.trim()}`);
    }
  }

  const metaParts: string[] = [];
  if (activeSlide.content.source.trim()) {
    metaParts.push(
      `${lang === 'bn' ? 'সূত্র' : 'Source'}: ${activeSlide.content.source.trim()}`
    );
  }
  if (activeSlide.content.credit.trim()) {
    metaParts.push(activeSlide.content.credit.trim());
  }
  if (metaParts.length > 0) {
    lines.push('');
    lines.push(metaParts.join(' · '));
  }

  if (handle || brandLabel) {
    lines.push(
      lang === 'bn'
        ? `আরও আপডেটের জন্য অনুসরণ করুন ${handle || brandLabel}`
        : `Follow ${handle || brandLabel} for daily updates.`
    );
  }

  // Contextual hashtags
  const tagSet = new Set<string>();
  const addTag = (raw: string) => {
    const tag = slugifyTag(raw);
    if (tag && tag.length > 2) tagSet.add(tag);
  };

  addTag(brandLabel || 'AZKDesk');
  if (activeSlide.content.category) addTag(activeSlide.content.category);
  if (slides.length > 1) {
    addTag(lang === 'bn' ? 'ক্যারোসেল' : 'NewsCarousel');
  }
  if (lang === 'bn') {
    addTag('বাংলাদেশ');
    addTag('সংবাদ');
    addTag('বিশ্লেষণ');
  } else {
    addTag('NewsUpdate');
    addTag('VisualJournalism');
    addTag('DailyBriefing');
  }

  lines.push('');
  lines.push(Array.from(tagSet).slice(0, 7).join(' '));

  return lines.join('\n').trim();
}
